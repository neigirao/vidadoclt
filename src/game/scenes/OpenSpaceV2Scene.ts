import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { HUD_BOT_Y, HUD_TOP_H } from "../systems/Hud";
import { addPhaseBackground } from "../systems/Background";
import { Player } from "../entities/Player";
import {
  EstagiarioDesesperado,
  AnalistaJunior,
  FacilitadorDeWorkshop,
  PostIt,
  ScrumMasterCaotico,
  CoordenadorDeSinergia,
  AnalistaSeniorExausto,
} from "../entities/Enemies";
import { GerenteMicrogestor, EmailProjectil } from "../entities/Boss";
import { getRun, savePersisted } from "../systems/PlayerState";
import { CLASSES, WEAPONS, WeaponId, ClassId } from "../systems/WeaponSystem";
import { SanityFx } from "../systems/SanityFx";
import { Hud } from "../systems/Hud";
import { reapplyAllPerks } from "../systems/PerkSystem";
import { addImage } from "../systems/SpriteLibrary";

const LEVEL_WIDTH = 1920;
const FLOOR_Y = HUD_BOT_Y - 32;

export class OpenSpaceV2Scene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private furnitureBodies!: Phaser.Physics.Arcade.StaticGroup;
  private estagiarios!: Phaser.Physics.Arcade.Group;
  private analistas!: Phaser.Physics.Arcade.Group;
  private facilitadores!: Phaser.Physics.Arcade.Group;
  private scrums!: Phaser.Physics.Arcade.Group;
  private coordenadores!: Phaser.Physics.Arcade.Group;
  private seniors!: Phaser.Physics.Arcade.Group;
  private postits!: Phaser.Physics.Arcade.Group;
  private emails!: Phaser.Physics.Arcade.Group;
  private inkProjectiles!: Phaser.Physics.Arcade.Group;
  private drops!: Phaser.Physics.Arcade.Group;
  private boss?: GerenteMicrogestor;
  private bossDefeated = false;
  private startTimeMs = 0;
  private fx!: SanityFx;
  private hud!: Hud;
  private doorCopa!: Phaser.GameObjects.Image;
  private doorLabel!: Phaser.GameObjects.Text;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private levelWidth = LEVEL_WIDTH;

  constructor() {
    super("OpenSpaceV2Scene");
  }

  create() {
    const run = getRun(this);
    this.startTimeMs = this.time.now;
    this.bossDefeated = false;

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.bg);

    addPhaseBackground(this, "pxbg-openspace", HUD_TOP_H, FLOOR_Y);

    // Office bay decoratives
    [80, 340, 600, 860, 1120, 1380, 1640, 1880].forEach(x => {
      addImage(this, x, FLOOR_Y - 28, "tex-baia");
    });

    this.platforms = this.physics.add.staticGroup();
    this.furnitureBodies = this.physics.add.staticGroup();
    this.buildFloor();

    // Platforms: alternating desk (30 px) and shelf (72 px)
    this.buildPlatform(200,  FLOOR_Y - 30, 5);
    this.buildPlatform(460,  FLOOR_Y - 72, 4);
    this.buildPlatform(700,  FLOOR_Y - 30, 5);
    this.buildPlatform(1000, FLOOR_Y - 72, 6);
    this.buildPlatform(1350, FLOOR_Y - 30, 5);
    this.buildPlatform(1620, FLOOR_Y - 72, 4);

    // Floor-level decoratives
    addImage(this, 60,   FLOOR_Y - 28, "tex-cafe-machine").setDepth(8).setDisplaySize(40, 56);
    addImage(this, 490,  FLOOR_Y - 24, "tex-bebedouro").setDepth(8).setDisplaySize(32, 48);
    addImage(this, 140,  FLOOR_Y - 32, "tex-ponto").setDepth(8).setDisplaySize(32, 48);
    addImage(this, 1800, FLOOR_Y - 22, "tex-extintor").setDepth(8).setDisplaySize(20, 44);

    // Monitors on platform surfaces
    [220, 380, 560, 720, 1020, 1360, 1500].forEach(x =>
      addImage(this, x, FLOOR_Y - 46, "tex-monitor").setDepth(9).setDisplaySize(44, 32)
    );

    // Wall decoratives (parallax, very back)
    [450, 1100, 1650].forEach(x =>
      addImage(this, x, HUD_TOP_H + 80, "tex-quadro-motivacional")
        .setDepth(2).setDisplaySize(48, 56).setScrollFactor(0.2, 0)
    );

    // Copa door — locked until boss defeated
    this.doorCopa = addImage(this, LEVEL_WIDTH - 60, FLOOR_Y - 30, "tex-door");
    this.doorCopa.setTint(0x555555);
    this.doorLabel = this.add.text(LEVEL_WIDTH - 60, FLOOR_Y - 72, "COPA\n[BLOQUEADO]", {
      fontFamily: "monospace", fontSize: "9px", color: "#666666", align: "center",
    }).setOrigin(0.5);

    const classDef = CLASSES[(run.characterClass ?? "analista") as ClassId];
    const weaponId = (run.weaponId ?? classDef.startWeapon) as WeaponId;
    const weaponDef = WEAPONS[weaponId] ?? WEAPONS[classDef.startWeapon];

    const spawnX = run.cameFrom === "copa" ? LEVEL_WIDTH - 120 : 80;
    this.player = new Player(this, spawnX, FLOOR_Y - 60);
    this.player.maxEnergy         = classDef.maxEnergy;
    this.player.maxSanity         = classDef.maxSanity;
    this.player.walkSpeed         = 200 * classDef.speedMult;
    this.player.damageMult        = classDef.damageMult;
    this.player.vrDropMult        = classDef.vrMult;
    this.player.weaponId          = weaponId;
    this.player.attackRange       = weaponDef.attackRange;
    this.player.specialCooldown   = weaponDef.specialCooldown;
    this.player.specialType       = weaponDef.specialType;
    this.player.hitAutoRanged     = weaponDef.hitAutoRanged;
    this.player.isRangedPrimary   = weaponDef.type === "ranged";
    this.player.comboHits         = (weaponDef.type === "melee" && weaponDef.hitDamages[2] === 0) ? 2 : 3;
    this.player.attackIntervalMs  = Math.round(220 / (weaponDef.attackSpeedMult ?? 1));
    this.player.autonomia         = run.autonomia ?? false;

    if (run.cameFrom === "copa") {
      this.player.energy = run.energy;
      this.player.sanity = run.sanity;
    } else {
      this.player.energy = classDef.maxEnergy;
      this.player.sanity = classDef.maxSanity;
    }
    this.player.vr = run.vr;
    reapplyAllPerks(this.player, run);

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.furnitureBodies);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

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
      switch (type) {
        case "burst_ranged":
          for (let i = 0; i < 2; i++)
            this.time.delayedCall(i * 100, () =>
              this.spawnProjectile({ x: fx + facing * 20, y: fy - 5, velX: facing * (def.rangedSpeed || 500), damage: def.rangedDamage || def.hitDamages[0] })
            );
          break;
        case "wide_sweep":
          this.resolveAttack(new Phaser.Geom.Rectangle(facing > 0 ? fx : fx - 100, fy - 24, 100, 48), 3);
          break;
        case "aerial_spike":
          this.resolveAttack(new Phaser.Geom.Rectangle(fx - 20, fy - 50, 40, 50), 3);
          if (this.player.body) (this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(-300);
          break;
        case "throw_weapon":
          this.spawnProjectile({ x: fx + facing * 20, y: fy - 10, velX: facing * 700, damage: def.hitDamages[1] * 2 });
          break;
        case "emp_pulse":
          [this.estagiarios, this.analistas, this.facilitadores, this.scrums, this.coordenadores, this.seniors].forEach(g =>
            g?.getChildren().forEach(e => (e as Phaser.Physics.Arcade.Sprite & { applyFreeze?: (ms: number) => void }).applyFreeze?.(1200))
          );
          break;
        case "heal_pulse":
          this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + Math.round(this.player.maxEnergy * 0.2));
          break;
        case "dash_strike":
          this.resolveAttack(new Phaser.Geom.Rectangle(fx + facing * 20 - 20, fy - 20, 80, 40), 3);
          break;
        case "clock_slow":
          [this.estagiarios, this.analistas, this.facilitadores, this.scrums, this.coordenadores, this.seniors].forEach(g =>
            g?.getChildren().forEach(e => (e as Phaser.Physics.Arcade.Sprite & { applySlowdown?: (ms: number) => void }).applySlowdown?.(2500))
          );
          break;
      }
    };

    // Enemy groups (no classType — entities added manually)
    this.estagiarios  = this.physics.add.group({ runChildUpdate: false });
    this.analistas    = this.physics.add.group({ runChildUpdate: false });
    this.facilitadores = this.physics.add.group({ runChildUpdate: false });
    this.scrums       = this.physics.add.group({ runChildUpdate: false });
    this.coordenadores = this.physics.add.group({ runChildUpdate: false });
    this.seniors      = this.physics.add.group({ runChildUpdate: false });
    this.postits      = this.physics.add.group();
    this.emails       = this.physics.add.group();
    this.inkProjectiles = this.physics.add.group();
    this.drops        = this.physics.add.group();

    if (run.openSpaceCleared === true) {
      this.bossDefeated = true;
      this.doorCopa.clearTint();
      this.doorLabel.setText("COPA").setColor("#c9a36a");
    } else {
      this.spawnEnemies();
    }

    // Colliders: enemy groups land on platform surfaces
    [this.estagiarios, this.analistas, this.facilitadores, this.scrums,
     this.coordenadores, this.seniors, this.drops].forEach(g =>
      this.physics.add.collider(g, this.platforms)
    );

    // Contact damage
    const contactDamage = (group: Phaser.Physics.Arcade.Group, dmg: (e: Phaser.Physics.Arcade.Sprite) => number) => {
      this.physics.add.overlap(this.player, group, (_p, eObj) => {
        if (this.player.isInvulnerable(this.time.now)) return;
        const e = eObj as Phaser.Physics.Arcade.Sprite;
        this.player.takeDamage(dmg(e), 4, e.x);
      });
    };
    contactDamage(this.estagiarios,  (e) => (e as EstagiarioDesesperado).contactDamage);
    contactDamage(this.scrums,       (e) => (e as ScrumMasterCaotico).contactDamage);
    contactDamage(this.coordenadores,(e) => (e as CoordenadorDeSinergia).contactDamage);
    contactDamage(this.seniors,      (e) => (e as AnalistaSeniorExausto).contactDamage);

    this.physics.add.overlap(this.player, this.postits, (_p, pObj) => {
      const p = pObj as PostIt;
      if (!p.active || this.player.isInvulnerable(this.time.now)) return;
      this.player.sanity = Math.max(0, this.player.sanity - p.sanityDamage);
      p.destroy();
    });

    this.physics.add.overlap(this.player, this.emails, (_p, eObj) => {
      const e = eObj as EmailProjectil;
      if (!e.active || this.player.isInvulnerable(this.time.now)) return;
      this.player.takeDamage(e.damage, 0);
      e.destroy();
    });

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

    const inkDmgGroups: [Phaser.Physics.Arcade.Group, number][] = [
      [this.estagiarios, 1], [this.analistas, 3], [this.facilitadores, 2],
      [this.scrums, 2], [this.coordenadores, 4], [this.seniors, 6],
    ];
    inkDmgGroups.forEach(([group, vrDrop]) => {
      this.physics.add.overlap(this.inkProjectiles, group, (inkObj, enemyObj) => {
        const ink = inkObj as Phaser.Physics.Arcade.Sprite;
        if (!ink.active) return;
        const enemy = enemyObj as Phaser.Physics.Arcade.Sprite & { hit?: (d: number, k: number) => boolean };
        if (!enemy.active || !enemy.hit) return;
        const dmg = (ink.getData("damage") as number) ?? 10;
        const piercing = (ink.getData("piercing") as boolean) ?? false;
        if (enemy.hit(Math.round(dmg * this.player.damageMult), 0)) {
          this.dropVR(enemy.x, enemy.y, Math.max(1, Math.round(vrDrop * this.player.vrDropMult)));
          enemy.destroy();
        }
        if (!piercing) ink.destroy();
      });
    });

    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      this.player.addVR(1);
      (dObj as Phaser.Physics.Arcade.Sprite).destroy();
    });

    // Copa door interaction zone
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    const doorZone = this.add.zone(this.doorCopa.x, this.doorCopa.y, 40, 60);
    this.physics.add.existing(doorZone, true);
    this.physics.add.overlap(this.player, doorZone, () => {
      if (!this.bossDefeated) return;
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.persist();
        const r = getRun(this);
        r.cameFrom = "openspace";
        r.nextScene = "Phase2Scene";
        this.scene.start("CopaScene");
      }
    });

    this.fx  = new SanityFx(this);
    this.hud = new Hud(this, LEVEL_WIDTH);
    this.hud.setPhaseTitle("FASE 1 — OPEN SPACE  [v2]");
    this.hud.setObjective("Derrote o Gerente e acesse a Copa");
  }

  private buildFloor(): void {
    this.add.tileSprite(LEVEL_WIDTH / 2, FLOOR_Y + 8, LEVEL_WIDTH, 16, "tex-floor").setDepth(8);
    const fp = this.add.rectangle(LEVEL_WIDTH / 2, FLOOR_Y + 8, LEVEL_WIDTH, 16, 0, 0);
    this.physics.add.existing(fp, true);
    this.platforms.add(fp);
  }

  /**
   * Builds a furniture platform with a solid-color body (no stretched texture).
   * surfY: Y coordinate of the platform top surface.
   * tiles: number of 32-px wide tiles.
   */
  private buildPlatform(x: number, surfY: number, tiles: number): void {
    const w = tiles * 32;
    const bodyTop = surfY + 7;
    const bodyH = FLOOR_Y - bodyTop;
    const bodyMidY = bodyTop + bodyH / 2;

    // Solid dark-wood body — avoids the rainbow stretched-texture bug
    const g = this.add.graphics();
    g.fillStyle(0x5c3318, 1);
    g.fillRect(x, bodyTop, w, bodyH);
    g.lineStyle(1, 0x2e1a0c, 1);
    g.strokeRect(x, bodyTop, w, bodyH);
    g.setDepth(6);

    // Surface tiles from atlas (tile-platform, 32×16 each)
    for (let i = 0; i < tiles; i++) {
      this.add.image(x + i * 32 + 16, surfY, "sprites", "tile-platform")
        .setDisplaySize(32, 14).setDepth(9);
    }

    // Subtle drop shadow on the floor
    this.add.rectangle(x + w / 2, FLOOR_Y + 3, w + 8, 7, 0x000000, 0.28).setDepth(5);

    // Physics: surface (enemies + player land on it)
    const surf = this.add.rectangle(x + w / 2, surfY, w, 14, 0, 0);
    this.physics.add.existing(surf, true);
    this.platforms.add(surf);

    // Physics: furniture column (player-only — enemies walk freely)
    const body = this.add.rectangle(x + w / 2, bodyMidY, w, bodyH, 0, 0);
    this.physics.add.existing(body, true);
    this.furnitureBodies.add(body);
  }

  private spawnEnemies(): void {
    [380, 560, 700].forEach(x => {
      const e = new EstagiarioDesesperado(this, x, FLOOR_Y - 40, Math.random() > 0.5 ? 1 : -1);
      this.estagiarios.add(e);
    });

    [820, 1020].forEach(x => {
      const f = new FacilitadorDeWorkshop(this, x, FLOOR_Y - 60);
      f.target = this.player;
      f.onShoot = (fx, fy, tx, ty) => {
        const p = new PostIt(this, fx, fy);
        this.postits.add(p);
        p.fire(tx, ty);
      };
      this.facilitadores.add(f);
    });

    const scrum = new ScrumMasterCaotico(this, 950, FLOOR_Y - 60);
    scrum.target = this.player;
    scrum.onShout = (fromX) => {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, fromX, this.player.y) < 260) {
        const dir = fromX < this.player.x ? -1 : 1;
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(dir * -220);
      }
    };
    this.scrums.add(scrum);

    [1150, 1250, 1400].forEach(x => {
      const a = new AnalistaJunior(this, x, FLOOR_Y - 60);
      a.target = this.player;
      this.analistas.add(a);
    });

    [1500, 1700].forEach(x => {
      const e = new EstagiarioDesesperado(this, x, FLOOR_Y - 40, Math.random() > 0.5 ? 1 : -1);
      this.estagiarios.add(e);
    });

    const coord = new CoordenadorDeSinergia(this, 1620, FLOOR_Y - 60);
    coord.target = this.player;
    this.coordenadores.add(coord);

    const sr = new AnalistaSeniorExausto(this, 1700, FLOOR_Y - 60);
    sr.target = this.player;
    this.seniors.add(sr);

    const boss = new GerenteMicrogestor(this, 1820, FLOOR_Y - 60);
    boss.target = this.player;
    boss.onActivate = () => {
      this.hud.showBoss("Gerente Microgestor", boss.maxHp);
      this.hud.setObjective("Derrote o Gerente Microgestor!");
    };
    boss.onHpChange = (hp) => this.hud.updateBoss(hp);
    boss.onShoot = (fx, fy, tx, ty) => {
      const e = new EmailProjectil(this, fx, fy);
      this.emails.add(e);
      e.fire(tx, ty);
    };
    boss.onPull = (targetX) => {
      const dir = targetX > this.player.x ? 1 : -1;
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(dir * 360);
    };
    boss.onFreeze = (ms) => this.player.applyFreeze(ms);
    boss.onSpawn = (x, y) => {
      const e = new EstagiarioDesesperado(this, x, y, Math.random() > 0.5 ? 1 : -1);
      this.estagiarios.add(e);
      this.physics.add.collider(e, this.platforms);
    };
    boss.onPhase2 = () => {
      this.hud.setObjective("FASE 2 — Deadline Inadiavel!");
      const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0.35)
        .setScrollFactor(0).setDepth(990);
      this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
    };
    boss.onDied = () => this.handleBossDefeat(boss);
    this.boss = boss;
    this.physics.add.collider(boss, this.platforms);

    this.physics.add.overlap(this.inkProjectiles, boss, (inkObj) => {
      const ink = inkObj as Phaser.Physics.Arcade.Sprite;
      if (!ink.active || !this.boss?.active) return;
      const dmg = (ink.getData("damage") as number) ?? 10;
      const piercing = (ink.getData("piercing") as boolean) ?? false;
      this.boss.hit(Math.round(dmg * this.player.damageMult), 0);
      if (!piercing) ink.destroy();
    });
  }

  private handleBossDefeat(boss: GerenteMicrogestor): void {
    this.bossDefeated = true;
    getRun(this).openSpaceCleared = true;
    this.hud.hideBoss();
    this.hud.setObjective("Copa desbloqueada! Use [ E ] na porta.");

    const dropsPerTick = Math.max(1, Math.round(this.player.vrDropMult));
    for (let i = 0; i < 18; i++) {
      this.time.delayedCall(i * 60, () => {
        if (!boss.active) this.dropVR(boss.x + Phaser.Math.Between(-70, 70), boss.y - 20, dropsPerTick);
      });
    }
    boss.destroy();

    const run = getRun(this);
    run.autonomia = true;
    this.player.autonomia = true;
    savePersisted(run.reconhecimento, run.fgts, run.loopCount);

    this.doorCopa.clearTint();
    this.doorLabel.setText("COPA").setColor("#c9a36a");

    const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30,
      "GERENTE DERROTADO!\n\nPerk: AUTONOMIA ativado\n\nPorta da Copa desbloqueada ->",
      { fontFamily: "monospace", fontSize: "15px", color: "#f2c14e",
        stroke: "#000000", strokeThickness: 3, align: "center" })
      .setOrigin(0.5).setScrollFactor(0).setDepth(999);
    this.tweens.add({ targets: msg, alpha: 0, duration: 900, delay: 4500, onComplete: () => msg.destroy() });
  }

  private persist(): void {
    const r = getRun(this);
    r.energy    = this.player.energy;
    r.sanity    = this.player.sanity;
    r.vr        = this.player.vr;
    r.autonomia = this.player.autonomia;
  }

  private resolveAttack(hb: Phaser.Geom.Rectangle, step: number): void {
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
    if (step >= comboHits) this.cameras.main.shake(80, 0.006);

    const tryHit = (s: Phaser.Physics.Arcade.Sprite) =>
      Phaser.Geom.Intersects.RectangleToRectangle(hb, s.getBounds());

    const hitGroup = (
      group: Phaser.Physics.Arcade.Group,
      vrDrop: number,
      cast: (c: Phaser.GameObjects.GameObject) => Phaser.Physics.Arcade.Sprite & { hit: (d: number, k: number) => boolean; applySlowdown?: (ms: number) => void },
    ) => {
      group.getChildren().forEach(c => {
        const e = cast(c);
        if (!e.active || !tryHit(e)) return;
        if (slowMs > 0 && e.applySlowdown) e.applySlowdown(slowMs);
        const dmgText = this.add.text(e.x, e.y - 20, `-${damage}`, {
          fontFamily: "monospace", fontSize: "11px", fontStyle: "bold",
          color: step >= comboHits ? "#ff4444" : "#ffcc44",
          stroke: "#000000", strokeThickness: 2,
        }).setOrigin(0.5).setDepth(600);
        this.tweens.add({ targets: dmgText, y: dmgText.y - 28, alpha: 0, duration: 500, onComplete: () => dmgText.destroy() });
        if (e.hit(damage, knockback)) {
          this.dropVR(e.x, e.y, Math.max(1, Math.round(vrDrop * this.player.vrDropMult)));
          this.tweens.add({ targets: e, scaleX: 1.6, scaleY: 0.2, alpha: 0, duration: 120, onComplete: () => e.destroy() });
          e.setActive(false);
        }
      });
    };

    hitGroup(this.estagiarios,   1, c => c as EstagiarioDesesperado);
    hitGroup(this.analistas,     3, c => c as AnalistaJunior);
    hitGroup(this.facilitadores, 2, c => c as FacilitadorDeWorkshop);
    hitGroup(this.scrums,        2, c => c as ScrumMasterCaotico);
    hitGroup(this.coordenadores, 4, c => c as CoordenadorDeSinergia);
    hitGroup(this.seniors,       6, c => c as AnalistaSeniorExausto);

    if (this.boss?.active && tryHit(this.boss)) {
      const dmgText = this.add.text(this.boss.x, this.boss.y - 20, `-${damage}`, {
        fontFamily: "monospace", fontSize: "11px", fontStyle: "bold",
        color: step >= comboHits ? "#ff4444" : "#ffcc44", stroke: "#000000", strokeThickness: 2,
      }).setOrigin(0.5).setDepth(600);
      this.tweens.add({ targets: dmgText, y: dmgText.y - 28, alpha: 0, duration: 500, onComplete: () => dmgText.destroy() });
      this.boss.hit(damage, knockback);
    }
  }

  private spawnProjectile(opts: {
    x: number; y: number; velX: number; velY?: number;
    damage: number; piercing?: boolean; bounces?: number; homing?: boolean;
  }) {
    const ink = this.inkProjectiles.create(opts.x, opts.y, "tex-inkproj") as Phaser.Physics.Arcade.Sprite;
    const body = ink.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(opts.velX, opts.velY ?? 0);
    ink.setData("damage", opts.damage);
    ink.setData("piercing", opts.piercing ?? false);
    ink.setData("bounces", opts.bounces ?? 0);
    ink.setData("homing", opts.homing ?? false);
    ink.setData("lifetime", this.time.now + 4000);
    return ink;
  }

  private dropVR(x: number, y: number, count = 1): void {
    for (let i = 0; i < count; i++) {
      const d = this.drops.create(x + (i - count / 2) * 8, y - 10, "tex-vr") as Phaser.Physics.Arcade.Sprite;
      d.setDepth(8);
      const body = d.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Phaser.Math.Between(-120, 120), Phaser.Math.Between(-260, -160));
      body.setBounce(0.4);
      body.setDrag(120, 0);
    }
  }

  update(time: number, delta: number) {
    this.player.update(time, delta);
    this.player.tickPassive(time);

    // Homing projectile steering
    this.inkProjectiles.getChildren().forEach(obj => {
      const ink = obj as Phaser.Physics.Arcade.Sprite;
      if (!ink.active) return;
      const lifetime = ink.getData("lifetime") as number;
      if (lifetime && lifetime < time) { ink.destroy(); return; }
      if (!ink.getData("homing")) return;
      const allEnemies: Phaser.Physics.Arcade.Sprite[] = [];
      [this.estagiarios, this.analistas, this.facilitadores, this.scrums, this.coordenadores, this.seniors].forEach(g =>
        g?.getChildren().forEach(e => allEnemies.push(e as Phaser.Physics.Arcade.Sprite))
      );
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

    // AnalistaJunior melee hitbox
    this.analistas.getChildren().forEach(c => {
      const a = c as AnalistaJunior;
      if (a.swingActive && a.swingHitbox &&
          Phaser.Geom.Intersects.RectangleToRectangle(a.swingHitbox, this.player.getBounds())) {
        this.player.takeDamage(a.swingDamage, 6, a.x);
        a.swingActive = false;
        a.swingHitbox = null;
      }
    });

    // AnalistaSenior melee hitbox
    this.seniors.getChildren().forEach(c => {
      const sr = c as AnalistaSeniorExausto;
      if (sr.swingActive && sr.swingHitbox && !this.player.isInvulnerable(time) &&
          Phaser.Geom.Intersects.RectangleToRectangle(sr.swingHitbox, this.player.getBounds())) {
        this.player.takeDamage(sr.swingDamage, 3, sr.x);
        sr.swingActive = false;
        sr.swingHitbox = null;
      }
    });

    // Boss melee + walk contact
    if (this.boss?.active) {
      if (this.boss.swingActive && this.boss.swingHitbox && !this.player.isInvulnerable(time) &&
          Phaser.Geom.Intersects.RectangleToRectangle(this.boss.swingHitbox, this.player.getBounds())) {
        this.player.takeDamage(this.boss.swingDamage, 5, this.boss.x);
        this.boss.swingActive = false;
        this.boss.swingHitbox = null;
      }
      if (!this.player.isInvulnerable(time) &&
          Phaser.Geom.Intersects.RectangleToRectangle(this.boss.getBounds(), this.player.getBounds())) {
        this.player.takeDamage(this.boss.contactDamage, 3, this.boss.x);
      }
    }

    this.fx.update(time, this.player.sanity);

    const nearDoor = this.bossDefeated &&
      Phaser.Math.Distance.Between(this.player.x, this.player.y, this.doorCopa.x, this.doorCopa.y) < 40;

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
      interactHint: nearDoor ? "[ E ]  Entrar na Copa" : undefined,
      dashCooldown: this.player.getDashCooldownRatio(time),
    });
  }
}
