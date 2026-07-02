import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { HUD_BOT_Y, HUD_TOP_H, Hud } from "../systems/Hud";
import { addPhaseBackground, addPhaseDecor } from "../systems/Background";
import { PLAT_DEFS } from "../systems/TextureFactory";
import { Player } from "../entities/Player";
import { getRun, savePersisted } from "../systems/PlayerState";
import { CLASSES, WEAPONS, WeaponId, ClassId } from "../systems/WeaponSystem";
import { SanityFx } from "../systems/SanityFx";
import { reapplyAllPerks } from "../systems/PerkSystem";
import { CulturaId, CULTURAS, reapplyAllCulturas } from "../systems/CulturaSystem";
import { CombatFx } from "../systems/CombatFx";
import { Sfx } from "../systems/AudioSystem";
import { Music } from "../systems/MusicSystem";
import { validateLevel, logLevelReport, drawLevelOverlay } from "../systems/LevelValidator";

export const LEVEL_WIDTH = 1920;
export const FLOOR_Y = HUD_BOT_Y - 32;

export interface EnemyGroupDef {
  group: Phaser.Physics.Arcade.Group;
  vrDrop: number;
  aerial?: boolean;
}

export abstract class BasePhaseScene extends Phaser.Scene {
  protected platIdx = 0;
  protected player!: Player;
  protected platforms!: Phaser.Physics.Arcade.StaticGroup;
  protected furnitureBodies!: Phaser.Physics.Arcade.StaticGroup;
  protected inkProjectiles!: Phaser.Physics.Arcade.Group;
  protected enemyProjectiles!: Phaser.Physics.Arcade.Group;
  protected drops!: Phaser.Physics.Arcade.Group;
  protected boss?: Phaser.Physics.Arcade.Sprite & { hp: number; maxHp?: number; contactDamage: number; hit: (d: number, k: number) => boolean; onHpChange?: (hp: number) => void };
  protected bossDefeated = false;
  protected startTimeMs = 0;
  protected fx!: SanityFx;
  protected hud!: Hud;
  protected doorEl!: Phaser.GameObjects.Image;
  protected doorLabel!: Phaser.GameObjects.Text;
  protected interactKey!: Phaser.Input.Keyboard.Key;
  protected levelWidth = LEVEL_WIDTH;
  protected enemyGroups: EnemyGroupDef[] = [];
  protected combatFx!: CombatFx;
  private _layoutVariant = 0;

  // --- Abstract methods ---
  protected abstract getBgKey(): string;
  protected abstract getPhaseTitle(): string;
  protected getPhaseNumber(): 1 | 2 | 3 | 4 | 5 | null { return null; }
  protected abstract getInitialObjective(): string;
  protected abstract getPlatformLayout(): Array<[number, number, number]>;
  protected abstract getDoorConfig(): {
    x: number;
    tint: number;
    label: string;
    cameFrom: string;
    destScene: string;
    nextScene?: string;
    nearLabel: string;
  };
  protected abstract getBossName(): string;
  protected abstract setupEnemiesAndGroups(): void;

  // --- Virtual hooks (empty defaults) ---
  protected onPhaseUpdate(_t: number, _d: number): void {}
  protected onEnemyKilledByMelee(_e: any): void {}
  protected onEnemyKilledByProjectile(_e: any): void {}

  create() {
    const run = getRun(this);
    this.platIdx = 0;
    this.startTimeMs = this.time.now;
    this.bossDefeated = false;
    this.enemyGroups = [];
    Music.start("office");

    // 1. World bounds, camera, background
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.bg);
    addPhaseBackground(this, this.getBgKey(), HUD_TOP_H, FLOOR_Y);
    const pn = this.getPhaseNumber();
    if (pn !== null) addPhaseDecor(this, pn, FLOOR_Y);

    // 2. Platforms + furnitureBodies, floor, platform layout
    this.platforms = this.physics.add.staticGroup();
    this.furnitureBodies = this.physics.add.staticGroup();
    this.platIdx = 0;
    this.buildFloor();
    // Variedade roguelite: o layout autorado é perturbado por seed em 3
    // variantes — 0: original, 1: espelhado, 2: alturas alternadas. Todas
    // validadas em DEV pelo LevelValidator no fim do create().
    const seedNum = run.seed ? parseInt(run.seed.replace(/\D/g, "").slice(0, 8) || "0", 10) : 0;
    const layoutVariant = (seedNum + (run.loopCount ?? 0)) % 3;
    let layout = this.getPlatformLayout();
    if (layoutVariant === 1) {
      layout = layout.map(([x, y, tiles]) =>
        [LEVEL_WIDTH - x, y, tiles] as [number, number, number]);
    } else if (layoutVariant === 2) {
      const ys = layout.map(([, y]) => y);
      const hi = Math.min(...ys), lo = Math.max(...ys);
      layout = layout.map(([x, y, tiles], i) =>
        [x, i % 2 === 0 ? (y === hi ? lo : hi) : y, tiles] as [number, number, number]);
    }
    this._layoutVariant = layoutVariant;
    for (const [x, y, tiles] of layout) {
      this.buildPlatform(x, y, tiles);
    }

