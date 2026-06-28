import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { HUD_BOT_Y, HUD_TOP_H } from "../systems/Hud";
import { addPhaseBackground } from "../systems/Background";
import { Player } from "../entities/Player";
import {
  EstagiarioDesesperado,
  EstagiarioSobrecarregado,
  AnalistaJunior,
  AnalistaOnboarding,
  EnemyRH,
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
import { CombatFx } from "../systems/CombatFx";
import { Hud } from "../systems/Hud";
import { reapplyAllPerks } from "../systems/PerkSystem";
import { reapplyAllCulturas } from "../systems/CulturaSystem";
import { CulturaId, CULTURAS } from "../systems/CulturaSystem";
import { addImage } from "../systems/SpriteLibrary";
import { Sfx } from "../systems/AudioSystem";

const LEVEL_WIDTH = 1920;
const FLOOR_Y = HUD_BOT_Y - 32;

export class OpenSpaceV2Scene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private furnitureBodies!: Phaser.Physics.Arcade.StaticGroup;
  private estagiarios!: Phaser.Physics.Arcade.Group;
  private sobrecarregados!: Phaser.Physics.Arcade.Group;
  private analistas!: Phaser.Physics.Arcade.Group;
  private onboardings!: Phaser.Physics.Arcade.Group;
  private facilitadores!: Phaser.Physics.Arcade.Group;
  private scrums!: Phaser.Physics.Arcade.Group;
  private coordenadores!: Phaser.Physics.Arcade.Group;
  private seniors!: Phaser.Physics.Arcade.Group;
  private rhs!: Phaser.Physics.Arcade.Group;
  private postits!: Phaser.Physics.Arcade.Group;
  private emails!: Phaser.Physics.Arcade.Group;
  private inkProjectiles!: Phaser.Physics.Arcade.Group;
  private drops!: Phaser.Physics.Arcade.Group;
  private boss?: GerenteMicrogestor;
  private bossDefeated = false;
  private startTimeMs = 0;
  private fx!: SanityFx;
  private combatFx!: CombatFx;
  private hud!: Hud;
  private shadowG!: Phaser.GameObjects.Graphics;
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
    this.spawnDustParticles();

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

    // (computadores agora ficam em cima das mesas — ver buildPlatform)

    // Wall decoratives — very back (parallax 0.2x)
    [450, 1100, 1650].forEach(x =>
      addImage(this, x, HUD_TOP_H + 80, "tex-quadro-motivacional")
        .setDepth(2).setDisplaySize(48, 56).setScrollFactor(0.2, 0)
    );

    // Mid parallax — janelas/divisórias (scrollFactor 0.5x) dão profundidade extra
    const midY = HUD_TOP_H + (FLOOR_Y - HUD_TOP_H) * 0.38;
    const windowColor = 0x1a2a3a;
    const glowColor   = 0x3a5a7a;
    for (let wx = 160; wx < LEVEL_WIDTH; wx += 220) {
      const g = this.add.graphics().setDepth(1).setScrollFactor(0.5, 0);
      g.fillStyle(windowColor, 0.55);
      g.fillRect(wx, midY, 80, 52);
      g.lineStyle(1, glowColor, 0.7);
      g.strokeRect(wx, midY, 80, 52);
      // blinds
      for (let b = 8; b < 52; b += 10) {
        g.lineStyle(1, glowColor, 0.25);
        g.lineBetween(wx + 4, midY + b, wx + 76, midY + b);
      }
    }

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
    this.player.maxEnergy         = classDef.maxEnergy + (run.upgMaxEnergy ?? 0);
    this.player.maxSanity         = classDef.maxSanity + (run.upgMaxSanity ?? 0);
    this.player.walkSpeed         = 200 * classDef.speedMult;
    this.player.damageMult        = classDef.damageMult;
    this.player.vrDropMult        = classDef.vrMult + (run.upgVrDropMult ?? 0);
    this.player.parryWindowBonus  = run.upgParryWindowBonus ?? 0;
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
      this.player.energy = this.player.maxEnergy;
      this.player.sanity = this.player.maxSanity;
    }
    this.player.vr = run.vr;
    reapplyAllPerks(this.player, run);
    reapplyAllCulturas(this.player, run);

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
      Sfx.inkShot();
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
          [this.estagiarios, this.sobrecarregados, this.analistas, this.onboardings, this.facilitadores, this.scrums, this.coordenadores, this.seniors, this.rhs].forEach(g =>
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
          [this.estagiarios, this.sobrecarregados, this.analistas, this.onboardings, this.facilitadores, this.scrums, this.coordenadores, this.seniors, this.rhs].forEach(g =>
            g?.getChildren().forEach(e => (e as Phaser.Physics.Arcade.Sprite & { applySlowdown?: (ms: number) => void }).applySlowdown?.(2500))
          );
          break;
      }
    };

    // Parry "Reclamar": stun o inimigo mais próximo do ponto de ataque
    this.player.onParrySuccess = (fromX: number) => {
      const allGroups = [this.estagiarios, this.sobrecarregados, this.analistas,
        this.onboardings, this.facilitadores, this.scrums, this.coordenadores,
        this.seniors, this.rhs];
      let closest: (Phaser.Physics.Arcade.Sprite & { frozenUntil?: number }) | null = null;
      let closestDist = 160; // raio máximo do stun
      allGroups.forEach(g => g?.getChildren().forEach(c => {
        const e = c as Phaser.Physics.Arcade.Sprite & { frozenUntil?: number };
        if (!e.active) return;
        const d = Phaser.Math.Distance.Between(e.x, e.y, fromX, this.player.y);
        if (d < closestDist) { closestDist = d; closest = e; }
      }));
      if (closest) {
        const enemy = closest as Phaser.Physics.Arcade.Sprite & { frozenUntil?: number };
        enemy.frozenUntil = this.time.now + 800;
        enemy.setTint(0xffdd00);
        this.time.delayedCall(800, () => { if (enemy.active) enemy.clearTint(); });
      }
      // VFX: burst dourado na posição do player
      const burst = this.add.circle(this.player.x, this.player.y - 20, 18, 0xffdd00, 0.85)
        .setDepth(20);
      this.tweens.add({ targets: burst, radius: 40, alpha: 0, duration: 200,
        onComplete: () => burst.destroy() });
      this.add.text(this.player.x, this.player.y - 48, "RECLAMEI!", {
        fontSize: "13px", color: "#ffdd00", stroke: "#000000", strokeThickness: 3,
      }).setDepth(21).setOrigin(0.5).setScrollFactor(1);
      this.time.delayedCall(700, () => {
        // just destroy the last text added — find it by scene list
        this.children.list.filter(o => o instanceof Phaser.GameObjects.Text &&
          (o as Phaser.GameObjects.Text).text === "RECLAMEI!")
          .forEach(o => (o as Phaser.GameObjects.Text).destroy());
      });
    };

    // Enemy groups (no classType — entities added manually)
    this.estagiarios     = this.physics.add.group({ runChildUpdate: false });
    this.sobrecarregados = this.physics.add.group({ runChildUpdate: false });
    this.analistas       = this.physics.add.group({ runChildUpdate: false });
    this.onboardings     = this.physics.add.group({ runChildUpdate: false });
    this.facilitadores   = this.physics.add.group({ runChildUpdate: false });
    this.scrums          = this.physics.add.group({ runChildUpdate: false });
    this.coordenadores   = this.physics.add.group({ runChildUpdate: false });
    this.seniors         = this.physics.add.group({ runChildUpdate: false });
    this.rhs             = this.physics.add.group({ runChildUpdate: false });
    this.postits      = this.physics.add.group();
    this.emails       = this.physics.add.group();
    this.inkProjectiles = this.physics.add.group();
    this.drops        = this.physics.add.group();

    // Pre-populate projectile pools
    for (let i = 0; i < 8; i++) {
      const p = new PostIt(this, -9999, -9999);
      p.setActive(false).setVisible(false);
      (p.body as Phaser.Physics.Arcade.Body).enable = false;
      this.postits.add(p);
    }
    for (let i = 0; i < 6; i++) {
      const e = new EmailProjectil(this, -9999, -9999);
      e.setActive(false).setVisible(false);
      (e.body as Phaser.Physics.Arcade.Body).enable = false;
      this.emails.add(e);
    }

    if (run.openSpaceCleared === true) {
      this.bossDefeated = true;
      this.doorCopa.clearTint();
      this.doorLabel.setText("COPA").setColor("#c9a36a");
    } else {
      this.spawnEnemies();
    }

    // Colliders: enemy groups land on platform surfaces
    [this.estagiarios, this.sobrecarregados, this.analistas, this.onboardings,
     this.facilitadores, this.scrums, this.coordenadores, this.seniors, this.rhs, this.drops].forEach(g =>
      this.physics.add.collider(g, this.platforms)
    );
    // Inimigos respeitam a mesma física do player: não atravessam os corpos das mesas
    [this.estagiarios, this.sobrecarregados, this.analistas, this.onboardings,
     this.facilitadores, this.scrums, this.coordenadores, this.seniors, this.rhs].forEach(g =>
      this.physics.add.collider(g, this.furnitureBodies)
    );

    // Contact damage
    const contactDamage = (group: Phaser.Physics.Arcade.Group, dmg: (e: Phaser.Physics.Arcade.Sprite) => number) => {
      this.physics.add.overlap(this.player, group, (_p, eObj) => {
        if (this.player.isInvulnerable(this.time.now)) return;
        const e = eObj as Phaser.Physics.Arcade.Sprite;
        this.player.takeDamage(dmg(e), 4, e.x);
      });
    };
    contactDamage(this.estagiarios,     (e) => (e as EstagiarioDesesperado).contactDamage);
    contactDamage(this.sobrecarregados, (e) => (e as EstagiarioSobrecarregado).contactDamage);
    contactDamage(this.scrums,          (e) => (e as ScrumMasterCaotico).contactDamage);
    contactDamage(this.coordenadores,   (e) => (e as CoordenadorDeSinergia).contactDamage);
    contactDamage(this.seniors,         (e) => (e as AnalistaSeniorExausto).contactDamage);
    contactDamage(this.rhs,             (e) => (e as EnemyRH).contactDamage);

    this.physics.add.overlap(this.player, this.postits, (_p, pObj) => {
      const p = pObj as PostIt;
      if (!p.active || this.player.isInvulnerable(this.time.now)) return;
      this.player.sanity = Math.max(0, this.player.sanity - p.sanityDamage);
      p.setActive(false).setVisible(false);
      (p.body as Phaser.Physics.Arcade.Body).enable = false;
    });

    this.physics.add.overlap(this.player, this.emails, (_p, eObj) => {
      const e = eObj as EmailProjectil;
      if (!e.active || this.player.isInvulnerable(this.time.now)) return;
      this.player.takeDamage(e.damage, 0);
      e.setActive(false).setVisible(false);
      (e.body as Phaser.Physics.Arcade.Body).enable = false;
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
      [this.estagiarios, 1], [this.sobrecarregados, 2], [this.analistas, 3], [this.onboardings, 2],
      [this.facilitadores, 2], [this.scrums, 2], [this.coordenadores, 4], [this.seniors, 6], [this.rhs, 3],
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
      Sfx.vrPickup();
      (dObj as Phaser.Physics.Arcade.Sprite).destroy();
    });

    // Pause on ESC
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => {
      this.scene.pause();
      this.scene.launch("PauseScene", { caller: "OpenSpaceV2Scene" });
    });

    // Cleanup door tween on scene shutdown to prevent leak
    this.events.once("shutdown", () => this.tweens.killAll());

    // Copa door interaction zone
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    const doorZone = this.add.zone(this.doorCopa.x, this.doorCopa.y, 40, 60);
    this.physics.add.existing(doorZone, true);
    this.physics.add.overlap(this.player, doorZone, () => {
      if (!this.bossDefeated) return;
      if (Phaser.Input.Keyboard.JustDown(this.interactKey) || this.player.gamepadInteractJustPressed) {
        this.persist();
        const r = getRun(this);
        r.cameFrom = "openspace";
        r.nextScene = "Phase2Scene";
        this.scene.start("CopaScene");
      }
    });

    this.fx       = new SanityFx(this);
    this.combatFx = new CombatFx(this);
    this.hud = new Hud(this, LEVEL_WIDTH);
    this.shadowG = this.add.graphics().setDepth(5);

    // Camera flash + chromatic aberration on player hit
    this.player.onHit = () => {
      this.cameras.main.flash(60, 255, 20, 20, false);
      this.fx.triggerChromaticHit();
    };
    this.hud.setPhaseTitle("FASE 1 — OPEN SPACE");
    this.hud.setObjective("Derrote o Gerente e acesse a Copa");

    // Intro pan: câmera faz pan da direita para o player, só na entrada inicial
    if (run.cameFrom !== "copa") {
      this.cameras.main.stopFollow();
      this.cameras.main.setScroll(400, 0);
      this.time.delayedCall(200, () => {
        this.cameras.main.pan(this.player.x, this.player.y, 900, "Cubic.easeOut", false, (_cam, progress) => {
          if (progress >= 1) this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
        });
      });
    }
  }

  private spawnDustParticles(): void {
    const zoneTop  = HUD_TOP_H + 20;
    const zoneBot  = FLOOR_Y   - 20;
    const zoneH    = zoneBot - zoneTop;

    // Layer 1 — fine dust: many tiny specks drifting upward very slowly
    this.add.particles(0, zoneTop, "__WHITE", {
      x:             { min: 0, max: LEVEL_WIDTH },
      y:             { min: 0, max: zoneH },
      speedX:        { min: -10, max: 10 },
      speedY:        { min: -14, max: -3 },
      lifespan:      { min: 7000, max: 13000 },
      alpha:         { start: 0.06, end: 0 },
      scale:         { min: 0.5,   max: 1.2 },
      tint:          [0xd4c8a0, 0xe8d8b0, 0xfff4d0],
      frequency:     160,
      maxAliveParticles: 90,
      gravityY:      6,   // gentle resistance — float, then drift back
    }).setDepth(2);

    // Layer 2 — lazy motes: fewer, larger, longer-lived
    this.add.particles(0, zoneTop + 40, "__WHITE", {
      x:             { min: 0, max: LEVEL_WIDTH },
      y:             { min: 0, max: zoneH - 80 },
      speedX:        { min: -5, max: 5 },
      speedY:        { min: -7, max: -1 },
      lifespan:      { min: 12000, max: 22000 },
      alpha:         { start: 0.09, end: 0 },
      scale:         { min: 1.5, max: 3.0 },
      tint:          [0xf0e8c8, 0xffe8c0],
      frequency:     500,
      maxAliveParticles: 28,
      gravityY:      2,
    }).setDepth(2);
  }

  private buildFloor(): void {
    this.add.tileSprite(LEVEL_WIDTH / 2, FLOOR_Y + 8, LEVEL_WIDTH, 16, "tex-floor").setDepth(8);
    // Physics body is 120px tall (starting at FLOOR_Y) so fast-falling objects
    // never tunnel through the thin visual strip.
    const fp = this.add.rectangle(LEVEL_WIDTH / 2, FLOOR_Y + 60, LEVEL_WIDTH, 120, 0, 0);
    this.physics.add.existing(fp, true);
    this.platforms.add(fp);
  }

  /**
   * Builds an office-desk platform: wooden desktop (walkable), legs/modesty
   * panel, e um computador em cima. Desenhado com Graphics (sem textura
   * esticada). A superfície e o corpo da mesa têm física igual para player
   * e inimigos.
   * surfY: Y da superfície (topo da mesa, onde se anda).
   * tiles: largura em blocos de 32 px.
   */
  private buildPlatform(x: number, surfY: number, tiles: number): void {
    const w = tiles * 32;
    const cx = x + w / 2;
    const bodyTop = surfY + 7;
    const bodyH = FLOOR_Y - bodyTop;
    const bodyMidY = bodyTop + bodyH / 2;

    const WOOD_TOP = 0x7a4a22;   // tampo claro
    const WOOD_EDGE = 0x5c3318;  // borda frontal
    const WOOD_DARK = 0x3a2412;  // pernas
    const OUTLINE = 0x2e1a0c;

    // Sombra no chão
    this.add.rectangle(cx, FLOOR_Y + 3, w + 10, 7, 0x000000, 0.3).setDepth(5);

    // Pernas + painel da mesa
    const legs = this.add.graphics().setDepth(6);
    const legW = 8;
    legs.fillStyle(WOOD_DARK, 1);
    legs.fillRect(x + 4, bodyTop, legW, bodyH);
    legs.fillRect(x + w - 12, bodyTop, legW, bodyH);
    if (tiles >= 5) legs.fillRect(cx - legW / 2, bodyTop, legW, bodyH); // perna central
    // painel/modéstia recuado
    legs.fillStyle(WOOD_EDGE, 0.85);
    legs.fillRect(x + 14, bodyTop + 4, w - 28, bodyH - 10);
    legs.lineStyle(1, OUTLINE, 0.6);
    legs.strokeRect(x + 4, bodyTop, w - 8, bodyH);

    // Tampo da mesa (com leve saliência)
    const top = this.add.graphics().setDepth(7);
    top.fillStyle(WOOD_TOP, 1);
    top.fillRect(x - 3, surfY - 7, w + 6, 10);
    top.fillStyle(WOOD_EDGE, 1);
    top.fillRect(x - 3, surfY + 1, w + 6, 4);
    top.lineStyle(1, OUTLINE, 1);
    top.strokeRect(x - 3, surfY - 7, w + 6, 14);

    // Computador em cima da mesa (sprite limpo do monitor) + teclado
    addImage(this, cx, surfY - 16, "tex-monitor").setDepth(9).setDisplaySize(34, 26);
    this.add.rectangle(cx, surfY - 3, 22, 3, 0x222428).setDepth(9); // teclado

    // Física: superfície (player + inimigos pousam)
    const surf = this.add.rectangle(cx, surfY, w, 14, 0, 0);
    this.physics.add.existing(surf, true);
    this.platforms.add(surf);

    // Física: corpo da mesa (bloqueia player e inimigos)
    const body = this.add.rectangle(cx, bodyMidY, w, bodyH, 0, 0);
    this.physics.add.existing(body, true);
    this.furnitureBodies.add(body);
  }

  private spawnEnemies(): void {
    // ── Curva Mario: zona segura (x<300), escalada por seção ──────────────────
    // Seção 1 (300–600): introdução — 1 Estagiário por vez, sem ranged
    const e1 = new EstagiarioDesesperado(this, 380, FLOOR_Y - 40, 1);
    this.estagiarios.add(e1);

    const e2 = new EstagiarioSobrecarregado(this, 540, FLOOR_Y - 40, 1);
    e2.target = this.player;
    this.sobrecarregados.add(e2);

    // Seção 2 (600–900): introdução ao ranged — Facilitador + Onboarding
    const f1 = new FacilitadorDeWorkshop(this, 680, FLOOR_Y - 60);
    f1.target = this.player;
    f1.onShoot = (fx, fy, tx, ty) => this.firePostIt(fx, fy, tx, ty);
    this.facilitadores.add(f1);

    const e3 = new EstagiarioDesesperado(this, 780, FLOOR_Y - 40, -1);
    this.estagiarios.add(e3);

    const ao1 = new AnalistaOnboarding(this, 880, FLOOR_Y - 60);
    ao1.target = this.player;
    ao1.onShoot = (fx, fy, tx, ty) => this.firePostIt(fx, fy, tx, ty);
    this.onboardings.add(ao1);

    // Seção 3 (900–1150): introdução ao melee pesado — Scrum + RH
    const scrum = new ScrumMasterCaotico(this, 960, FLOOR_Y - 60);
    scrum.target = this.player;
    scrum.onShout = (fromX) => {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, fromX, this.player.y) < 260) {
        const dir = fromX < this.player.x ? -1 : 1;
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(dir * -220);
      }
    };
    scrum.onRetrospectiva = (fromX, fromY) => {
      // Retrospectiva: knockback em área maior
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, fromX, fromY) < 380) {
        const dir = fromX < this.player.x ? -1 : 1;
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(dir * -340);
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(-200);
      }
    };
    this.scrums.add(scrum);

    const rh1 = new EnemyRH(this, 1060, FLOOR_Y - 60);
    rh1.target = this.player;
    this.rhs.add(rh1);

    // Seção 4 (1150–1500): combo melee + ranged simultâneos
    const ao2 = new AnalistaOnboarding(this, 1150, FLOOR_Y - 60);
    ao2.target = this.player;
    ao2.onShoot = (fx, fy, tx, ty) => this.firePostIt(fx, fy, tx, ty);
    this.onboardings.add(ao2);

    [1250, 1400].forEach(x => {
      const a = new AnalistaJunior(this, x, FLOOR_Y - 60);
      a.target = this.player;
      this.analistas.add(a);
    });

    const f2 = new FacilitadorDeWorkshop(this, 1340, FLOOR_Y - 60);
    f2.target = this.player;
    f2.onShoot = (fx, fy, tx, ty) => this.firePostIt(fx, fy, tx, ty);
    this.facilitadores.add(f2);

    const rh2 = new EnemyRH(this, 1460, FLOOR_Y - 60);
    rh2.target = this.player;
    this.rhs.add(rh2);

    // Seção 5 (1500–1750): elite antes do boss — Coordenador + Senior com buff real
    const coord = new CoordenadorDeSinergia(this, 1560, FLOOR_Y - 60);
    coord.target = this.player;
    coord.onBuff = (cx, cy, radius) => {
      // Buff: restaura 8 HP de cada inimigo vivo no raio
      const allGroups = [this.estagiarios, this.sobrecarregados, this.analistas,
        this.onboardings, this.facilitadores, this.scrums, this.rhs, this.seniors];
      allGroups.forEach(g => g.getChildren().forEach(c => {
        const e = c as Phaser.Physics.Arcade.Sprite & { hp?: number };
        if (!e.active || !e.hp) return;
        if (Phaser.Math.Distance.Between(e.x, e.y, cx, cy) <= radius) {
          e.hp = Math.min(e.hp + 8, e.hp + 8); // HP restore
          // Pulse tint amarelo no aliado buffado
          const prevTint = e.tintTopLeft;
          e.setTint(0x88ff88);
          this.time.delayedCall(400, () => { if (e.active) e.clearTint(); });
        }
      }));
    };
    this.coordenadores.add(coord);

    const sr = new AnalistaSeniorExausto(this, 1700, FLOOR_Y - 60);
    sr.target = this.player;
    this.seniors.add(sr);

    const boss = new GerenteMicrogestor(this, 1820, FLOOR_Y - 60);
    boss.target = this.player;
    boss.onActivate = () => {
      this.hud.showBoss("Gerente Microgestor", boss.maxHp);
      this.hud.setObjective("Derrote o Gerente Microgestor!");
      Sfx.bossAppear();
    };
    boss.onHpChange = (hp) => this.hud.updateBoss(hp);
    boss.onShoot = (fx, fy, tx, ty) => {
      let e = this.emails.getFirstDead(false) as EmailProjectil | null;
      if (!e) {
        e = new EmailProjectil(this, fx, fy);
        this.emails.add(e);
      } else {
        e.setPosition(fx, fy).setActive(true).setVisible(true);
        (e.body as Phaser.Physics.Arcade.Body).enable = true;
      }
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
      this.physics.add.collider(e, this.furnitureBodies);
    };
    boss.onPhase2 = () => {
      this.hud.setObjective("FASE 2 — Deadline Inadiavel!");
      const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0.35)
        .setScrollFactor(0).setDepth(990);
      this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
      // #4 Glow: reddish tint on boss in phase 2
      boss.setTint(0xff7755);
    };
    boss.onDied = () => this.handleBossDefeat(boss);
    this.boss = boss;
    this.physics.add.collider(boss, this.platforms);
    this.physics.add.collider(boss, this.furnitureBodies);

    this.physics.add.overlap(this.inkProjectiles, boss, (inkObj) => {
      const ink = inkObj as Phaser.Physics.Arcade.Sprite;
      if (!ink.active || !this.boss?.active) return;
      const dmg = (ink.getData("damage") as number) ?? 10;
      const piercing = (ink.getData("piercing") as boolean) ?? false;
      this.boss.hit(Math.round(dmg * this.player.damageMult), 0);
      if (!piercing) ink.destroy();
    });
  }

  private firePostIt(fx: number, fy: number, tx: number, ty: number): void {
    let p = this.postits.getFirstDead(false) as PostIt | null;
    if (!p) {
      p = new PostIt(this, fx, fy);
      this.postits.add(p);
    } else {
      p.setPosition(fx, fy).setActive(true).setVisible(true);
      (p.body as Phaser.Physics.Arcade.Body).enable = true;
    }
    p.fire(tx, ty);
  }

  private handleBossDefeat(boss: GerenteMicrogestor): void {
    if (this.bossDefeated) return;
    this.bossDefeated = true;
    getRun(this).openSpaceCleared = true;
    this.hud.hideBoss();
    this.hud.setObjective("Copa desbloqueada! Use [ E ] na porta.");
    Sfx.bossDefeat();

    // Death animation: flash white, shake camera, then shrink+fade
    boss.setTint(0xffffff);
    this.cameras.main.shake(350, 0.018);
    this.cameras.main.flash(200, 255, 200, 50, false);

    const dropsPerTick = Math.max(1, Math.round(this.player.vrDropMult));
    for (let i = 0; i < 18; i++) {
      this.time.delayedCall(i * 60, () => {
        this.dropVR(boss.x + Phaser.Math.Between(-70, 70), boss.y - 20, dropsPerTick);
      });
    }

    // Delay destruction so player sees boss die
    this.tweens.add({
      targets: boss,
      scaleY: 0.1, scaleX: 1.4, alpha: 0,
      duration: 380, ease: "Power2",
      onComplete: () => { if (boss.scene) boss.destroy(); },
    });

    const run = getRun(this);
    run.autonomia = true;
    this.player.autonomia = true;
    savePersisted(run.reconhecimento, run.fgts, run.loopCount);

    this.doorCopa.clearTint();
    this.doorLabel.setText("COPA").setColor("#c9a36a");

    // #9 Hover: door label bobs to signal the way out
    this.tweens.add({
      targets: this.doorLabel,
      y: this.doorLabel.y - 5,
      duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });

    const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30,
      "GERENTE DERROTADO!\n\nPerk: AUTONOMIA ativado\n\nPorta da Copa desbloqueada ->",
      { fontFamily: "monospace", fontSize: "15px", color: "#f2c14e",
        stroke: "#000000", strokeThickness: 3, align: "center" })
      .setOrigin(0.5).setScrollFactor(0).setDepth(999);
    this.tweens.add({ targets: msg, alpha: 0, duration: 900, delay: 4500, onComplete: () => msg.destroy() });

    this.time.delayedCall(1000, () => {
      const allIds = Object.keys(CULTURAS) as CulturaId[];
      const options = (Phaser.Utils.Array.Shuffle([...allIds]) as CulturaId[]).slice(0, 3);
      this.scene.pause();
      this.scene.launch("CulturaSelectScene", { caller: "OpenSpaceV2Scene", options });
    });
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
    if (step >= comboHits) { this.cameras.main.shake(80, 0.006); Sfx.meleeHeavy(); Sfx.comboFinisher(); }
    else Sfx.meleeLight();

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
        this.spawnHitSparks(e.x, e.y - 10, step >= comboHits);
        CombatFx.flashSprite(e as unknown as Phaser.Physics.Arcade.Sprite, 55);
        if (step >= comboHits) this.combatFx.hitStop(55);
        this.combatFx.spawnDamageNumber(
          e.x, e.y - 20, damage,
          step >= comboHits ? "#ffdd44" : "#ffffff",
          step >= comboHits,
        );
        if (e.hit(damage, knockback)) {
          this.dropVR(e.x, e.y, Math.max(1, Math.round(vrDrop * this.player.vrDropMult)));
          this.tweens.add({ targets: e, scaleX: 1.6, scaleY: 0.2, alpha: 0, duration: 120, onComplete: () => e.destroy() });
          e.setActive(false);
        }
      });
    };

    hitGroup(this.estagiarios,     1, c => c as EstagiarioDesesperado);
    hitGroup(this.sobrecarregados, 2, c => c as EstagiarioSobrecarregado);
    hitGroup(this.analistas,       3, c => c as AnalistaJunior);
    hitGroup(this.onboardings,     2, c => c as AnalistaOnboarding);
    hitGroup(this.facilitadores,   2, c => c as FacilitadorDeWorkshop);
    hitGroup(this.scrums,          2, c => c as ScrumMasterCaotico);
    hitGroup(this.coordenadores,   4, c => c as CoordenadorDeSinergia);
    hitGroup(this.seniors,         6, c => c as AnalistaSeniorExausto);
    hitGroup(this.rhs,             3, c => c as EnemyRH);

    if (this.boss?.active && tryHit(this.boss)) {
      this.spawnHitSparks(this.boss.x, this.boss.y - 10, step >= comboHits);
      CombatFx.flashSprite(this.boss as unknown as Phaser.Physics.Arcade.Sprite, 55);
      if (step >= comboHits) this.combatFx.hitHeavy();
      this.combatFx.spawnDamageNumber(
        this.boss.x, this.boss.y - 20, damage,
        step >= comboHits ? "#ff4444" : "#ffcc44",
        step >= comboHits,
      );
      const died = this.boss.hit(damage, knockback);
      if (died) return;
    }
  }

  private spawnHitSparks(x: number, y: number, finisher: boolean): void {
    const count = finisher ? 10 : 5;
    const tints = finisher ? [0xff4444, 0xff8800] : [0xffcc44, 0xffffff];
    const emitter = this.add.particles(x, y, "__WHITE", {
      lifespan: finisher ? 300 : 200,
      speed: { min: 60, max: finisher ? 200 : 130 },
      angle: { min: -160, max: -20 },
      scale: { start: finisher ? 1.1 : 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: tints,
      gravityY: 600,
    }).setDepth(600);
    emitter.explode(count);
    this.time.delayedCall(400, () => { if (emitter.scene) emitter.destroy(); });
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
      d.setDepth(8).setTint(0xffd700);
      const body = d.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Phaser.Math.Between(-120, 120), Phaser.Math.Between(-260, -160));
      body.setBounce(0.4);
      body.setDrag(120, 0);
      // #4 Glow + #9 Hover: after drop settles, pulse scale
      this.time.delayedCall(700, () => {
        if (d.active && d.scene) {
          this.tweens.add({ targets: d, scaleX: 1.25, scaleY: 1.25, duration: 480, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        }
      });
    }
  }

  update(time: number, delta: number) {
    this.player.update(time, delta);
    this.player.tickPassive(time);

    // Physics body sleep: disable body for enemies far off-screen to save CPU
    const camBounds = this.cameras.main.worldView;
    const padding = 300; // px beyond viewport
    for (const group of [this.estagiarios, this.analistas, this.facilitadores,
                          this.scrums, this.coordenadores, this.seniors, this.rhs]) {
      group.getChildren().forEach((child) => {
        const sprite = child as Phaser.Physics.Arcade.Sprite;
        if (!sprite.active) return;
        const inView = sprite.x > camBounds.left - padding &&
                       sprite.x < camBounds.right + padding;
        if (sprite.body) (sprite.body as Phaser.Physics.Arcade.Body).enable = inView;
      });
    }

    // Homing projectile steering
    this.inkProjectiles.getChildren().forEach(obj => {
      const ink = obj as Phaser.Physics.Arcade.Sprite;
      if (!ink.active) return;
      const lifetime = ink.getData("lifetime") as number;
      if (lifetime && lifetime < time) { ink.destroy(); return; }
      if (!ink.getData("homing")) return;
      const allEnemies: Phaser.Physics.Arcade.Sprite[] = [];
      [this.estagiarios, this.analistas, this.facilitadores, this.scrums, this.coordenadores, this.seniors, this.rhs].forEach(g =>
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

    // EnemyRH melee hitbox
    this.rhs.getChildren().forEach(c => {
      const rh = c as EnemyRH;
      if (rh.swingActive && rh.swingHitbox && !this.player.isInvulnerable(time) &&
          Phaser.Geom.Intersects.RectangleToRectangle(rh.swingHitbox, this.player.getBounds())) {
        this.player.takeDamage(rh.swingDamage, 5, rh.x);
        rh.swingActive = false;
        rh.swingHitbox = null;
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

    // #8 Fake shadows: ellipses drawn just below each entity's feet
    this.shadowG.clear();
    this.shadowG.fillStyle(0x000000, 0.22);
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    const pLift = Math.max(0, FLOOR_Y - pb.bottom);
    this.shadowG.fillEllipse(this.player.x, Math.min(pb.bottom, FLOOR_Y) + 4, Math.max(10, 32 - pLift * 0.14), Math.max(2, 6 - pLift * 0.03));
    [this.estagiarios, this.analistas, this.facilitadores, this.scrums, this.coordenadores, this.seniors, this.rhs].forEach(g =>
      g.getChildren().forEach(c => {
        const e = c as Phaser.Physics.Arcade.Sprite;
        if (!e.active) return;
        const eb = e.body as Phaser.Physics.Arcade.Body;
        this.shadowG.fillEllipse(e.x, Math.min(eb.bottom, FLOOR_Y) + 4, 26, 5);
      })
    );
    if (this.boss?.active) {
      const bb = this.boss.body as Phaser.Physics.Arcade.Body;
      const bLift = Math.max(0, FLOOR_Y - bb.bottom);
      this.shadowG.fillEllipse(this.boss.x, Math.min(bb.bottom, FLOOR_Y) + 4, Math.max(14, 44 - bLift * 0.1), Math.max(3, 8 - bLift * 0.03));
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
      parryState: this.player.getParryState(time),
    });
  }
}
