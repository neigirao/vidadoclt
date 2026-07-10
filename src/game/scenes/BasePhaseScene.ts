import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { HUD_BOT_Y, HUD_TOP_H, Hud } from "../systems/Hud";
import { TutorialPrompts } from "../systems/TutorialPrompts";
import {
  addPhaseAmbience,
  addPhaseBackground,
  addPhaseDecor,
  addPhaseParticles,
  addThemedFloorDecor,
} from "../systems/Background";
import { resolveSprite } from "../systems/SpriteLibrary";
import { PLAT_DEFS } from "../systems/TextureFactory";
import { Player } from "../entities/Player";
import { getRun, savePersisted } from "../systems/PlayerState";
import {
  CLASSES,
  WEAPONS,
  WEAPON_ICONS,
  WeaponId,
  ClassId,
  WeaponDef,
} from "../systems/WeaponSystem";
import { SanityFx } from "../systems/SanityFx";
import { reapplyAllPerks } from "../systems/PerkSystem";
import { CulturaId, reapplyAllCulturas, selectableCulturaIds } from "../systems/CulturaSystem";
import { CombatFx } from "../systems/CombatFx";
import { Sfx } from "../systems/AudioSystem";
import { Telemetry } from "../systems/Telemetry";
import { Music } from "../systems/MusicSystem";
import { validateLevel, logLevelReport, drawLevelOverlay } from "../systems/LevelValidator";
import { resolveMeleeAttack, MeleeHost } from "../systems/MeleeCombat";
import { GameEnemy, BossEntity } from "../entities/types";
import { BossPresence } from "../systems/BossPresence";
import { ThreatMarkers, ThreatType } from "../systems/ThreatMarkers";

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
  /** Armas largadas no chão — pegar com E (troca/adiciona ao slot secundário). */
  protected weaponPickups: { weaponId: WeaponId; obj: Phaser.GameObjects.Container }[] = [];
  private nearestPickup?: { weaponId: WeaponId; obj: Phaser.GameObjects.Container };
  /** Cafezinhos — pickup que restaura Sanidade (contra-jogo do Burnout). */
  protected sanityDrops!: Phaser.Physics.Arcade.Group;
  protected boss?: BossEntity;
  protected bossPresence?: BossPresence;
  protected threatMarkers?: ThreatMarkers;
  private _bossMaxHp = 0;
  private _bossEnraged = false;
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
  /** RNG semeado por (seed, fase) — usado p/ variar encontros por run. */
  protected rng!: Phaser.Math.RandomDataGenerator;
  private _layoutVariant = 0;

  /**
   * Seleção determinística de `count` posições de um pool de candidatos, por
   * seed. Mantém a CONTAGEM fixa (não desregula o LevelValidator) mas varia
   * QUAIS posições/densidade a cada run. Retorna ordenado.
   */
  protected pickPositions(candidates: number[], count: number): number[] {
    const shuffled = this.rng.shuffle([...candidates]);
    return shuffled.slice(0, count).sort((a, b) => a - b);
  }

  // --- Abstract methods ---
  protected abstract getBgKey(): string;
  protected abstract getPhaseTitle(): string;
  protected getPhaseNumber(): 1 | 2 | 3 | 4 | 5 | null {
    return null;
  }
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
  protected onEnemyKilledByMelee(_e: GameEnemy): void {}
  protected onEnemyKilledByProjectile(_e: GameEnemy): void {}
  /** Drena sanidade passiva no update? A Fase 1 desativa no evento HOME OFFICE. */
  protected sanityDrainEnabled(): boolean {
    return true;
  }

  /**
   * Instancia o Player e aplica todo o wiring compartilhado por TODAS as fases:
   * stats de classe, arma, upgrades permanentes, energia/sanidade, perks/culturas,
   * colliders com o cenário, câmera e os callbacks comuns (onDeath, onAttack,
   * onRangedAttack). Callbacks que divergem por fase (onSpecialAttack, onParry,
   * sinergias, heat) ficam a cargo de quem chama, DEPOIS deste método.
   */
  protected buildPlayer(run: ReturnType<typeof getRun>, spawnX: number): void {
    const classDef = CLASSES[(run.characterClass ?? "analista") as ClassId];
    const weaponId = (run.weaponId ?? classDef.startWeapon) as WeaponId;
    const weaponDef = WEAPONS[weaponId] ?? WEAPONS[classDef.startWeapon];

    this.player = new Player(this, spawnX, FLOOR_Y - 60);

    this.player.maxEnergy = classDef.maxEnergy + (run.upgMaxEnergy ?? 0);
    this.player.maxSanity = classDef.maxSanity + (run.upgMaxSanity ?? 0);
    this.player.walkSpeed = 200 * classDef.speedMult;
    this.player.damageMult = classDef.damageMult;
    this.player.vrDropMult = classDef.vrMult + (run.upgVrDropMult ?? 0);
    this.player.parryWindowBonus = run.upgParryWindowBonus ?? 0;
    this.player.weaponId = weaponId;
    this.player.attackRange = weaponDef.attackRange;
    this.player.specialCooldown = weaponDef.specialCooldown;
    this.player.specialType = weaponDef.specialType;
    this.player.hitAutoRanged = weaponDef.hitAutoRanged;
    this.player.isRangedPrimary = weaponDef.type === "ranged";
    this.player.comboHits = weaponDef.type === "melee" && weaponDef.hitDamages[2] === 0 ? 2 : 3;
    this.player.attackIntervalMs = Math.round(220 / (weaponDef.attackSpeedMult ?? 1));
    this.player.autonomia = run.autonomia ?? false;
    this.player.specialCooldownMult = run.upgSpecialCooldownMult ?? 1.0;
    this.player.dashCooldownBonus = run.upgDashCooldownBonus ?? 0;
    this.player.damageReductionMult = run.upgDamageReductionMult ?? 1.0;
    this.player.parryEnergyRestore = run.upgParryEnergyRestore ?? 0;
    this.player.parryVrDrop = run.upgParryVrDrop ?? 0;
    if ((run.upgComboHitsBonus ?? 0) >= 1) this.player.comboHits = 4;

    // 2ª arma (slot secundário, troca com Q). onSecondarySwap refaz os stats
    // do jogador para a arma agora ativa e persiste no run.
    this.player.secondaryWeaponId = run.secondaryWeaponId ?? null;
    this.player.onSecondarySwap = () => {
      this.applyWeaponStats(this.player.weaponId as WeaponId);
      const r = getRun(this);
      r.weaponId = this.player.weaponId;
      r.secondaryWeaponId = this.player.secondaryWeaponId;
      this.updateSecondaryHud();
      Sfx.buy();
    };

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
    // Ramificação de rotas (#1): modificador leve da rota escolhida pós-Fase 1.
    if (run.route === "comercial") this.player.vrDropMult *= 1.2;
    else if (run.route === "atendimento") this.player.maxSanity += 25;
    // 2ª bifurcação (pós-Fase 2): Produto (dano) / Tecnologia (dash).
    if (run.route2 === "produto") this.player.damageMult *= 1.15;
    else if (run.route2 === "tecnologia") this.player.dashCooldownBonus += 250;

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

    // Combate canônico (MeleeCombat): janela ativa com dedup por swingId —
    // todas as fases ganham a hitbox persistente da Fase 1 corretamente.
    this.player.onAttack = (hb, step, swingId, firstFrame) =>
      this.resolveAttack(hb, step, swingId, firstFrame);

    this.player.onRangedAttack = (fx, fy, facing) => {
      const def = WEAPONS[this.player.weaponId as WeaponId] ?? WEAPONS.grampeador;
      this.spawnProjectile({
        x: fx + facing * 20,
        y: fy - 5,
        velX: facing * (def.rangedSpeed || 500),
        damage: def.rangedDamage || def.hitDamages[0],
        piercing: def.rangedPiercing,
        bounces: def.rangedBounce,
        homing: def.rangedHoming,
      });
    };
  }

  // --- Blocos de create() compartilhados (chamados por Base e pela Fase 1) ---

  protected setupWorldAndCamera(): void {
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.bg);
  }

  /** Parry "Reclamar": congela o inimigo mais próximo + burst dourado. */
  protected wireParryReclamar(): void {
    this.player.onParrySuccess = (_fromX: number) => {
      let closest: (Phaser.Physics.Arcade.Sprite & { frozenUntil?: number }) | null = null;
      let closestDist = 160;
      for (const gDef of this.enemyGroups) {
        gDef.group.getChildren().forEach((c) => {
          const e = c as Phaser.Physics.Arcade.Sprite & { frozenUntil?: number };
          if (!e.active) return;
          const d = Math.abs(e.x - this.player.x);
          if (d < closestDist) {
            closestDist = d;
            closest = e;
          }
        });
      }
      if (closest) {
        const e = closest as Phaser.Physics.Arcade.Sprite & { frozenUntil?: number };
        e.frozenUntil = this.time.now + 800;
        e.setTint(0x00ffdd);
        this.time.delayedCall(800, () => {
          if (e.active) e.clearTint();
        });
      }
      const burst = this.add
        .text(this.player.x, this.player.y - 40, "RECLAMEI!", {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#ffdd00",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(200);
      this.tweens.add({
        targets: burst,
        y: burst.y - 30,
        alpha: 0,
        duration: 700,
        onComplete: () => burst.destroy(),
      });
    };
  }

  protected setupPauseKey(): void {
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => {
      this.scene.pause();
      this.scene.launch("PauseScene", { caller: this.scene.key });
    });
  }

  /** Valida a fase montada (só DEV) e liga o overlay de debug na tecla V. */
  protected installLevelDebug(spec: Parameters<typeof validateLevel>[0], label: string): void {
    if (!import.meta.env.DEV) return;
    const report = validateLevel(spec);
    logLevelReport(label, report);
    let overlay: Phaser.GameObjects.Container | undefined;
    this.input.keyboard?.on("keydown-V", () => {
      if (overlay) {
        overlay.destroy();
        overlay = undefined;
      } else overlay = drawLevelOverlay(this, spec, report);
    });
  }

  create() {
    const run = getRun(this);
    this.platIdx = 0;
    this.startTimeMs = this.time.now;
    this.bossDefeated = false;
    this.enemyGroups = [];
    this.rng = new Phaser.Math.RandomDataGenerator([run.seed ?? "CLT", this.scene.key]);
    Music.start("office");

    // 1. World bounds, camera, background
    this.setupWorldAndCamera();
    addPhaseBackground(this, this.getBgKey(), HUD_TOP_H, FLOOR_Y);
    const pn = this.getPhaseNumber();
    if (pn !== null) {
      addPhaseDecor(this, pn, FLOOR_Y);
      addThemedFloorDecor(this, pn, FLOOR_Y); // prop de chão próprio da fase
    }
    addPhaseAmbience(this, HUD_TOP_H, FLOOR_Y); // poeira + luzes falhando
    if (pn !== null) addPhaseParticles(this, pn, HUD_TOP_H, FLOOR_Y); // partículas da fase
    Telemetry.phaseEnter(this.scene.key);

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
      layout = layout.map(
        ([x, y, tiles]) => [LEVEL_WIDTH - x, y, tiles] as [number, number, number],
      );
    } else if (layoutVariant === 2) {
      const ys = layout.map(([, y]) => y);
      const hi = Math.min(...ys),
        lo = Math.max(...ys);
      layout = layout.map(
        ([x, y, tiles], i) =>
          [x, i % 2 === 0 ? (y === hi ? lo : hi) : y, tiles] as [number, number, number],
      );
    }
    this._layoutVariant = layoutVariant;
    for (const [x, y, tiles] of layout) {
      this.buildPlatform(x, y, tiles);
    }

    // 3. Door
    const doorCfg = this.getDoorConfig();
    this.doorEl = this.add.image(doorCfg.x, FLOOR_Y - 30, "tex-door");
    this.doorEl.setTint(doorCfg.tint);
    this.doorLabel = this.add
      .text(doorCfg.x, FLOOR_Y - 72, doorCfg.label, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#666666",
        align: "center",
      })
      .setOrigin(0.5);

    // 4. Player setup (bloco idêntico compartilhado com a Fase 1 — ver buildPlayer)
    const spawnX = run.cameFrom === "copa" ? 120 : 80;
    this.buildPlayer(run, spawnX);

    // 5. Player callbacks específicos da cena base (special + parry)
    this.player.onSpecialAttack = (type, fx, fy, facing) => {
      const def = WEAPONS[this.player.weaponId as WeaponId] ?? WEAPONS.grampeador;
      this.handleSpecial(type, fx, fy, facing, def);
    };

    // Parry "Reclamar" — stun nearest enemy, gold burst VFX
    this.wireParryReclamar();

    // 6. Projectile + drop groups
    this.inkProjectiles = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group();
    this.drops = this.physics.add.group();
    this.sanityDrops = this.physics.add.group();

    // 7. FX + HUD — BEFORE setupEnemiesAndGroups
    this.fx = new SanityFx(this);
    this.hud = new Hud(this, LEVEL_WIDTH);
    this.combatFx = new CombatFx(this);
    // Reflete a arma/especial equipados no HUD (ícone + nome).
    {
      const wdef = WEAPONS[this.player.weaponId as WeaponId] ?? WEAPONS.grampeador;
      this.hud.setWeapon(`${WEAPON_ICONS[wdef.id]} ${wdef.name}`);
      this.hud.setSpecial(wdef.specialName);
      this.updateSecondaryHud();
    }

    // 8. Subclass populates this.enemyGroups and this.boss
    this.setupEnemiesAndGroups();

    // 8-marks. Marcadores de leitura de ameaça (!/♦/+) por arquétipo, acima dos
    // inimigos que os declaram (threatType). Rushers básicos ficam sem marcador.
    this.threatMarkers = new ThreatMarkers(this);
    for (const def of this.enemyGroups) {
      def.group.getChildren().forEach((obj) => {
        const e = obj as Phaser.GameObjects.Sprite & { threatType?: ThreatType };
        if (e.threatType) this.threatMarkers!.add(e, e.threatType);
      });
    }

    // 8a. Loop HP scaling — each completed loop adds 15% HP to all enemies.
    // New Game+ "Quinta-feira" (run.ngPlus): +40% de HP por cima de tudo.
    const loopCount = run.loopCount ?? 0;
    const ngMult = run.ngPlus ? 1.4 : 1;
    if (loopCount > 0 || run.ngPlus) {
      const mult = (1 + loopCount * 0.15) * ngMult;
      for (const def of this.enemyGroups) {
        def.group.getChildren().forEach((obj) => {
          const e = obj as GameEnemy;
          if (typeof e.hp === "number") e.hp = Math.round(e.hp * mult);
          if (typeof e.maxHp === "number") e.maxHp = Math.round(e.maxHp * mult);
        });
      }
      if (this.boss) {
        this.boss.hp = Math.round(this.boss.hp * mult);
        if (this.boss.maxHp !== undefined) this.boss.maxHp = Math.round(this.boss.maxHp * mult);
      }
    }

    // Pulinho ao travar de lado num móvel (chão): sem isso o perseguidor
    // encalha atrás da mesa fora da câmera. Espelha OpenSpaceV2.hopOverFurniture.
    const hopOverFurniture: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (eObj) => {
      const e = eObj as Phaser.Physics.Arcade.Sprite;
      const body = e.body as Phaser.Physics.Arcade.Body;
      if (!body || !body.blocked.down) return;
      if (!(body.blocked.left || body.blocked.right)) return;
      const now = this.time.now;
      if (now < ((e.getData("nextHop") as number) ?? 0)) return;
      body.setVelocityY(-320);
      e.setData("nextHop", now + 500);
    };

    // 9. Boss wiring
    if (this.boss) {
      const bossMaxHp = this.boss.maxHp ?? this.boss.hp;
      this._bossMaxHp = bossMaxHp;
      this.hud.showBoss(this.getBossName(), bossMaxHp);
      Sfx.bossAppear();
      Music.start("boss");
      this.boss.onHpChange = (hp: number) => this.hud.updateBoss(hp);
      const bossSprite = this.boss as Phaser.Physics.Arcade.Sprite;
      this.physics.add.collider(bossSprite, this.platforms);
      this.physics.add.collider(bossSprite, this.furnitureBodies, hopOverFurniture);
    }

    // 10. Enemy group platform colliders (filter !aerial) + drops collider.
    // Inimigos de chão respeitam mesas/móveis (antes atravessavam) e dão um
    // pulinho quando travam de lado (hopOverFurniture) para não encalhar.
    for (const def of this.enemyGroups) {
      if (!def.aerial) {
        this.physics.add.collider(def.group, this.platforms);
        this.physics.add.collider(def.group, this.furnitureBodies, hopOverFurniture);
      }
    }
    this.physics.add.collider(this.drops, this.platforms);
    this.physics.add.collider(this.sanityDrops, this.platforms);

    // 10b. Separação entre inimigos de chão (não-aéreos): evita empilhamento no
    // mesmo ponto. Só resolve a sobreposição; a IA re-aplica a velocidade.
    const groundGroups = this.enemyGroups.filter((d) => !d.aerial).map((d) => d.group);
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
          const e = eObj as GameEnemy;
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
        const enemy = enemyObj as Phaser.Physics.Arcade.Sprite & {
          hit?: (d: number, k: number) => boolean;
        };
        if (!enemy.active || !enemy.hit) return;
        const dmg = (ink.getData("damage") as number) ?? 10;
        const piercing = (ink.getData("piercing") as boolean) ?? false;
        const died = enemy.hit(Math.round(dmg * this.player.damageMult), 0);
        if (!piercing) ink.destroy();
        if (died) {
          this.dropVR(enemy.x, enemy.y, Math.max(1, Math.round(vrDrop * this.player.vrDropMult)));
          this.rollSanityDrop(enemy.x, enemy.y);
          this.rollWeaponDrop(enemy.x, enemy.y);
          enemy.destroy();
          this.onEnemyKilledByProjectile(enemy);
        }
      });
    }

    // 15. Ink projectiles → boss
    if (this.boss) {
      const bossRef = this.boss;
      this.physics.add.overlap(
        this.inkProjectiles,
        bossRef as Phaser.Physics.Arcade.Sprite,
        (inkObj) => {
          const ink = inkObj as Phaser.Physics.Arcade.Sprite;
          if (!ink.active || !bossRef.active) return;
          const dmg = (ink.getData("damage") as number) ?? 10;
          const piercing = (ink.getData("piercing") as boolean) ?? false;
          const died = bossRef.hit(Math.round(dmg * this.player.damageMult), 0);
          if (!piercing) ink.destroy();
          if (died) this.handleBossDefeat();
        },
      );
    }

    // 16. Player → drops
    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      const spr = dObj as Phaser.Physics.Arcade.Sprite;
      if (!spr.active) return; // evita som/duplo-pickup no mesmo frame
      this.player.addVR(1);
      TutorialPrompts.maybeShow(
        this,
        "vr",
        "VR (Vale Refeição) é sua moeda. Junte e gaste na Copa.",
      );
      Sfx.vrPickup();
      spr.destroy();
    });

    // 16b. Player → cafezinhos (restaura Sanidade — contra-jogo do Burnout)
    this.wireSanityDropPickup();

    // 17. ESC → PauseScene
    this.setupPauseKey();

    // 18. Interact key + door zone
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    const doorZone = this.add.zone(this.doorEl.x, this.doorEl.y, 40, 60);
    this.physics.add.existing(doorZone, true);
    this.physics.add.overlap(this.player, doorZone, () => {
      if (!this.bossDefeated) return;
      if (
        Phaser.Input.Keyboard.JustDown(this.interactKey) ||
        this.player.gamepadInteractJustPressed
      ) {
        this.persist();
        Sfx.doorOpen();
        const r = getRun(this);
        r.cameFrom = doorCfg.cameFrom;
        if (doorCfg.nextScene) {
          r.nextScene = doorCfg.nextScene;
          this.cameras.main.fadeOut(
            300,
            0,
            0,
            0,
            (_cam: Phaser.Cameras.Scene2D.Camera, t: number) => {
              if (t === 1) this.scene.start(doorCfg.destScene);
            },
          );
        } else {
          this.cameras.main.fadeOut(
            300,
            0,
            0,
            0,
            (_cam: Phaser.Cameras.Scene2D.Camera, t: number) => {
              if (t === 1) this.scene.start(doorCfg.destScene);
            },
          );
        }
      }
    });

    // 19. HUD phase title + objective
    this.hud.setPhaseTitle(this.getPhaseTitle());
    this.hud.setObjective(this.getInitialObjective());

    // 20. Cartão de transição / loop temporal — reforça a contagem até as 18h.
    this.showPhaseIntroCard();

    // 21. Validação de fase (só DEV) + overlay com a tecla V.
    this.installLevelDebug(
      {
        label: this.getPhaseTitle(),
        seedVariant: this._layoutVariant,
        floorY: FLOOR_Y,
        ceilingY: HUD_TOP_H,
        levelWidth: LEVEL_WIDTH,
        playerSpawn: { x: spawnX, y: FLOOR_Y - 60 },
        jumpVel: -520,
        gravity: 1200,
        platforms: this.platforms,
        furniture: this.furnitureBodies,
        enemies: this.enemyGroups.map((d) => d.group),
        boss: this.boss,
        expectBoss: this.getBossName() !== "",
        exit: { x: this.doorEl.x, y: this.doorEl.y },
      },
      `${this.getPhaseTitle()} (layout ${this._layoutVariant})`,
    );
  }

  update(time: number, delta: number) {
    // 1. Player update
    this.player.update(time, delta);
    if (this.sanityDrainEnabled()) this.player.tickPassive(time);

    // 2. Subclass phase logic
    this.onPhaseUpdate(time, delta);

    // 3. Collect all enemies for homing ink logic
    const allEnemies: Phaser.Physics.Arcade.Sprite[] = [];
    for (const def of this.enemyGroups) {
      def.group.getChildren().forEach((e) => allEnemies.push(e as Phaser.Physics.Arcade.Sprite));
    }

    // Homing ink projectile logic (lifetime + homing)
    this.inkProjectiles.getChildren().forEach((obj) => {
      const ink = obj as Phaser.Physics.Arcade.Sprite;
      if (!ink.active) return;
      const lifetime = ink.getData("lifetime") as number;
      if (lifetime && lifetime < time) {
        ink.destroy();
        return;
      }
      if (!ink.getData("homing")) return;
      const nearest = allEnemies
        .filter((e) => e.active)
        .sort(
          (a, b) =>
            Phaser.Math.Distance.Between(ink.x, ink.y, a.x, a.y) -
            Phaser.Math.Distance.Between(ink.x, ink.y, b.x, b.y),
        )[0];
      if (nearest) {
        const ibody = ink.body as Phaser.Physics.Arcade.Body;
        const angle = Phaser.Math.Angle.Between(ink.x, ink.y, nearest.x, nearest.y);
        ibody.setVelocity(Math.cos(angle) * 480, Math.sin(angle) * 480);
      }
    });

    // 4. Boss contact damage + HUD update
    if (this.boss?.active) {
      this.bossPresence?.update(delta);
      // Momento de enrage: 1ª vez que o boss cai abaixo de 35% de HP → beat
      // legível (aprendizado do Lovable). Genérico p/ todos os 5 bosses.
      if (!this._bossEnraged && this._bossMaxHp > 0 && this.boss.hp <= this._bossMaxHp * 0.35) {
        this._bossEnraged = true;
        this.playBossEnrageMoment(this.boss.x, this.boss.y);
      }
      if (
        !this.player.isInvulnerable(time) &&
        Phaser.Geom.Intersects.RectangleToRectangle(
          (this.boss as Phaser.Physics.Arcade.Sprite).getBounds(),
          this.player.getBounds(),
        )
      ) {
        this.player.takeDamage(this.boss.contactDamage, 3, this.boss.x);
      }
      this.hud.updateBoss(this.boss.hp);
    }

    // 5. Sanity FX
    this.fx.update(time, this.player.sanity);

    // 6. Marcadores de ameaça + weapon pickups + near-door check
    this.threatMarkers?.update();
    this.updateWeaponPickups();
    const nearDoor =
      this.bossDefeated &&
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
      interactHint: nearDoor
        ? `[ E ]  ${this.getDoorConfig().nearLabel}`
        : this.nearestPickup
          ? `[ E ]  Pegar ${WEAPONS[this.nearestPickup.weaponId].name}`
          : undefined,
      dashCooldown: this.player.getDashCooldownRatio(time),
      perks: run.perks,
      burnoutMods: this.player.getBurnoutMods(),
      tremoring: this.player.isTremoring(time),
      tremorWarnMs: this.player.getTremorWarnMs(time),
    });
  }

  /**
   * "Beat" de fim de fase (juice) — flash dourado + shake + slow-mo curto +
   * cortina radial dourada saindo do player. Faz a vitória parecer conquista,
   * não só uma flag ligando. Criado pelo Lovable na Fase 1; extraído aqui para
   * TODOS os bosses (Fases 2–5 + Fase 1) reusarem.
   */
  protected playPhaseClearBeat() {
    this.cameras.main.flash(280, 255, 210, 90, false);
    this.cameras.main.shake(220, 0.006);
    // slow-mo (fake): reduz o timeScale global por 380ms
    this.time.timeScale = 0.55;
    this.tweens.add({
      targets: this.time,
      timeScale: 1,
      duration: 380,
      delay: 220,
      ease: "Sine.easeOut",
    });
    // cortina radial dourada saindo do centro do player
    const curtain = this.add
      .circle(this.player.x, this.player.y, 10, 0xffd06a, 0.55)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(970);
    this.tweens.add({
      targets: curtain,
      scale: 90,
      alpha: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onComplete: () => curtain.destroy(),
    });
    Sfx.bossAppear();
  }

  /**
   * "Momento" de enrage do boss (aprendizado do Lovable) — quando o boss passa
   * dos 35% de HP: flash vermelho + shake + grito flutuante + aura pulsante.
   * Faz a virada parecer um beat, não só ataques um pouco mais rápidos.
   */
  protected playBossEnrageMoment(x: number, y: number) {
    this.cameras.main.flash(240, 200, 20, 20, false);
    this.cameras.main.shake(260, 0.01);
    const shout = this.add
      .text(x, y - 70, "PRAZO ESTOUROU!", {
        fontFamily: "monospace",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ff4433",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(999);
    this.tweens.add({
      targets: shout,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0,
      y: shout.y - 26,
      duration: 1100,
      ease: "Back.easeOut",
      onComplete: () => shout.destroy(),
    });
    // aura vermelha que expande do boss
    const aura = this.add
      .circle(x, y, 20, 0xff2200, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(180);
    this.tweens.add({
      targets: aura,
      scale: 6,
      alpha: 0,
      duration: 520,
      ease: "Cubic.easeOut",
      onComplete: () => aura.destroy(),
    });
    Sfx.bossAppear();
  }

  protected handleBossDefeat() {
    this.bossDefeated = true;
    Telemetry.bossDefeat(this.scene.key);
    this.playPhaseClearBeat();
    this.hud.hideBoss();
    this.hud.setObjective("Copa desbloqueada! Use [ E ] na porta.");

    if (this.boss?.active) {
      const bx = this.boss.x;
      for (let i = 0; i < 12; i++) {
        this.time.delayedCall(i * 60, () => {
          if (this.boss) this.dropVR(this.boss.x + Phaser.Math.Between(-60, 60), this.boss.y - 20);
        });
      }
      (this.boss as Phaser.Physics.Arcade.Sprite).destroy();
      this.bossPresence?.destroy();
      this.dropBossWeapon(bx); // recompensa garantida: arma do chefão
    }

    savePersisted(getRun(this).reconhecimento, getRun(this).fgts, getRun(this).loopCount);
    this.doorEl.clearTint();
    this.doorLabel.setText("COPA").setColor("#c9a36a");

    const msg = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 30,
        this.getBossName() + " DERROTADO!\n\nPorta da Copa desbloqueada ->",
        {
          fontFamily: "monospace",
          fontSize: "15px",
          color: "#f2c14e",
          stroke: "#000000",
          strokeThickness: 3,
          align: "center",
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(999);
    this.tweens.add({
      targets: msg,
      alpha: 0,
      duration: 900,
      delay: 3500,
      onComplete: () => msg.destroy(),
    });

    this._launchCulturaSelect();
  }

  protected _launchCulturaSelect() {
    const options = Phaser.Utils.Array.Shuffle(selectableCulturaIds()).slice(0, 3) as CulturaId[];
    this.scene.pause();
    this.scene.launch("CulturaSelectScene", { caller: this.scene.key, options });
  }

  // Host do combate canônico — construído 1x (grupos lidos por getter vivo).
  // protected: a Fase 1 sobrescreve getMeleeHost() com hooks próprios e reusa este cache.
  protected _meleeHost?: MeleeHost;

  protected getMeleeHost(): MeleeHost {
    if (!this._meleeHost) {
      this._meleeHost = {
        scene: this,
        player: this.player,
        combatFx: this.combatFx,
        getGroups: () => this.enemyGroups,
        getBoss: () => this.boss as ReturnType<MeleeHost["getBoss"]>,
        dropVR: (x, y, n) => this.dropVR(x, y, n),
        onBossDied: () => this.handleBossDefeat(),
        onEnemyKilled: (e) => {
          this.rollSanityDrop(e.x, e.y);
          this.rollWeaponDrop(e.x, e.y);
          this.onEnemyKilledByMelee(e);
        },
      };
    }
    // player/combatFx são recriados a cada create() da cena
    this._meleeHost.player = this.player;
    this._meleeHost.combatFx = this.combatFx;
    return this._meleeHost;
  }

  protected resolveAttack(
    hb: Phaser.Geom.Rectangle,
    step: number,
    swingId?: number,
    firstFrame = true,
  ) {
    resolveMeleeAttack(this.getMeleeHost(), hb, step, swingId, firstFrame);
  }

  protected handleSpecial(type: string, fx: number, fy: number, facing: 1 | -1, def: WeaponDef) {
    switch (type) {
      case "burst_ranged":
        for (let i = 0; i < 2; i++) {
          this.time.delayedCall(i * 100, () => {
            this.spawnProjectile({
              x: fx + facing * 20,
              y: fy - 5,
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
          x: fx + facing * 20,
          y: fy - 10,
          velX: facing * 700,
          damage: def.hitDamages[1] * 2,
        });
        break;
      case "emp_pulse": {
        const stun = (s: Phaser.GameObjects.GameObject) => {
          const e = s as GameEnemy;
          e.applyFreeze?.(900);
        };
        for (const gd of this.enemyGroups) {
          gd.group.getChildren().forEach(stun);
        }
        this.boss?.applyFreeze?.(900);
        const ring = this.add.circle(this.player.x, this.player.y, 8, 0x88aaff, 0.6);
        this.tweens.add({
          targets: ring,
          scaleX: 15,
          scaleY: 15,
          alpha: 0,
          duration: 400,
          onComplete: () => ring.destroy(),
        });
        break;
      }
      case "paper_spread": {
        const angles = [-0.25, 0, 0.25];
        angles.forEach((a) => {
          const spd = def.rangedSpeed || 500;
          this.spawnProjectile({
            x: fx + facing * 20,
            y: fy - 5,
            velX: facing * spd * Math.cos(a),
            velY: spd * Math.sin(a),
            damage: def.rangedDamage || def.hitDamages[0],
            piercing: def.rangedPiercing,
          });
        });
        break;
      }
      case "caneca_arc":
        this.spawnProjectile({
          x: fx + facing * 20,
          y: fy - 20,
          velX: facing * 400,
          velY: -350,
          damage: def.hitDamages[2],
          arc: true,
        });
        break;
      case "wide_beam": {
        const beamRect = new Phaser.Geom.Rectangle(
          facing > 0 ? fx : 0,
          fy - 25,
          facing > 0 ? this.levelWidth - fx : fx,
          30,
        );
        this.resolveAttack(beamRect, 3);
        const lineW = facing > 0 ? this.levelWidth - fx : fx;
        const line = this.add.rectangle(
          facing > 0 ? fx + lineW / 2 : fx / 2,
          fy - 10,
          lineW,
          6,
          0x88aaff,
          0.8,
        );
        this.tweens.add({
          targets: line,
          alpha: 0,
          duration: 300,
          onComplete: () => line.destroy(),
        });
        break;
      }
      case "spray_knockback": {
        const hb = new Phaser.Geom.Rectangle(facing > 0 ? fx : fx - 120, fy - 30, 120, 60);
        this.resolveAttack(hb, 3);
        const cloud = this.add.circle(fx + facing * 60, fy, 12, 0xffffff, 0.5);
        this.tweens.add({
          targets: cloud,
          scaleX: 5,
          scaleY: 4,
          alpha: 0,
          duration: 500,
          onComplete: () => cloud.destroy(),
        });
        break;
      }
      case "chain_lightning": {
        const allEnemies: Phaser.Physics.Arcade.Sprite[] = [];
        for (const gd of this.enemyGroups) {
          gd.group.getChildren().forEach((e) => allEnemies.push(e as Phaser.Physics.Arcade.Sprite));
        }
        const sorted = allEnemies
          .filter((e) => e.active)
          .sort(
            (a, b) =>
              Phaser.Math.Distance.Between(fx, fy, a.x, a.y) -
              Phaser.Math.Distance.Between(fx, fy, b.x, b.y),
          );
        sorted.slice(0, 3).forEach((enemy, i) => {
          this.time.delayedCall(i * 80, () => {
            const e = enemy as GameEnemy;
            if (e.hit) e.hit(def.hitDamages[2], 150);
            const flash = this.add.rectangle(enemy.x, enemy.y, 6, 40, 0xffff44, 0.9);
            this.time.delayedCall(150, () => flash.destroy());
          });
        });
        this.boss?.hit(def.hitDamages[2], 150);
        break;
      }
      case "heal_pulse": {
        this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 20);
        const glow = this.add.circle(this.player.x, this.player.y, 8, 0x44ff88, 0.7);
        this.tweens.add({
          targets: glow,
          scaleX: 12,
          scaleY: 12,
          alpha: 0,
          duration: 400,
          onComplete: () => glow.destroy(),
        });
        break;
      }
      case "dash_strike": {
        const hb = new Phaser.Geom.Rectangle(facing > 0 ? fx : fx - 160, fy - 24, 160, 48);
        this.resolveAttack(hb, 3);
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(facing * 600);
        break;
      }
      case "clock_slow": {
        for (const gd of this.enemyGroups) {
          gd.group.getChildren().forEach((s) => {
            const e = s as GameEnemy;
            e.applySlowdown?.(2000);
          });
        }
        this.boss?.applySlowdown?.(2000);
        const overlay = this.add.circle(this.player.x, this.player.y, 8, 0xaaaaff, 0.5);
        this.tweens.add({
          targets: overlay,
          scaleX: 20,
          scaleY: 20,
          alpha: 0,
          duration: 600,
          onComplete: () => overlay.destroy(),
        });
        break;
      }
    }
  }

  protected spawnEnemyProjectile(
    fx: number,
    fy: number,
    tx: number,
    ty: number,
    damage: number,
    tint = 0xff4444,
    speed = 180,
    extraVelX = 0,
    extraVelY = 0,
  ): Phaser.Physics.Arcade.Sprite {
    const proj = this.enemyProjectiles.create(
      fx,
      fy,
      "tex-inkproj",
    ) as Phaser.Physics.Arcade.Sprite;
    Sfx.inkShot();
    const body = proj.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    const angle = Phaser.Math.Angle.Between(fx, fy, tx, ty);
    body.setVelocity(Math.cos(angle) * speed + extraVelX, Math.sin(angle) * speed + extraVelY);
    proj.setData("damage", damage);
    proj.setTint(tint);
    this.time.delayedCall(3000, () => {
      if (proj.active) proj.destroy();
    });
    return proj;
  }

  protected spawnProjectile(opts: {
    x: number;
    y: number;
    velX: number;
    velY?: number;
    damage: number;
    piercing?: boolean;
    bounces?: number;
    homing?: boolean;
    arc?: boolean;
    textureKey?: string;
  }) {
    const ink = this.inkProjectiles.create(
      opts.x,
      opts.y,
      opts.textureKey ?? "tex-inkproj",
    ) as Phaser.Physics.Arcade.Sprite;
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
      const d = this.drops.create(
        x + (i - count / 2) * 8,
        y - 10,
        "tex-vr",
      ) as Phaser.Physics.Arcade.Sprite;
      d.setDepth(8);
      const body = d.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Phaser.Math.Between(-120, 120), Phaser.Math.Between(-260, -160));
      body.setBounce(0.4);
      body.setDrag(120, 0);
    }
  }

  /**
   * Overlap player → cafezinho de Sanidade. Extraído para a Fase 1 (que tem
   * create() próprio) poder reusar exatamente o mesmo comportamento.
   */
  protected wireSanityDropPickup() {
    this.physics.add.overlap(this.player, this.sanityDrops, (_p, dObj) => {
      const spr = dObj as Phaser.Physics.Arcade.Sprite;
      if (!spr.active) return;
      const amount = (spr.getData("sanity") as number) ?? 15;
      const before = this.player.sanity;
      this.player.sanity = Math.min(this.player.maxSanity, this.player.sanity + amount);
      const gained = Math.round(this.player.sanity - before);
      spr.destroy();
      const t = this.add
        .text(this.player.x, this.player.y - 46, `+${gained} Sanidade`, {
          fontFamily: "monospace",
          fontSize: "12px",
          fontStyle: "bold",
          color: "#44ddaa",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(500);
      this.tweens.add({
        targets: t,
        y: t.y - 26,
        alpha: 0,
        duration: 800,
        onComplete: () => t.destroy(),
      });
    });
  }

  /** Cria um cafezinho que restaura `amount` de Sanidade ao ser coletado. */
  protected spawnSanityDrop(x: number, y: number, amount = 15) {
    const d = this.sanityDrops.create(x, y - 10, ...resolveSprite("tex-coffee")) as
      | Phaser.Physics.Arcade.Sprite
      | undefined;
    if (!d) return;
    d.setDepth(8).setDisplaySize(20, 20).setData("sanity", amount);
    const body = d.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Phaser.Math.Between(-100, 100), Phaser.Math.Between(-240, -150));
    body.setBounce(0.4);
    body.setDrag(120, 0);
    // Brilho pulsante ciano para diferenciar do VR dourado.
    d.setTint(0x66ffdd);
    this.tweens.add({
      targets: d,
      alpha: 0.55,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * Rola a chance de um inimigo morto dropar um cafezinho. A chance sobe quando
   * a Sanidade do jogador está baixa — o contra-jogo do Burnout fica mais
   * generoso justamente quando o jogador precisa. Determinístico pela seed.
   */
  protected rollSanityDrop(x: number, y: number) {
    const s = this.player.sanity;
    const maxS = this.player.maxSanity || 100;
    const ratio = s / maxS;
    // 5% base; até +18% quando a sanidade está no chão.
    const chance = 0.05 + (ratio < 0.5 ? (0.5 - ratio) * 0.36 : 0);
    if (this.rng.frac() < chance) this.spawnSanityDrop(x, y, 15);
  }

  protected persist() {
    const r = getRun(this);
    r.energy = this.player.energy;
    r.sanity = this.player.sanity;
    r.vr = this.player.vr;
    r.autonomia = this.player.autonomia;
  }

  protected buildFloor() {
    this.add.tileSprite(LEVEL_WIDTH / 2, FLOOR_Y + 8, LEVEL_WIDTH, 16, "tex-floor");
    const floorPhys = this.add.rectangle(
      LEVEL_WIDTH / 2,
      FLOOR_Y + 8,
      LEVEL_WIDTH,
      16,
      0x000000,
      0,
    );
    this.physics.add.existing(floorPhys, true);
    this.platforms.add(floorPhys);
  }

  // Loop temporal: cada fase avança o relógio rumo às 18h (a fuga). Reforça a
  // pressão do dia. CEO é cena à parte (17:55).
  private static PHASE_CLOCK: Record<number, string> = {
    1: "13:00",
    2: "14:10",
    3: "15:25",
    4: "16:40",
    5: "17:35",
  };
  private static PHASE_FLAVOR: Record<number, string> = {
    1: "O dia mal começou. O relógio já é seu inimigo.",
    2: "A reunião não tem pauta. Nem fim.",
    3: "Sorria. O clima organizacional está sendo medido.",
    4: "O deploy é sexta. A culpa também.",
    5: "O andar da diretoria. O ar é mais rarefeito aqui.",
  };

  // ── Armas largadas no chão (pickup no meio da fase) ─────────────────────────
  private static RARITY_COLOR: Record<string, number> = {
    comum: 0xaaaaaa,
    raro: 0x4a90d0,
    epico: 0xa060d0,
    lendario: 0xf2c14e,
  };

  /** Aplica os stats de uma arma ao player e reflete no HUD (usado no pickup/swap). */
  protected applyWeaponStats(weaponId: WeaponId) {
    const w = WEAPONS[weaponId] ?? WEAPONS.grampeador;
    this.player.weaponId = weaponId;
    this.player.attackRange = w.attackRange;
    this.player.specialCooldown = w.specialCooldown;
    this.player.specialType = w.specialType;
    this.player.hitAutoRanged = w.hitAutoRanged;
    this.player.isRangedPrimary = w.type === "ranged";
    this.player.comboHits = w.type === "melee" && w.hitDamages[2] === 0 ? 2 : 3;
    if ((getRun(this).upgComboHitsBonus ?? 0) >= 1) this.player.comboHits = 4;
    this.player.attackIntervalMs = Math.round(220 / (w.attackSpeedMult ?? 1));
    this.hud?.setWeapon(`${WEAPON_ICONS[weaponId]} ${w.name}`);
    this.hud?.setSpecial(w.specialName);
  }

  private updateSecondaryHud() {
    const sec = this.player.secondaryWeaponId as WeaponId | null;
    this.hud?.setSecondaryWeapon(sec ? `[Q] ${WEAPON_ICONS[sec]} ${WEAPONS[sec].name}` : null);
  }

  /** Larga uma arma no chão como pickup flutuante (peg com E). */
  protected dropWeapon(x: number, weaponId: WeaponId) {
    const w = WEAPONS[weaponId];
    if (!w) return;
    const px = Phaser.Math.Clamp(x, 40, LEVEL_WIDTH - 40);
    const py = FLOOR_Y - 18;
    const color = BasePhaseScene.RARITY_COLOR[w.rarity] ?? 0xffffff;
    const glow = this.add.circle(0, 0, 15, color, 0.35).setBlendMode(Phaser.BlendModes.ADD);
    const ring = this.add.circle(0, 0, 15, 0x000000, 0).setStrokeStyle(2, color, 0.9);
    const icon = this.add
      .text(0, 0, WEAPON_ICONS[weaponId], { fontFamily: "monospace", fontSize: "20px" })
      .setOrigin(0.5);
    const c = this.add.container(px, py, [glow, ring, icon]).setDepth(60);
    this.tweens.add({
      targets: c,
      y: py - 8,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.tweens.add({
      targets: [glow, ring],
      alpha: 0.15,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
    this.weaponPickups.push({ weaponId, obj: c });
  }

  /** Recompensa garantida do chefão: larga uma arma (viés p/ upgrade). */
  protected dropBossWeapon(x: number) {
    const wid = this.rollUpgradeWeapon(this.player.weaponId as WeaponId);
    if (wid) this.dropWeapon(x, wid);
  }

  /** Chance rara de largar uma arma ao matar um inimigo (variedade dentro da run). */
  protected rollWeaponDrop(x: number, _y: number) {
    if (Math.random() > 0.045) return; // ~4.5% por kill
    const wid = this.rollUpgradeWeapon(this.player.weaponId as WeaponId);
    if (wid) this.dropWeapon(x, wid);
  }

  /** Sorteia uma arma diferente da atual, com viés para tier igual/superior. */
  private rollUpgradeWeapon(currentId: WeaponId): WeaponId | null {
    const cur = WEAPONS[currentId];
    const pool = (Object.keys(WEAPONS) as WeaponId[]).filter(
      (id) => id !== currentId && WEAPONS[id].shopCost > 0, // exclui iniciais/lendária-drop-only
    );
    if (!pool.length) return null;
    const better = pool.filter((id) => WEAPONS[id].shopCost >= (cur?.shopCost ?? 0));
    const chosen = better.length && Math.random() < 0.7 ? better : pool;
    return chosen[Math.floor(Math.random() * chosen.length)];
  }

  /** Checa proximidade do player com pickups e equipa ao apertar E. */
  protected updateWeaponPickups() {
    let nearest: { weaponId: WeaponId; obj: Phaser.GameObjects.Container } | undefined;
    // Raio generoso: o item fica no chão e o player flutua ~42px acima dele,
    // então mesmo em cima a distância de centro já passa de 40.
    let best = 66;
    for (const p of this.weaponPickups) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, p.obj.x, p.obj.y);
      if (d < best) {
        best = d;
        nearest = p;
      }
    }
    this.nearestPickup = nearest;
    if (nearest && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.equipPickup(nearest);
    }
  }

  private equipPickup(p: { weaponId: WeaponId; obj: Phaser.GameObjects.Container }) {
    const newId = p.weaponId;
    const oldPrimary = this.player.weaponId as WeaponId;
    if (newId !== oldPrimary) {
      const oldSecondary = this.player.secondaryWeaponId as WeaponId | null;
      // nova vira primária; a primária atual vai para o slot secundário
      this.player.secondaryWeaponId = oldPrimary;
      this.applyWeaponStats(newId);
      const r = getRun(this);
      r.weaponId = newId;
      r.secondaryWeaponId = this.player.secondaryWeaponId;
      // se já havia uma 2ª arma, ela cai de volta no chão (não se perde)
      if (oldSecondary && oldSecondary !== newId) this.dropWeapon(this.player.x + 44, oldSecondary);
      this.updateSecondaryHud();
      Sfx.buy();
      this.showPickupToast(`Equipado: ${WEAPONS[newId].name}   ([Q] troca)`);
    }
    p.obj.destroy();
    this.weaponPickups = this.weaponPickups.filter((w) => w !== p);
    this.nearestPickup = undefined;
  }

  private showPickupToast(text: string) {
    const t = this.add
      .text(GAME_WIDTH / 2, 150, text, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#88bbff",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(999);
    this.tweens.add({
      targets: t,
      alpha: 0,
      y: 130,
      duration: 900,
      delay: 1400,
      onComplete: () => t.destroy(),
    });
  }

  /** Cartão de abertura da fase: relógio (loop até 18h) + título + flavor. */
  protected showPhaseIntroCard() {
    const pn = this.getPhaseNumber();
    const clock = pn ? BasePhaseScene.PHASE_CLOCK[pn] : null;
    const flavor = pn ? BasePhaseScene.PHASE_FLAVOR[pn] : null;
    const cx = GAME_WIDTH / 2;
    const items: Phaser.GameObjects.GameObject[] = [];

    if (clock) {
      const clockT = this.add
        .text(cx, 74, `⏰ ${clock}`, {
          fontFamily: "monospace",
          fontSize: "22px",
          fontStyle: "bold",
          color: "#f2c14e",
          stroke: "#000000",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(999);
      items.push(clockT);
    }

    const title = this.add
      .text(cx, clock ? 106 : 96, this.getPhaseTitle(), {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#eaeaea",
        align: "center",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(999);
    items.push(title);

    if (flavor) {
      const flavorT = this.add
        .text(cx, 132, flavor, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#999999",
          align: "center",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(999);
      items.push(flavorT);
    }

    this.tweens.add({
      targets: items,
      alpha: 0,
      duration: 900,
      delay: 2400,
      onComplete: () => items.forEach((i) => i.destroy()),
    });
  }

  /**
   * Superfície de plataforma temática da fase (identidade visual). null =
   * usa o pool de móveis PLAT_DEFS por altura (default). Fases 2–5 sobrescrevem
   * para dar cara própria (baia, rack de servidor, degrau de RH, mármore exec).
   */
  protected getPlatSurface(): { surf: string; body: string } | null {
    return null;
  }

  protected buildPlatform(x: number, y: number, tiles: number) {
    const platDefs = PLAT_DEFS;
    const heightFromFloor = FLOOR_Y - y;
    const matching = platDefs.filter((d) => Math.abs(d.height - heightFromFloor) <= 5);
    const pool = matching.length > 0 ? matching : platDefs;
    const def = this.getPlatSurface() ?? pool[this.platIdx % pool.length];
    this.platIdx++;
    const w = tiles * 32;

    for (let i = 0; i < tiles; i++) {
      this.add
        .image(x + i * 32 + 16, y, def.surf)
        .setDisplaySize(32, 14)
        .setDepth(9);
    }

    const bodyTop = y + 7;
    const bodyH = FLOOR_Y - bodyTop;
    const bodyMidY = bodyTop + bodyH / 2;
    for (let i = 0; i < tiles; i++) {
      this.add
        .image(x + i * 32 + 16, bodyMidY, def.body)
        .setDisplaySize(32, bodyH)
        .setDepth(7);
    }

    const plat = this.add.rectangle(x + w / 2, y, w, 14, 0x000000, 0);
    this.physics.add.existing(plat, true);
    this.platforms.add(plat);

    const bodyPlat = this.add.rectangle(x + w / 2, bodyMidY, w, bodyH, 0x000000, 0);
    this.physics.add.existing(bodyPlat, true);
    this.furnitureBodies.add(bodyPlat);
  }
}