    // 3. Door
    const doorCfg = this.getDoorConfig();
    this.doorEl = this.add.image(doorCfg.x, FLOOR_Y - 30, "tex-door");
    this.doorEl.setTint(doorCfg.tint);
    this.doorLabel = this.add.text(doorCfg.x, FLOOR_Y - 72, doorCfg.label, {
      fontFamily: "monospace", fontSize: "9px", color: "#666666", align: "center",
    }).setOrigin(0.5);

    // 4. Player setup
    const classDef = CLASSES[(run.characterClass ?? "analista") as ClassId];
    const weaponId = (run.weaponId ?? classDef.startWeapon) as WeaponId;
    const weaponDef = WEAPONS[weaponId] ?? WEAPONS[classDef.startWeapon];

    const spawnX = run.cameFrom === "copa" ? LEVEL_WIDTH - 120 : 80;
    this.player = new Player(this, spawnX, FLOOR_Y - 60);

    this.player.maxEnergy        = classDef.maxEnergy + (run.upgMaxEnergy ?? 0);
    this.player.maxSanity        = classDef.maxSanity + (run.upgMaxSanity ?? 0);
    this.player.walkSpeed        = 200 * classDef.speedMult;
    this.player.damageMult       = classDef.damageMult;
    this.player.vrDropMult       = classDef.vrMult + (run.upgVrDropMult ?? 0);
    this.player.parryWindowBonus = run.upgParryWindowBonus ?? 0;
    this.player.weaponId         = weaponId;
    this.player.attackRange      = weaponDef.attackRange;
    this.player.specialCooldown  = weaponDef.specialCooldown;
    this.player.specialType      = weaponDef.specialType;
    this.player.hitAutoRanged    = weaponDef.hitAutoRanged;
    this.player.isRangedPrimary  = weaponDef.type === "ranged";
    this.player.comboHits        = (weaponDef.type === "melee" && weaponDef.hitDamages[2] === 0) ? 2 : 3;
    this.player.attackIntervalMs = Math.round(220 / (weaponDef.attackSpeedMult ?? 1));
    this.player.autonomia           = run.autonomia ?? false;
    this.player.specialCooldownMult = run.upgSpecialCooldownMult ?? 1.0;
    this.player.dashCooldownBonus   = run.upgDashCooldownBonus ?? 0;
    this.player.damageReductionMult = run.upgDamageReductionMult ?? 1.0;
    this.player.parryEnergyRestore  = run.upgParryEnergyRestore ?? 0;
    this.player.parryVrDrop         = run.upgParryVrDrop ?? 0;
    if ((run.upgComboHitsBonus ?? 0) >= 1) this.player.comboHits = 4;

    if (run.cameFrom === "copa") {
      this.player.energy = run.energy;
      this.player.sanity = run.sanity;
    } else {
      this.player.energy = this.player.maxEnergy;
      this.player.sanity = this.player.maxSanity;
    }
    this.player.vr = run.vr;
    reapplyAllPerks(this.player, run);
    reapplyAllCulturas(this.player, run);

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.furnitureBodies);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    // 5. Player callbacks
    this.player.onDeath = (cause) => {
      const r = getRun(this);
      if ((r.extraLives ?? 0) > 0) {
        r.extraLives!--;
        this.player.energy = 30;
        this.player.setTint(0xff4444);
        this.time.delayedCall(500, () => this.player.clearTint());
        return;
      }
      this.persist();
      this.scene.start("GameOverScene", { vr: this.player.vr, cause });
    };

    this.player.onAttack = (hb, step) => this.resolveAttack(hb, step);

    this.player.onRangedAttack = (fx, fy, facing) => {
      const def = WEAPONS[this.player.weaponId as WeaponId] ?? WEAPONS.grampeador;
      this.spawnProjectile({
        x: fx + facing * 20, y: fy - 5,
        velX: facing * (def.rangedSpeed || 500),
        damage: def.rangedDamage || def.hitDamages[0],
        piercing: def.rangedPiercing,
        bounces: def.rangedBounce,
        homing: def.rangedHoming,
      });
    };

    this.player.onSpecialAttack = (type, fx, fy, facing) => {
      const def = WEAPONS[this.player.weaponId as WeaponId] ?? WEAPONS.grampeador;
      this.handleSpecial(type, fx, fy, facing, def);
    };

    // Parry "Reclamar" — stun nearest enemy, gold burst VFX
    this.player.onParrySuccess = (_fromX: number) => {
      let closest: (Phaser.Physics.Arcade.Sprite & { frozenUntil?: number }) | null = null;
      let closestDist = 160;
      for (const gDef of this.enemyGroups) {
        gDef.group.getChildren().forEach(c => {
          const e = c as Phaser.Physics.Arcade.Sprite & { frozenUntil?: number };
          if (!e.active) return;
          const d = Math.abs(e.x - this.player.x);
          if (d < closestDist) { closestDist = d; closest = e; }
        });
      }
      if (closest) {
        const e = closest as Phaser.Physics.Arcade.Sprite & { frozenUntil?: number };
        e.frozenUntil = this.time.now + 800;
        e.setTint(0x00ffdd);
        this.time.delayedCall(800, () => { if (e.active) e.clearTint(); });
      }
      // Gold burst
      const burst = this.add.text(this.player.x, this.player.y - 40, "RECLAMEI!", {
        fontFamily: "monospace", fontSize: "13px", color: "#ffdd00",
        stroke: "#000000", strokeThickness: 2,
      }).setOrigin(0.5).setDepth(200);
      this.tweens.add({ targets: burst, y: burst.y - 30, alpha: 0, duration: 700, onComplete: () => burst.destroy() });
    };

    // 6. Projectile + drop groups
    this.inkProjectiles   = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group();
    this.drops            = this.physics.add.group();

    // 7. FX + HUD — BEFORE setupEnemiesAndGroups
    this.fx       = new SanityFx(this);
    this.hud      = new Hud(this, LEVEL_WIDTH);
    this.combatFx = new CombatFx(this);

    // 8. Subclass populates this.enemyGroups and this.boss
    this.setupEnemiesAndGroups();

    // 8a. Loop HP scaling — each completed loop adds 15% HP to all enemies
    const loopCount = run.loopCount ?? 0;
    if (loopCount > 0) {
      const mult = 1 + loopCount * 0.15;
      for (const def of this.enemyGroups) {
        def.group.getChildren().forEach(obj => {
          const e = obj as any;
          if (typeof e.hp === "number") e.hp = Math.round(e.hp * mult);
          if (typeof e.maxHp === "number") e.maxHp = Math.round(e.maxHp * mult);
        });
      }
      if (this.boss) {
        this.boss.hp = Math.round(this.boss.hp * mult);
        if (this.boss.maxHp !== undefined) this.boss.maxHp = Math.round(this.boss.maxHp * mult);
      }
    }

    // 9. Boss wiring
    if (this.boss) {
      const bossMaxHp = this.boss.maxHp ?? this.boss.hp;
      this.hud.showBoss(this.getBossName(), bossMaxHp);
      Sfx.bossAppear();
      Music.start("boss");
      this.boss.onHpChange = (hp: number) => this.hud.updateBoss(hp);
      this.physics.add.collider(this.boss as Phaser.Physics.Arcade.Sprite, this.platforms);
    }

    // 10. Enemy group platform colliders (filter !aerial) + drops collider
    for (const def of this.enemyGroups) {
      if (!def.aerial) {
        this.physics.add.collider(def.group, this.platforms);
      }
    }
    this.physics.add.collider(this.drops, this.platforms);

    // 10b. Separação entre inimigos de chão (não-aéreos): evita empilhamento no
    // mesmo ponto. Só resolve a sobreposição; a IA re-aplica a velocidade.
    const groundGroups = this.enemyGroups.filter(d => !d.aerial).map(d => d.group);
    for (let i = 0; i < groundGroups.length; i++) {
      this.physics.add.collider(groundGroups[i], groundGroups[i]);
      for (let j = i + 1; j < groundGroups.length; j++) {
        this.physics.add.collider(groundGroups[i], groundGroups[j]);
      }
    }

    // 11. Contact damage overlaps (filter !aerial)
    for (const def of this.enemyGroups) {
      if (!def.aerial) {
        this.physics.add.overlap(this.player, def.group, (_p, eObj) => {
          if (this.player.isInvulnerable(this.time.now)) return;
          const e = eObj as any;
          this.player.takeDamage(e.contactDamage ?? 8, 4, e.x);
        });
      }
    }

    // 12. Enemy projectiles → player
    this.physics.add.overlap(this.player, this.enemyProjectiles, (_p, pObj) => {
      const p = pObj as Phaser.Physics.Arcade.Sprite;
      if (!p.active || this.player.isInvulnerable(this.time.now)) return;
      const dmg = (p.getData("damage") as number) ?? 10;
      this.player.takeDamage(dmg, 3);
      p.destroy();
    });

    // 13. Ink projectiles → platforms (bounce logic)
    this.physics.add.collider(this.inkProjectiles, this.platforms, (inkObj) => {
      const ink = inkObj as Phaser.Physics.Arcade.Sprite;
      const bounces = (ink.getData("bounces") as number) ?? 0;
      if (bounces > 0) {
        ink.setData("bounces", bounces - 1);
        const ibody = ink.body as Phaser.Physics.Arcade.Body;
        ibody.setVelocityX(-ibody.velocity.x);
        ibody.setVelocityY(-Math.abs(ibody.velocity.y) * 0.5);
      } else {
        ink.destroy();
      }
    });

    // 14. Ink projectiles → enemy groups
    for (const groupDef of this.enemyGroups) {
      const { group, vrDrop } = groupDef;
      this.physics.add.overlap(this.inkProjectiles, group, (inkObj, enemyObj) => {
        const ink = inkObj as Phaser.Physics.Arcade.Sprite;
        if (!ink.active) return;
        const enemy = enemyObj as Phaser.Physics.Arcade.Sprite & { hit?: (d: number, k: number) => boolean };
        if (!enemy.active || !enemy.hit) return;
        const dmg = (ink.getData("damage") as number) ?? 10;
        const piercing = (ink.getData("piercing") as boolean) ?? false;
        const died = enemy.hit(Math.round(dmg * this.player.damageMult), 0);
        if (!piercing) ink.destroy();
        if (died) {
          this.dropVR(enemy.x, enemy.y, Math.max(1, Math.round(vrDrop * this.player.vrDropMult)));
          enemy.destroy();
          this.onEnemyKilledByProjectile(enemy);
        }
      });
    }

    // 15. Ink projectiles → boss
    if (this.boss) {
      const bossRef = this.boss;
      this.physics.add.overlap(this.inkProjectiles, bossRef as Phaser.Physics.Arcade.Sprite, (inkObj) => {
        const ink = inkObj as Phaser.Physics.Arcade.Sprite;
        if (!ink.active || !bossRef.active) return;
        const dmg = (ink.getData("damage") as number) ?? 10;
        const piercing = (ink.getData("piercing") as boolean) ?? false;
        const died = bossRef.hit(Math.round(dmg * this.player.damageMult), 0);
        if (!piercing) ink.destroy();
        if (died) this.handleBossDefeat();
      });
    }

    // 16. Player → drops
    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      this.player.addVR(1);
      (dObj as Phaser.Physics.Arcade.Sprite).destroy();
    });

    // 17. ESC → PauseScene
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => {
      this.scene.pause();
      this.scene.launch("PauseScene", { caller: this.scene.key });
    });

    // 18. Interact key + door zone
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    const doorZone = this.add.zone(this.doorEl.x, this.doorEl.y, 40, 60);
    this.physics.add.existing(doorZone, true);
    this.physics.add.overlap(this.player, doorZone, () => {
      if (!this.bossDefeated) return;
      if (Phaser.Input.Keyboard.JustDown(this.interactKey) || this.player.gamepadInteractJustPressed) {
        this.persist();
        const r = getRun(this);
        r.cameFrom = doorCfg.cameFrom;
        if (doorCfg.nextScene) {
          r.nextScene = doorCfg.nextScene;
          this.cameras.main.fadeOut(300, 0, 0, 0, (_cam: any, t: number) => {
            if (t === 1) this.scene.start(doorCfg.destScene);
          });
        } else {
          this.cameras.main.fadeOut(300, 0, 0, 0, (_cam: any, t: number) => {
            if (t === 1) this.scene.start(doorCfg.destScene);
          });
        }
      }
    });

    // 19. HUD phase title + objective
    this.hud.setPhaseTitle(this.getPhaseTitle());
    this.hud.setObjective(this.getInitialObjective());

    // 20. Phase title announcement
    const title = this.add.text(GAME_WIDTH / 2, 110, this.getPhaseTitle(), {
      fontFamily: "monospace", fontSize: "18px", color: "#eaeaea", align: "center",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(999);
    this.tweens.add({ targets: title, alpha: 0, duration: 800, delay: 2200, onComplete: () => title.destroy() });

    // 21. Validação de fase (só DEV) + overlay com a tecla V — mesmo padrão da
    // Fase 1. Garante que a variante de layout sorteada é jogável/justa.
    if (import.meta.env.DEV) {
      const spec = {
        label: this.getPhaseTitle(), seedVariant: this._layoutVariant,
        floorY: FLOOR_Y, ceilingY: HUD_TOP_H, levelWidth: LEVEL_WIDTH,
        playerSpawn: { x: spawnX, y: FLOOR_Y - 60 },
        jumpVel: -520, gravity: 1200,
        platforms: this.platforms, furniture: this.furnitureBodies,
        enemies: this.enemyGroups.map(d => d.group),
        boss: this.boss, expectBoss: this.getBossName() !== "",
        exit: { x: this.doorEl.x, y: this.doorEl.y },
      };
      const report = validateLevel(spec);
      logLevelReport(`${this.getPhaseTitle()} (layout ${this._layoutVariant})`, report);
      let overlay: Phaser.GameObjects.Container | undefined;
      this.input.keyboard?.on("keydown-V", () => {
        if (overlay) { overlay.destroy(); overlay = undefined; }
        else overlay = drawLevelOverlay(this, spec, report);
      });
    }
  }

  update(time: number, delta: number) {
    // 1. Player update
    this.player.update(time, delta);
    this.player.tickPassive(time);

    // 2. Subclass phase logic
    this.onPhaseUpdate(time, delta);

    // 3. Collect all enemies for homing ink logic
    const allEnemies: Phaser.Physics.Arcade.Sprite[] = [];
    for (const def of this.enemyGroups) {
      def.group.getChildren().forEach(e => allEnemies.push(e as Phaser.Physics.Arcade.Sprite));
    }

    // Homing ink projectile logic (lifetime + homing)
    this.inkProjectiles.getChildren().forEach(obj => {
      const ink = obj as Phaser.Physics.Arcade.Sprite;
      if (!ink.active) return;
      const lifetime = ink.getData("lifetime") as number;
      if (lifetime && lifetime < time) { ink.destroy(); return; }
      if (!ink.getData("homing")) return;
      const nearest = allEnemies.filter(e => e.active).sort((a, b) =>
        Phaser.Math.Distance.Between(ink.x, ink.y, a.x, a.y) -
        Phaser.Math.Distance.Between(ink.x, ink.y, b.x, b.y)
      )[0];
      if (nearest) {
        const ibody = ink.body as Phaser.Physics.Arcade.Body;
        const angle = Phaser.Math.Angle.Between(ink.x, ink.y, nearest.x, nearest.y);
        ibody.setVelocity(Math.cos(angle) * 480, Math.sin(angle) * 480);
      }
    });

    // 4. Boss contact damage + HUD update
    if (this.boss?.active) {
      if (!this.player.isInvulnerable(time) &&
        Phaser.Geom.Intersects.RectangleToRectangle(
          (this.boss as Phaser.Physics.Arcade.Sprite).getBounds(),
          this.player.getBounds()
        )) {
        this.player.takeDamage(this.boss.contactDamage, 3, this.boss.x);
      }
      this.hud.updateBoss(this.boss.hp);
    }

    // 5. Sanity FX
    this.fx.update(time, this.player.sanity);

    // 6. Near-door check
    const nearDoor = this.bossDefeated &&
      Phaser.Math.Distance.Between(this.player.x, this.player.y, this.doorEl.x, this.doorEl.y) < 40;

    // 7. HUD update
    const run = getRun(this);
    this.hud.update({
      energy: Math.ceil(this.player.energy),
      maxEnergy: this.player.maxEnergy,
      sanity: Math.ceil(this.player.sanity),
      maxSanity: this.player.maxSanity,
      vr: this.player.vr,
      reconhecimento: run.reconhecimento,
      time,
      startTime: this.startTimeMs,
      playerX: this.player.x,
      interactHint: nearDoor ? `[ E ]  ${this.getDoorConfig().nearLabel}` : undefined,
      dashCooldown: this.player.getDashCooldownRatio(time),
      perks: run.perks,
    });
  }

  protected handleBossDefeat() {
    this.bossDefeated = true;
    this.hud.hideBoss();
    this.hud.setObjective("Copa desbloqueada! Use [ E ] na porta.");

    if (this.boss?.active) {
      for (let i = 0; i < 12; i++) {
        this.time.delayedCall(i * 60, () => {
          if (this.boss) this.dropVR(this.boss.x + Phaser.Math.Between(-60, 60), this.boss.y - 20);
        });
      }
      (this.boss as Phaser.Physics.Arcade.Sprite).destroy();
    }

    savePersisted(getRun(this).reconhecimento, getRun(this).fgts, getRun(this).loopCount);
    this.doorEl.clearTint();
    this.doorLabel.setText("COPA").setColor("#c9a36a");

    const msg = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30,
      this.getBossName() + " DERROTADO!\n\nPorta da Copa desbloqueada ->",
      { fontFamily: "monospace", fontSize: "15px", color: "#f2c14e", stroke: "#000000", strokeThickness: 3, align: "center" }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(999);
    this.tweens.add({ targets: msg, alpha: 0, duration: 900, delay: 3500, onComplete: () => msg.destroy() });

    this._launchCulturaSelect();
  }

  protected _launchCulturaSelect() {
    const allIds = Object.keys(CULTURAS) as CulturaId[];
    const options = Phaser.Utils.Array.Shuffle([...allIds]).slice(0, 3) as CulturaId[];
    this.scene.pause();
    this.scene.launch("CulturaSelectScene", { caller: this.scene.key, options });
  }

  protected resolveAttack(hb: Phaser.Geom.Rectangle, step: number) {
    const def = WEAPONS[this.player.weaponId as WeaponId] ?? WEAPONS.grampeador;
    const comboHits = def.hitDamages[2] === 0 ? 2 : 3;
    const dmgIndex = Math.min(step - 1, def.hitDamages.length - 1);
    const baseDmg = def.hitDamages[dmgIndex] || def.hitDamages[0];
    let strikeMult = 1.0;
    if (this.player.firstStrikeReady) {
      this.player.firstStrikeReady = false;
      strikeMult = 1.5;
      this.cameras.main.flash(180, 255, 215, 0, false);
    }
    const damage = Math.round(baseDmg * this.player.damageMult * strikeMult);
    const knockback = (step >= comboHits ? def.comboKnockback : 80) * this.player.facing;
    const slowMs = def.hitSlow;

    const slash = this.add.rectangle(hb.x + hb.width / 2, hb.y + hb.height / 2, hb.width, hb.height, 0xffffff, 0.5);
    this.tweens.add({ targets: slash, alpha: 0, duration: 140, onComplete: () => slash.destroy() });
    const isFinal = step >= comboHits;
    if (isFinal) { this.combatFx.finisherImpact(); Sfx.meleeHeavy(); Sfx.comboFinisher(); }
    else Sfx.meleeLight();

    const tryHit = (s: Phaser.Physics.Arcade.Sprite) =>
      Phaser.Geom.Intersects.RectangleToRectangle(hb, s.getBounds());

    for (const groupDef of this.enemyGroups) {
      const { group, vrDrop } = groupDef;
      group.getChildren().forEach((c) => {
        const e = c as Phaser.Physics.Arcade.Sprite & { hit: (d: number, k: number) => boolean; applySlowdown?: (ms: number) => void };
        if (!e.active || !tryHit(e)) return;
        if (slowMs > 0 && e.applySlowdown) e.applySlowdown(slowMs);
        CombatFx.flashSprite(e as unknown as Phaser.Physics.Arcade.Sprite, 55);
        const died = e.hit(damage, knockback);
        this.combatFx.spawnDamageNumber(e.x, e.y - 20, damage, isFinal ? "#ffdd44" : "#ffffff", isFinal);
        if (isFinal) this.combatFx.finisherImpact();
        if (died) {
          this.dropVR(e.x, e.y, Math.max(1, Math.round(vrDrop * this.player.vrDropMult)));
          this.onEnemyKilledByMelee(e);
          if ((e as any).active !== false) e.destroy();
        }
      });
    }

    if (this.boss && this.boss.active && tryHit(this.boss as Phaser.Physics.Arcade.Sprite)) {
      CombatFx.flashSprite(this.boss as unknown as Phaser.Physics.Arcade.Sprite, 55);
      const died = this.boss.hit(damage, knockback);
      this.combatFx.spawnDamageNumber(this.boss.x, this.boss.y - 40, damage, "#ff8800", isFinal);
      if (isFinal) this.combatFx.impactHeavy(120);
      if (died) this.handleBossDefeat();
    }
  }

  protected handleSpecial(type: string, fx: number, fy: number, facing: 1 | -1, def: any) {
    switch (type) {
      case "burst_ranged":
        for (let i = 0; i < 2; i++) {
          this.time.delayedCall(i * 100, () => {
            this.spawnProjectile({
              x: fx + facing * 20, y: fy - 5,
              velX: facing * (def.rangedSpeed || 500),
              damage: def.rangedDamage || def.hitDamages[0],
            });
          });
        }
        break;
      case "wide_sweep": {
        const hb = new Phaser.Geom.Rectangle(facing > 0 ? fx : fx - 100, fy - 24, 100, 48);
        this.resolveAttack(hb, 3);
        break;
      }
      case "aerial_spike": {
        const hb = new Phaser.Geom.Rectangle(fx - 20, fy - 50, 40, 50);
        this.resolveAttack(hb, 3);
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(-300);
        break;
      }
      case "throw_weapon":
        this.spawnProjectile({
          x: fx + facing * 20, y: fy - 10,
          velX: facing * 700,
          damage: def.hitDamages[1] * 2,
        });
        break;
      case "emp_pulse": {
        const stun = (s: any) => { if (s.applyFreeze) s.applyFreeze(900); };
        for (const gd of this.enemyGroups) {
          gd.group.getChildren().forEach(stun);
        }
        (this.boss as any)?.applyFreeze?.(900);
        const ring = this.add.circle(this.player.x, this.player.y, 8, 0x88aaff, 0.6);
        this.tweens.add({ targets: ring, scaleX: 15, scaleY: 15, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
        break;
      }
      case "paper_spread": {
        const angles = [-0.25, 0, 0.25];
        angles.forEach(a => {
          const spd = def.rangedSpeed || 500;
          this.spawnProjectile({
            x: fx + facing * 20, y: fy - 5,
            velX: facing * spd * Math.cos(a), velY: spd * Math.sin(a),
            damage: def.rangedDamage || def.hitDamages[0],
            piercing: def.rangedPiercing,
          });
        });
        break;
      }
      case "caneca_arc":
        this.spawnProjectile({
          x: fx + facing * 20, y: fy - 20,
          velX: facing * 400, velY: -350,
          damage: def.hitDamages[2],
          arc: true,
        });
        break;
      case "wide_beam": {
        const beamRect = new Phaser.Geom.Rectangle(
          facing > 0 ? fx : 0,
          fy - 25,
          facing > 0 ? this.levelWidth - fx : fx,
          30
        );
        this.resolveAttack(beamRect, 3);
        const lineW = facing > 0 ? (this.levelWidth - fx) : fx;
        const line = this.add.rectangle(
          facing > 0 ? fx + lineW / 2 : fx / 2,
          fy - 10, lineW, 6, 0x88aaff, 0.8
        );
        this.tweens.add({ targets: line, alpha: 0, duration: 300, onComplete: () => line.destroy() });
        break;
      }
      case "spray_knockback": {
        const hb = new Phaser.Geom.Rectangle(facing > 0 ? fx : fx - 120, fy - 30, 120, 60);
        this.resolveAttack(hb, 3);
        const cloud = this.add.circle(fx + facing * 60, fy, 12, 0xffffff, 0.5);
        this.tweens.add({ targets: cloud, scaleX: 5, scaleY: 4, alpha: 0, duration: 500, onComplete: () => cloud.destroy() });
        break;
      }
      case "chain_lightning": {
        const allEnemies: Phaser.Physics.Arcade.Sprite[] = [];
        for (const gd of this.enemyGroups) {
          gd.group.getChildren().forEach(e => allEnemies.push(e as Phaser.Physics.Arcade.Sprite));
        }
        const sorted = allEnemies.filter(e => e.active).sort((a, b) =>
          Phaser.Math.Distance.Between(fx, fy, a.x, a.y) -
          Phaser.Math.Distance.Between(fx, fy, b.x, b.y)
        );
        sorted.slice(0, 3).forEach((enemy, i) => {
          this.time.delayedCall(i * 80, () => {
            const e = enemy as any;
            if (e.hit) e.hit(def.hitDamages[2], 150);
            const flash = this.add.rectangle(enemy.x, enemy.y, 6, 40, 0xffff44, 0.9);
            this.time.delayedCall(150, () => flash.destroy());
          });
        });
        (this.boss as any)?.hit?.(def.hitDamages[2], 150);
        break;
      }
      case "heal_pulse": {
        this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 20);
        const glow = this.add.circle(this.player.x, this.player.y, 8, 0x44ff88, 0.7);
        this.tweens.add({ targets: glow, scaleX: 12, scaleY: 12, alpha: 0, duration: 400, onComplete: () => glow.destroy() });
        break;
      }
      case "dash_strike": {
        const hb = new Phaser.Geom.Rectangle(
          facing > 0 ? fx : fx - 160, fy - 24, 160, 48
        );
        this.resolveAttack(hb, 3);
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(facing * 600);
        break;
      }
      case "clock_slow": {
        for (const gd of this.enemyGroups) {
          gd.group.getChildren().forEach((s: any) => {
            if (s.applySlowdown) s.applySlowdown(2000);
          });
        }
        (this.boss as any)?.applySlowdown?.(2000);
        const overlay = this.add.circle(this.player.x, this.player.y, 8, 0xaaaaff, 0.5);
        this.tweens.add({ targets: overlay, scaleX: 20, scaleY: 20, alpha: 0, duration: 600, onComplete: () => overlay.destroy() });
        break;
      }
    }
  }

  protected spawnEnemyProjectile(
    fx: number, fy: number,
    tx: number, ty: number,
    damage: number,
    tint = 0xff4444,
    speed = 180,
    extraVelX = 0,
    extraVelY = 0
  ): Phaser.Physics.Arcade.Sprite {
    const proj = this.enemyProjectiles.create(fx, fy, "tex-inkproj") as Phaser.Physics.Arcade.Sprite;
    const body = proj.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    const angle = Phaser.Math.Angle.Between(fx, fy, tx, ty);
    body.setVelocity(Math.cos(angle) * speed + extraVelX, Math.sin(angle) * speed + extraVelY);
    proj.setData("damage", damage);
    proj.setTint(tint);
    this.time.delayedCall(3000, () => { if (proj.active) proj.destroy(); });
    return proj;
  }

  protected spawnProjectile(opts: {
    x: number; y: number;
    velX: number; velY?: number;
    damage: number;
    piercing?: boolean;
    bounces?: number;
    homing?: boolean;
    arc?: boolean;
    textureKey?: string;
  }) {
    const ink = this.inkProjectiles.create(opts.x, opts.y, opts.textureKey ?? "tex-inkproj") as Phaser.Physics.Arcade.Sprite;
    const body = ink.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(opts.velX, opts.velY ?? 0);
    if (opts.arc) body.setGravityY(400);
    ink.setData("damage", opts.damage);
    ink.setData("piercing", opts.piercing ?? false);
    ink.setData("bounces", opts.bounces ?? 0);
    ink.setData("homing", opts.homing ?? false);
    ink.setData("lifetime", this.time.now + 4000);
    return ink;
  }

  protected dropVR(x: number, y: number, count = 1) {
    for (let i = 0; i < count; i++) {
      const d = this.drops.create(x + (i - count / 2) * 8, y - 10, "tex-vr") as Phaser.Physics.Arcade.Sprite;
      d.setDepth(8);
      const body = d.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Phaser.Math.Between(-120, 120), Phaser.Math.Between(-260, -160));
      body.setBounce(0.4);
      body.setDrag(120, 0);
    }
  }

  protected persist() {
    const r = getRun(this);
    r.energy    = this.player.energy;
    r.sanity    = this.player.sanity;
    r.vr        = this.player.vr;
    r.autonomia = this.player.autonomia;
  }

  protected buildFloor() {
    this.add.tileSprite(LEVEL_WIDTH / 2, FLOOR_Y + 8, LEVEL_WIDTH, 16, "tex-floor");
    const floorPhys = this.add.rectangle(LEVEL_WIDTH / 2, FLOOR_Y + 8, LEVEL_WIDTH, 16, 0x000000, 0);
    this.physics.add.existing(floorPhys, true);
    this.platforms.add(floorPhys);
  }

  protected buildPlatform(x: number, y: number, tiles: number) {
    const platDefs = PLAT_DEFS;
    const heightFromFloor = FLOOR_Y - y;
    const matching = platDefs.filter(d => Math.abs(d.height - heightFromFloor) <= 5);
    const pool = matching.length > 0 ? matching : platDefs;
    const def = pool[this.platIdx % pool.length];
    this.platIdx++;
    const w = tiles * 32;

    for (let i = 0; i < tiles; i++) {
      this.add.image(x + i * 32 + 16, y, def.surf).setDisplaySize(32, 14).setDepth(9);
    }

    const bodyTop = y + 7;
    const bodyH = FLOOR_Y - bodyTop;
    const bodyMidY = bodyTop + bodyH / 2;
    for (let i = 0; i < tiles; i++) {
      this.add.image(x + i * 32 + 16, bodyMidY, def.body).setDisplaySize(32, bodyH).setDepth(7);
    }

    const plat = this.add.rectangle(x + w / 2, y, w, 14, 0x000000, 0);
    this.physics.add.existing(plat, true);
    this.platforms.add(plat);

    const bodyPlat = this.add.rectangle(x + w / 2, bodyMidY, w, bodyH, 0x000000, 0);
    this.physics.add.existing(bodyPlat, true);
    this.furnitureBodies.add(bodyPlat);
  }
}
