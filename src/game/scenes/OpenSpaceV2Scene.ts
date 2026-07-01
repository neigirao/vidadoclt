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
import { ParticleFactory } from "../systems/ParticleFactory";
import { SanityFx } from "../systems/SanityFx";
import { CombatFx } from "../systems/CombatFx";
import { Hud } from "../systems/Hud";
import { reapplyAllPerks, applyPerk, checkAndApplySynergies, PERKS, SYNERGIES, PerkId } from "../systems/PerkSystem";
import { reapplyAllCulturas } from "../systems/CulturaSystem";
import { HEAT_LEVELS } from "./HoraExtraScene";
import { CulturaId, CULTURAS } from "../systems/CulturaSystem";
import { addImage, resolveSprite } from "../systems/SpriteLibrary";
import { Sfx } from "../systems/AudioSystem";
import { Music } from "../systems/MusicSystem";
import { validateLevel, logLevelReport, drawLevelOverlay } from "../systems/LevelValidator";

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
  private coffeeDrops!: Phaser.Physics.Arcade.Group;
  private boss?: GerenteMicrogestor;
  private bossDefeated = false;
  // Ids de golpe: golpes avulsos (K) usam ids negativos decrescentes; a dedup e
  // o juice da janela ativa comparam por id para agir 1x por golpe.
  private _oneShotSwingId = 0;
  private _juiceSwingDone = 0;
  private startTimeMs = 0;
  private fx!: SanityFx;
  private combatFx!: CombatFx;
  private hud!: Hud;
  private shadowG!: Phaser.GameObjects.Graphics;
  private doorCopa!: Phaser.GameObjects.Image;
  private doorLabel!: Phaser.GameObjects.Text;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private levelWidth = LEVEL_WIDTH;
  private reuniaoUsed = false;
  private bossEntryTriggered = false;
  private tutorialShown = false;

  // Item 1 — Produtividade (combo de kills encadeados)
  private prodStreak = 0;
  private prodLastKillAt = -9999;
  private prodMeter!: Phaser.GameObjects.Graphics;
  private prodLabel!: Phaser.GameObjects.Text;
  private static readonly PROD_WINDOW_MS = 4000;

  // Item 2 — Evento aleatório da sala
  private eventVrMult = 1;
  private eventNoSanityDrain = false;

  // Marcadores de "healer" (ícone + sobre o coordenador) — seguem o inimigo
  private healerMarkers: { e: Phaser.Physics.Arcade.Sprite; m: Phaser.GameObjects.Text }[] = [];

  constructor() {
    super("OpenSpaceV2Scene");
  }

  create() {
    const run = getRun(this);
    const seedNum = run.seed ? parseInt(run.seed.replace(/\D/g, "").slice(0, 8) || "0", 10) : 0;
    const seedVariant = seedNum % 4; // 0–3: 4 variantes de layout
    this.startTimeMs = this.time.now;
    this.bossDefeated = false;
    Music.start("office");

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.bg);

    addPhaseBackground(this, "pxbg-openspace", HUD_TOP_H, FLOOR_Y);
    this.spawnDustParticles();
    this.buildClockOverlays();

    // Office bay decoratives — depth 2 (behind furniture surfaces at depth 4-6)
    [80, 340, 600, 860, 1120, 1380, 1640, 1880].forEach(x => {
      addImage(this, x, FLOOR_Y - 28, "tex-baia").setDepth(2);
    });

    // Item 5 — Mid parallax layer: rows of distant cubicles drifting at 0.5
    // (entre o fundo em 0.2 e o mundo em 1.0 → cria profundidade real de 3 camadas)
    const mid = this.add.graphics().setDepth(1).setScrollFactor(0.5, 0);
    for (let x = 60; x < LEVEL_WIDTH; x += 180) {
      mid.fillStyle(0x161d27, 0.6);
      mid.fillRect(x, FLOOR_Y - 56, 70, 56);          // divisória distante
      mid.fillStyle(0x1d2733, 0.6);
      mid.fillRect(x + 6, FLOOR_Y - 50, 58, 6);        // topo da divisória
      mid.fillStyle(0x10161e, 0.5);
      mid.fillRect(x + 30, FLOOR_Y - 44, 18, 14);      // monitor distante
    }

    // Item 4 — Dithering pass: padrão xadrez sutil escurece o fundo em degradê,
    // unificando a paleta e suavizando as bandas de luz das janelas
    const dither = this.add.graphics().setDepth(1).setScrollFactor(0.2, 0);
    dither.fillStyle(0x0a0d12, 0.18);
    for (let yy = HUD_TOP_H; yy < FLOOR_Y; yy += 4) {
      const shade = (yy - HUD_TOP_H) / (FLOOR_Y - HUD_TOP_H); // mais escuro embaixo
      for (let xx = 0; xx < LEVEL_WIDTH; xx += 4) {
        if (((xx >> 2) + (yy >> 2)) % 2 === 0 && Math.random() < 0.4 + shade * 0.4) {
          dither.fillRect(xx, yy, 2, 2);
        }
      }
    }

    // Foreground parallax layer — silhouettes slightly in front of player
    // scrollFactor 1.05 = moves 5% faster than world = feels closer to camera
    [100, 500, 900, 1300, 1700].forEach(x => {
      const fg = this.add.graphics().setDepth(20).setScrollFactor(1.05);
      fg.fillStyle(0x0a0c0f, 0.55);
      // Vertical post
      fg.fillRect(x - 3, FLOOR_Y - 80, 6, 80);
      // Horizontal top rail (wider — creates L-shape of cubicle)
      fg.fillRect(x - 40, FLOOR_Y - 82, 80, 4);
      // Cap on post top (darker accent)
      fg.fillStyle(0x0a0c0f, 0.85);
      fg.fillRect(x - 4, FLOOR_Y - 84, 8, 4);
    });

    this.platforms = this.physics.add.staticGroup();
    this.furnitureBodies = this.physics.add.staticGroup();
    this.buildFloor();

    // Feature 4: Platforms vary by seed variant (3 layouts)
    if (seedVariant === 0) {
      // Default layout
      this.buildPlatform(200,  FLOOR_Y - 30, 5);
      this.buildPlatform(460,  FLOOR_Y - 72, 4);
      this.buildPlatform(700,  FLOOR_Y - 30, 5);
      this.buildPlatform(1000, FLOOR_Y - 72, 6);
      this.buildPlatform(1350, FLOOR_Y - 30, 5);
      this.buildPlatform(1620, FLOOR_Y - 72, 4);
    } else if (seedVariant === 1) {
      // Elevated layout — more platforms high up
      this.buildPlatform(180,  FLOOR_Y - 72, 4);
      this.buildPlatform(440,  FLOOR_Y - 30, 5);
      this.buildPlatform(720,  FLOOR_Y - 72, 5);
      this.buildPlatform(1040, FLOOR_Y - 30, 6);
      this.buildPlatform(1380, FLOOR_Y - 72, 5);
      this.buildPlatform(1640, FLOOR_Y - 30, 4);
    } else if (seedVariant === 2) {
      // Dense layout — more platforms, smaller gaps
      this.buildPlatform(150,  FLOOR_Y - 30, 4);
      this.buildPlatform(380,  FLOOR_Y - 60, 4);
      this.buildPlatform(620,  FLOOR_Y - 30, 4);
      this.buildPlatform(860,  FLOOR_Y - 60, 5);
      this.buildPlatform(1140, FLOOR_Y - 30, 5);
      this.buildPlatform(1400, FLOOR_Y - 60, 4);
      this.buildPlatform(1660, FLOOR_Y - 30, 3);
    } else {
      // Staircase layout — escadas escalonadas que sobem/descem, exigindo
      // pulos encadeados (mostra a alcançabilidade em cadeia + premia subir).
      this.buildPlatform(240,  FLOOR_Y - 32, 4);
      this.buildPlatform(430,  FLOOR_Y - 72, 4);
      this.buildPlatform(720,  FLOOR_Y - 40, 5);
      this.buildPlatform(980,  FLOOR_Y - 72, 4);
      this.buildPlatform(1200, FLOOR_Y - 40, 4);
      this.buildPlatform(1440, FLOOR_Y - 72, 5);
      this.buildPlatform(1660, FLOOR_Y - 36, 4);
    }

    // Floor-level decoratives
    addImage(this, 60,   FLOOR_Y - 28, "tex-cafe-machine").setDepth(8).setDisplaySize(40, 56);
    addImage(this, 490,  FLOOR_Y - 24, "tex-bebedouro").setDepth(8).setDisplaySize(32, 48);
    addImage(this, 140,  FLOOR_Y - 32, "tex-ponto").setDepth(8).setDisplaySize(32, 48);
    // Extintor: drawn procedurally (frame not in atlas)
    const ext = this.add.graphics().setDepth(8);
    ext.fillStyle(0xcc2020, 1);
    ext.fillRect(1793, FLOOR_Y - 44, 14, 30);  // body
    ext.fillStyle(0x882020, 1);
    ext.fillRect(1793, FLOOR_Y - 44, 14, 4);   // band
    ext.fillStyle(0x555555, 1);
    ext.fillRect(1797, FLOOR_Y - 50, 6, 8);    // neck
    ext.fillStyle(0x333333, 1);
    ext.fillRect(1795, FLOOR_Y - 14, 10, 6);   // base

    // (computadores agora ficam em cima das mesas — ver buildPlatform)

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
    checkAndApplySynergies(this.player, run);
    // Feature 7: Apply heat VR multiplier
    const heatLvl = HEAT_LEVELS[run.heatLevel ?? 0] ?? HEAT_LEVELS[0];
    this.player.vrDropMult *= heatLvl.vrMult;

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

    this.player.onAttack = (hb, step, swingId, firstFrame) => this.resolveAttack(hb, step, swingId, firstFrame);

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

    // Parry "Reclamar" — stun nearest enemy, gold burst VFX
    this.player.onParrySuccess = (_fromX: number) => {
      const allGroups = [this.estagiarios, this.sobrecarregados, this.analistas, this.onboardings,
        this.facilitadores, this.scrums, this.coordenadores, this.seniors, this.rhs];
      let closest: (Phaser.Physics.Arcade.Sprite & { frozenUntil?: number }) | null = null;
      let closestDist = 160;
      allGroups.forEach(g => g?.getChildren().forEach(c => {
        const e = c as Phaser.Physics.Arcade.Sprite & { frozenUntil?: number };
        if (!e.active) return;
        const d = Math.abs(e.x - this.player.x);
        if (d < closestDist) { closestDist = d; closest = e; }
      }));
      if (closest) {
        const e = closest as Phaser.Physics.Arcade.Sprite & { frozenUntil?: number };
        e.frozenUntil = this.time.now + 800;
        e.setTint(0x00ffdd);
        this.time.delayedCall(800, () => { if (e.active) e.clearTint(); });
      }
      const burst = this.add.text(this.player.x, this.player.y - 40, "RECLAMEI!", {
        fontFamily: "monospace", fontSize: "13px", color: "#ffdd00",
        stroke: "#000000", strokeThickness: 2,
      }).setOrigin(0.5).setDepth(200);
      this.tweens.add({ targets: burst, y: burst.y - 30, alpha: 0, duration: 700, onComplete: () => burst.destroy() });
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
    this.coffeeDrops  = this.physics.add.group();
    this.inkProjectiles = this.physics.add.group();
    this.drops        = this.physics.add.group();

    // Recompensa de exploração vertical: cache de VR na plataforma mais alta.
    this.spawnVerticalReward();

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
    // Enemies collide with world bounds so they turn at level edges
    [this.estagiarios, this.sobrecarregados, this.analistas, this.onboardings,
     this.facilitadores, this.scrums, this.coordenadores, this.seniors, this.rhs].forEach(g => {
      g.getChildren().forEach(c => {
        const body = (c as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
        body.setCollideWorldBounds(true);
      });
    });

    // Separação entre inimigos de chão: evita que se empilhem no mesmo ponto.
    // A colisão só resolve a sobreposição (empurra de leve para o lado); a IA
    // re-aplica a velocidade no frame seguinte, então continuam perseguindo.
    const groundGroups = [this.estagiarios, this.sobrecarregados, this.analistas,
      this.facilitadores, this.scrums, this.coordenadores, this.seniors, this.rhs];
    for (let i = 0; i < groundGroups.length; i++) {
      this.physics.add.collider(groundGroups[i], groundGroups[i]);
      for (let j = i + 1; j < groundGroups.length; j++) {
        this.physics.add.collider(groundGroups[i], groundGroups[j]);
      }
    }

    // Inimigos respeitam a mobília (opção "colidem e sobem"): antes atravessavam
    // as mesas. Agora colidem e, quando travam de lado no chão, dão um pulinho —
    // sobem/pulam mesas baixas e "tentam escalar" as altas (patrulheiros também
    // viram pela lógica de body.blocked). Throttle p/ não pular todo frame.
    const hopOverFurniture: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (eObj) => {
      const e = eObj as Phaser.Physics.Arcade.Sprite;
      const body = e.body as Phaser.Physics.Arcade.Body;
      if (!body || !body.blocked.down) return;
      if (!(body.blocked.left || body.blocked.right)) return;
      const now = this.time.now;
      if (now < (e.getData("nextHop") as number ?? 0)) return;
      body.setVelocityY(-320);
      e.setData("nextHop", now + 500);
    };
    [...groundGroups, this.onboardings].forEach(g =>
      this.physics.add.collider(g, this.furnitureBodies, hopOverFurniture),
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
          const prodMult = this.registerKill(enemy.x, enemy.y);
          this.dropVR(enemy.x, enemy.y, Math.max(1, Math.round(vrDrop * this.player.vrDropMult * this.eventVrMult * prodMult)));
          if (this.player.healOnKill > 0) this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + this.player.healOnKill);
          this.player.onKill?.();
          enemy.destroy();
        }
        if (!piercing) ink.destroy();
      });
    });

    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      this.player.addVR(1);
      (dObj as Phaser.Physics.Arcade.Sprite).destroy();
    });

    // Feature 5: Coffee pickup
    this.physics.add.collider(this.coffeeDrops, this.platforms);
    this.physics.add.overlap(this.player, this.coffeeDrops, (_p, cObj) => {
      (cObj as Phaser.Physics.Arcade.Sprite).destroy();
      if (this.player.consumivel && this.player.consumivelUses > 0) {
        this.player.consumivelUses++;
      } else {
        this.player.consumivel = "cafe";
        this.player.consumivelUses = 2;
      }
      const msg = this.add.text(this.player.x, this.player.y - 40, "☕ CAFÉ +2",
        { fontFamily: "monospace", fontSize: "12px", color: "#ffcc44", stroke: "#000000", strokeThickness: 2 })
        .setOrigin(0.5).setDepth(200);
      this.tweens.add({ targets: msg, y: msg.y - 28, alpha: 0, duration: 700, onComplete: () => msg.destroy() });
    });

    // Pause on ESC
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => {
      this.scene.pause();
      this.scene.launch("PauseScene", { caller: "OpenSpaceV2Scene" });
    });

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

    // Feature 2: Reunião Relâmpago NPC at x=900
    this.spawnReuniao(900, run);

    // Feature 6: MEMO perk collectible on elevated platform
    if (!run.openSpaceCleared) {
      this.spawnMemo(1000, FLOOR_Y - 105, run);
    }

    this.fx       = new SanityFx(this);
    this.combatFx = new CombatFx(this);
    this.hud = new Hud(this, LEVEL_WIDTH);
    this.shadowG = this.add.graphics().setDepth(5);

    // #5 Camera flash + #6 Chromatic aberration on player hit
    this.player.onHit = () => {
      this.cameras.main.flash(60, 255, 20, 20, false);
      this.fx.triggerChromaticHit();
    };
    this.hud.setPhaseTitle("FASE 1 — OPEN SPACE  [v2]");
    this.hud.setObjective("Derrote o Gerente e acesse a Copa");

    // Item 1 — medidor de Produtividade (fixo na câmera)
    this.prodMeter = this.add.graphics().setScrollFactor(0).setDepth(908);
    this.prodLabel = this.add.text(GAME_WIDTH / 2, 64, "", {
      fontFamily: "monospace", fontSize: "9px", color: "#aaffaa",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(908);

    // Item 2 — modificador da sala (depende do seed + loop)
    this.rollRoomEvent(run);

    // Validação de fase (só DEV): garante que a variante montada é jogável/justa.
    // Loga no console e permite alternar um overlay visual com a tecla V.
    if (import.meta.env.DEV) {
      const spec = {
        label: "OpenSpaceV2", seedVariant,
        floorY: FLOOR_Y, ceilingY: HUD_TOP_H, levelWidth: LEVEL_WIDTH,
        playerSpawn: { x: spawnX, y: FLOOR_Y - 60 },
        jumpVel: -520, gravity: 1200, // JUMP_VEL / GRAVITY (Player.ts / config.ts)
        platforms: this.platforms, furniture: this.furnitureBodies,
        enemies: [this.estagiarios, this.sobrecarregados, this.analistas, this.onboardings,
          this.facilitadores, this.scrums, this.coordenadores, this.seniors, this.rhs],
        boss: this.boss, exit: { x: this.doorCopa.x, y: this.doorCopa.y },
      };
      const report = validateLevel(spec);
      logLevelReport(`OpenSpaceV2 (seed variant ${seedVariant})`, report);
      let overlay: Phaser.GameObjects.Container | undefined;
      this.input.keyboard?.on("keydown-V", () => {
        if (overlay) { overlay.destroy(); overlay = undefined; }
        else overlay = drawLevelOverlay(this, spec, report);
      });
    }
  }

  // Animated clock hands overlaid on background clock positions
  // Clock faces baked in background texture at x=[240,540,840,1140,1440,1740], y=76
  private buildClockOverlays(): void {
    const CLOCK_POSITIONS = [240, 540, 840, 1140, 1440, 1740];
    const CLOCK_Y = 76; // matches drawOffice clock y=76 in background texture
    const clockG = this.add.graphics().setDepth(3).setScrollFactor(0.2, 0);

    const drawHands = () => {
      clockG.clear();
      const now = new Date();
      const minutes = now.getMinutes();
      const hours = now.getHours() % 12 + minutes / 60;
      const minAngle = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
      const hrAngle = (hours / 12) * Math.PI * 2 - Math.PI / 2;
      CLOCK_POSITIONS.forEach(cx => {
        const cy = CLOCK_Y;
        clockG.fillStyle(0x14100a, 1);
        // Minute hand (long)
        clockG.fillRect(
          cx + Math.round(Math.cos(minAngle) * 10) - 1,
          cy + Math.round(Math.sin(minAngle) * 10) - 1, 2, 2,
        );
        clockG.lineStyle(1, 0x14100a, 1);
        clockG.lineBetween(cx, cy, cx + Math.cos(minAngle) * 10, cy + Math.sin(minAngle) * 10);
        // Hour hand (short)
        clockG.lineBetween(cx, cy, cx + Math.cos(hrAngle) * 6, cy + Math.sin(hrAngle) * 6);
      });
    };

    drawHands();
    this.time.addEvent({ delay: 1000, loop: true, callback: drawHands });
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

  // Marca um inimigo como healer com um "+" verde flutuante (leitura de ameaça).
  private tagHealer(e: Phaser.Physics.Arcade.Sprite): void {
    const m = this.add.text(e.x, e.y - e.displayHeight - 4, "✚", {
      fontFamily: "monospace", fontSize: "13px", color: "#55ff99",
      stroke: "#06301c", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(560);
    this.healerMarkers.push({ e, m });
  }

  private updateHealerMarkers(time: number): void {
    const bob = Math.sin(time / 250) * 2;
    for (let i = this.healerMarkers.length - 1; i >= 0; i--) {
      const { e, m } = this.healerMarkers[i];
      if (!e.active) { m.destroy(); this.healerMarkers.splice(i, 1); continue; }
      m.setPosition(e.x, e.y - e.displayHeight - 4 + bob);
    }
  }

  private spawnEnemies(): void {
    // ── Dificuldade escalonada: fácil (esquerda) → difícil (direita) ──────────
    // O jogador entra em x≈80 e avança para a direita rumo ao boss (x≈1820).
    // Zona 1 (300-560): só estagiários (melee básico) para ensinar o combate.
    // Zona 2 (660-990): sobrecarregados + analistas junior.
    // Zona 3 (1100-1210): RH (perseguidores).
    // Zona 4 (1320-1620): inimigos à distância (onboarding + facilitador).
    // Zona 5 (1480-1740): elite — scrum, coordenador (healer) e sênior (tanky).

    // Zona 1 — Estagiários Desesperados
    [320, 440, 560].forEach(x => {
      const e = new EstagiarioDesesperado(this, x, FLOOR_Y - 40, Math.random() > 0.5 ? 1 : -1);
      e.target = this.player;
      this.estagiarios.add(e);
    });

    // Zona 2 — Estagiários Sobrecarregados
    [660, 770].forEach(x => {
      const e = new EstagiarioSobrecarregado(this, x, FLOOR_Y - 40, Math.random() > 0.5 ? 1 : -1);
      e.target = this.player;
      this.sobrecarregados.add(e);
    });

    // Zona 4 — Analistas em Onboarding (ranged)
    [1320, 1430].forEach(x => {
      const a = new AnalistaOnboarding(this, x, FLOOR_Y - 60);
      a.target = this.player;
      a.onShoot = (fx, fy, tx, ty) => {
        let p = this.postits.getFirstDead(false) as PostIt | null;
        if (!p) {
          p = new PostIt(this, fx, fy);
          this.postits.add(p);
        } else {
          p.setPosition(fx, fy).setActive(true).setVisible(true);
          (p.body as Phaser.Physics.Arcade.Body).enable = true;
        }
        p.fire(tx, ty);
      };
      this.onboardings.add(a);
    });

    // Zona 4 — Facilitadores de Workshop (ranged)
    [1520, 1620].forEach(x => {
      const f = new FacilitadorDeWorkshop(this, x, FLOOR_Y - 60);
      f.target = this.player;
      f.onShoot = (fx, fy, tx, ty) => {
        let p = this.postits.getFirstDead(false) as PostIt | null;
        if (!p) {
          p = new PostIt(this, fx, fy);
          this.postits.add(p);
        } else {
          p.setPosition(fx, fy).setActive(true).setVisible(true);
          (p.body as Phaser.Physics.Arcade.Body).enable = true;
        }
        p.fire(tx, ty);
      };
      this.facilitadores.add(f);
    });

    // Zona 5 — Scrum Master Caótico (elite, perto do boss)
    const scrum = new ScrumMasterCaotico(this, 1480, FLOOR_Y - 60);
    scrum.target = this.player;
    scrum.onShout = (fromX) => {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, fromX, this.player.y) < 260) {
        const dir = fromX < this.player.x ? -1 : 1;
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(dir * -220);
      }
    };
    this.scrums.add(scrum);

    // Zona 2 — Analistas Junior (melee)
    [880, 990].forEach(x => {
      const a = new AnalistaJunior(this, x, FLOOR_Y - 60);
      a.target = this.player;
      this.analistas.add(a);
    });

    // Zona 3 — RH (perseguidores)
    [1100, 1210].forEach(x => {
      const rh = new EnemyRH(this, x, FLOOR_Y - 60);
      rh.target = this.player;
      this.rhs.add(rh);
    });

    // Zona 5 — Coordenador de Sinergia (HEALER, prioridade) guardando o boss
    const coord = new CoordenadorDeSinergia(this, 1660, FLOOR_Y - 60);
    coord.target = this.player;
    coord.onCoffeeDrop = (cx, cy) => this.spawnCoffeeDrop(cx, cy);
    this.coordenadores.add(coord);
    this.tagHealer(coord);

    // Zona 5 — Analista Sênior Exausto (tanky)
    const sr = new AnalistaSeniorExausto(this, 1740, FLOOR_Y - 60);
    sr.target = this.player;
    this.seniors.add(sr);

    const boss = new GerenteMicrogestor(this, 1820, FLOOR_Y - 60);
    boss.target = this.player;
    boss.onActivate = () => {
      this.hud.showBoss("Gerente Microgestor", boss.maxHp);
      this.hud.setObjective("Derrote o Gerente Microgestor!");
      Sfx.bossAppear();
      Music.start("boss");
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

    // Feature 3 + 7: Loop difficulty + Heat scaling
    const runNow = getRun(this);
    const loop = runNow.loopCount ?? 0;
    const heatDef = HEAT_LEVELS[runNow.heatLevel ?? 0] ?? HEAT_LEVELS[0];
    if (loop > 0 || heatDef.hpMult > 1) {
      const hpMult = (1 + loop * 0.2) * heatDef.hpMult; // +20% per loop + heat mult
      const allEnemyGroups = [
        this.estagiarios, this.sobrecarregados, this.analistas, this.onboardings,
        this.facilitadores, this.scrums, this.coordenadores, this.seniors, this.rhs,
      ];
      allEnemyGroups.forEach(g => g.getChildren().forEach(c => {
        const e = c as Phaser.Physics.Arcade.Sprite & { hp: number };
        if (e.hp !== undefined) e.hp = Math.round(e.hp * hpMult);
      }));
      // At loop >= 3, make 1 enemy per group "jammed" (golden tint, +50% HP)
      if (loop >= 3) {
        allEnemyGroups.forEach(g => {
          const children = g.getChildren();
          if (children.length === 0) return;
          const jammed = children[0] as Phaser.Physics.Arcade.Sprite & { hp: number };
          jammed.setTint(0xffaa00);
          if (jammed.hp !== undefined) jammed.hp = Math.round(jammed.hp * 1.5);
          // Label it
          const jamLabel = this.add.text(jammed.x, jammed.y - 30, "TRAVADO", {
            fontFamily: "monospace", fontSize: "7px", color: "#ffaa00",
          }).setOrigin(0.5).setDepth(500);
          this.time.delayedCall(2000, () => { if (jamLabel.scene) jamLabel.destroy(); });
        });
      }
    }

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
    if (this.bossDefeated) return;
    this.bossDefeated = true;
    getRun(this).openSpaceCleared = true;
    this.hud.hideBoss();
    this.hud.setObjective("Copa desbloqueada! Use [ E ] na porta.");

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

  private checkSynergiesAndPopup(run: import("../systems/PlayerState").RunState): void {
    const prevSynergies = run.activeSynergies ?? [];
    const newSynergies = checkAndApplySynergies(this.player, run);
    const gained = newSynergies.filter(id => !prevSynergies.includes(id));
    if (gained.length === 0) return;
    const syn = SYNERGIES[gained[0]];
    if (!syn) return;
    const popup = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 90,
      `${syn.icon} SINERGIA ATIVADA!\n${syn.name}\n${syn.desc}`,
      { fontFamily: "monospace", fontSize: "12px", color: "#ffdd44",
        stroke: "#000000", strokeThickness: 3, align: "center" })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1100);
    this.tweens.add({ targets: popup, alpha: 0, duration: 800, delay: 2500, onComplete: () => popup.destroy() });
  }

  private resolveAttack(hb: Phaser.Geom.Rectangle, step: number, swingId?: number, firstFrame = true): void {
    // Um golpe = um swingId. Frames seguintes da janela ativa reusam o mesmo id;
    // a dedup por inimigo (getData("hitSwing")) garante 1 hit por golpe. Golpes
    // avulsos (especial K) chegam sem swingId → recebem um id único descartável.
    const sid = swingId ?? (this._oneShotSwingId -= 1);
    const def = WEAPONS[this.player.weaponId as WeaponId] ?? WEAPONS.grampeador;
    const comboHits = def.hitDamages[2] === 0 ? 2 : 3;
    const dmgIndex = Math.min(step - 1, def.hitDamages.length - 1);
    const baseDmg = def.hitDamages[dmgIndex] || def.hitDamages[0];
    let strikeMult = 1.0;
    if (firstFrame && this.player.firstStrikeReady) {
      this.player.firstStrikeReady = false;
      strikeMult = 1.5;
      this.cameras.main.flash(180, 255, 215, 0, false);
    }
    const damage = Math.round(baseDmg * this.player.damageMult * strikeMult);
    const knockback = (step >= comboHits ? def.comboKnockback : 80) * this.player.facing;
    const slowMs = def.hitSlow;
    const isFinisher = step >= comboHits;

    // Efeito visual do arco + SFX: só no 1º frame do golpe (não a cada frame).
    if (firstFrame) {
      const slash = this.add.graphics().setDepth(15);
      const cx = hb.x + hb.width / 2;
      const cy = hb.y + hb.height / 2;
      const r = Math.max(hb.width, hb.height) * 0.6;
      const startAngle = this.player.facing > 0 ? -Math.PI * 0.6 : Math.PI * 0.4;
      const endAngle   = this.player.facing > 0 ?  Math.PI * 0.6 : Math.PI * 1.6;
      slash.lineStyle(3, 0xffffff, 0.75);
      slash.beginPath();
      slash.arc(cx, cy, r, startAngle, endAngle, false);
      slash.strokePath();
      this.tweens.add({ targets: slash, alpha: 0, scaleX: 1.2, scaleY: 1.2, duration: 140, ease: "Quad.easeOut", onComplete: () => slash.destroy() });
      if (isFinisher) { Sfx.meleeHeavy(); Sfx.comboFinisher(); }
      else Sfx.meleeLight();
    }

    let hitAnything = false;

    const tryHit = (s: Phaser.Physics.Arcade.Sprite) =>
      Phaser.Geom.Intersects.RectangleToRectangle(hb, s.getBounds());
    // Já acertado neste golpe? (dedup da janela ativa)
    const freshHit = (s: Phaser.GameObjects.GameObject) => {
      if (s.getData("hitSwing") === sid) return false;
      s.setData("hitSwing", sid);
      return true;
    };

    const hitGroup = (
      group: Phaser.Physics.Arcade.Group,
      vrDrop: number,
      cast: (c: Phaser.GameObjects.GameObject) => Phaser.Physics.Arcade.Sprite & { hit: (d: number, k: number) => boolean; applySlowdown?: (ms: number) => void },
    ) => {
      group.getChildren().forEach(c => {
        const e = cast(c);
        if (!e.active || !tryHit(e) || !freshHit(e)) return;
        hitAnything = true;
        if (slowMs > 0 && e.applySlowdown) e.applySlowdown(slowMs);
        this.spawnHitSparks(e.x, e.y - 10, isFinisher);
        CombatFx.flashSprite(e as unknown as Phaser.Physics.Arcade.Sprite, 55);
        if (isFinisher) {
          ParticleFactory.hitHeavy(this, e.x, e.y - 20);
        } else {
          ParticleFactory.hitLight(this, e.x, e.y - 20);
        }
        this.combatFx.spawnDamageNumber(
          e.x, e.y - 20, damage,
          isFinisher ? "#ff4444" : "#ffcc44",
          isFinisher,
        );
        if (e.hit(damage, knockback)) {
          ParticleFactory.enemyDeath(this, e.x, e.y - 10);
          const prodMult = this.registerKill(e.x, e.y);
          this.dropVR(e.x, e.y, Math.max(1, Math.round(vrDrop * this.player.vrDropMult * this.eventVrMult * prodMult)));
          if (this.player.healOnKill > 0) this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + this.player.healOnKill);
          this.player.onKill?.();
          this.tweens.add({ targets: e, y: e.y - 18, scaleY: 0.5, alpha: 0, duration: 200, ease: "Quad.easeOut", onComplete: () => e.destroy() });
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

    if (this.boss?.active && tryHit(this.boss) && freshHit(this.boss)) {
      hitAnything = true;
      this.spawnHitSparks(this.boss.x, this.boss.y - 10, isFinisher);
      CombatFx.flashSprite(this.boss as unknown as Phaser.Physics.Arcade.Sprite, 55);
      if (isFinisher) {
        ParticleFactory.hitHeavy(this, this.boss.x, this.boss.y - 20);
        this.combatFx.hitHeavy();
      } else {
        ParticleFactory.hitLight(this, this.boss.x, this.boss.y - 20);
      }
      this.combatFx.spawnDamageNumber(
        this.boss.x, this.boss.y - 20, damage,
        isFinisher ? "#ff4444" : "#ffcc44",
        isFinisher,
      );
      const died = this.boss.hit(damage, knockback);
      if (died) return;
    }

    // Juice (hitStop/finisher/shake) só uma vez por golpe — mesmo que a janela
    // ativa acerte inimigos em frames diferentes.
    if (hitAnything && this._juiceSwingDone !== sid) {
      this._juiceSwingDone = sid;
      const hitPauseMs = Math.min(120, 30 + damage * 3);
      this.combatFx.hitStop(hitPauseMs);
      if (isFinisher) {
        this.combatFx.comboFinisher(this.player.x, hb.x + hb.width / 2);
      } else {
        this.combatFx.hitLight();
      }
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

  private spawnMemo(mx: number, my: number, run: import("../systems/PlayerState").RunState): void {
    // White rectangle MEMO collectible — press E near it to get a random perk
    const memoG = this.add.graphics().setDepth(9);
    memoG.fillStyle(0xffffff, 1);
    memoG.fillRect(mx - 10, my - 14, 20, 26);
    memoG.lineStyle(1, 0xcccccc, 1);
    memoG.strokeRect(mx - 10, my - 14, 20, 26);
    // Lines on memo
    memoG.lineStyle(1, 0xaaaaaa, 0.5);
    for (let li = 0; li < 4; li++) memoG.lineBetween(mx - 7, my - 10 + li * 5, mx + 7, my - 10 + li * 5);

    const memoLabel = this.add.text(mx, my - 22, "MEMO", {
      fontFamily: "monospace", fontSize: "8px", color: "#f2a800",
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: [memoG, memoLabel], y: "-=5", duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    let memoTaken = false;
    const memoZone = this.add.zone(mx, my, 40, 40);
    this.physics.add.existing(memoZone, true);
    this.physics.add.overlap(this.player, memoZone, () => {
      if (memoTaken) return;
      if (Phaser.Input.Keyboard.JustDown(this.interactKey) || this.player.gamepadInteractJustPressed) {
        memoTaken = true;
        memoG.destroy();
        memoLabel.destroy();
        // Apply a random perk the player doesn't have yet
        const allPerkIds = Object.keys(PERKS) as PerkId[];
        const available = allPerkIds.filter(id => !(run.perks ?? []).includes(id));
        if (available.length > 0) {
          const chosen = Phaser.Utils.Array.GetRandom(available) as PerkId;
          applyPerk(chosen, this.player, run);
          this.checkSynergiesAndPopup(run);
          this.hud.setPerks(run.perks ?? []);
          const perk = PERKS[chosen];
          const msg = this.add.text(this.player.x, this.player.y - 50,
            `MEMO!\nPerk: ${perk.name}`,
            { fontFamily: "monospace", fontSize: "13px", color: "#ffffff",
              stroke: "#000000", strokeThickness: 2, align: "center" })
            .setOrigin(0.5).setDepth(999);
          this.tweens.add({ targets: msg, alpha: 0, duration: 800, delay: 2200, onComplete: () => msg.destroy() });
        }
      }
    });
  }

  private spawnReuniao(nx: number, run: import("../systems/PlayerState").RunState): void {
    // "?" NPC that offers 2 random free perks to choose from
    const npcG = this.add.graphics().setDepth(9);
    npcG.fillStyle(0xf2a800, 1);
    npcG.fillRect(nx - 12, FLOOR_Y - 48, 24, 40);
    npcG.fillStyle(0xe8d0b0, 1);
    npcG.fillEllipse(nx, FLOOR_Y - 52, 20, 20);
    const npcLabel = this.add.text(nx, FLOOR_Y - 72, "?", {
      fontFamily: "monospace", fontSize: "22px", fontStyle: "bold",
      color: "#ffdd00", stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);
    // bob animation
    this.tweens.add({ targets: npcLabel, y: npcLabel.y - 6, duration: 800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    const npcZone = this.add.zone(nx, FLOOR_Y - 30, 60, 60);
    this.physics.add.existing(npcZone, true);
    this.physics.add.overlap(this.player, npcZone, () => {
      if (this.reuniaoUsed) return;
      if (Phaser.Input.Keyboard.JustDown(this.interactKey) || this.player.gamepadInteractJustPressed) {
        this.reuniaoUsed = true;
        this.showPerkChoice(run, npcG, npcLabel);
      }
    });
  }

  private showPerkChoice(run: import("../systems/PlayerState").RunState, npcG: Phaser.GameObjects.Graphics, npcLabel: Phaser.GameObjects.Text): void {
    const allPerkIds = Object.keys(PERKS) as PerkId[];
    const available = allPerkIds.filter(id => !(run.perks ?? []).includes(id));
    if (available.length === 0) return;
    const options = Phaser.Utils.Array.Shuffle([...available]).slice(0, 2) as PerkId[];

    this.scene.pause();

    const overlay = this.add.container(0, 0).setDepth(2000).setScrollFactor(0);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.add(bg);

    overlay.add(this.add.text(GAME_WIDTH / 2, 120, "REUNIAO RELAMPAGO", {
      fontFamily: "monospace", fontSize: "20px", fontStyle: "bold", color: "#f2a800",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5));
    overlay.add(this.add.text(GAME_WIDTH / 2, 148, "Escolha um perk gratuito:", {
      fontFamily: "monospace", fontSize: "11px", color: "#aaaaaa",
    }).setOrigin(0.5));

    options.forEach((perkId, i) => {
      const perk = PERKS[perkId];
      const bx = GAME_WIDTH / 2 + (i === 0 ? -170 : 170);
      const by = GAME_HEIGHT / 2;

      const cardG = this.add.graphics();
      cardG.fillStyle(0x12151a, 1);
      cardG.fillRect(bx - 130, by - 60, 260, 140);
      cardG.lineStyle(2, 0xf2a800, 0.8);
      cardG.strokeRect(bx - 130, by - 60, 260, 140);
      overlay.add(cardG);

      overlay.add(this.add.text(bx, by - 40, perk.icon, { fontFamily: "monospace", fontSize: "28px" }).setOrigin(0.5));
      overlay.add(this.add.text(bx, by - 10, perk.name.toUpperCase(), {
        fontFamily: "monospace", fontSize: "12px", fontStyle: "bold", color: "#f2c14e",
      }).setOrigin(0.5));
      overlay.add(this.add.text(bx, by + 10, perk.description, {
        fontFamily: "monospace", fontSize: "8px", color: "#cccccc", wordWrap: { width: 240 }, align: "center",
      }).setOrigin(0.5, 0));

      const hitArea = this.add.rectangle(bx, by, 260, 140, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hitArea.on("pointerover", () => { cardG.lineStyle(2, 0xffffff, 1); cardG.strokeRect(bx - 130, by - 60, 260, 140); });
      hitArea.on("pointerout",  () => { cardG.lineStyle(2, 0xf2a800, 0.8); cardG.strokeRect(bx - 130, by - 60, 260, 140); });
      hitArea.on("pointerdown", () => {
        applyPerk(perkId, this.player, run);
        this.checkSynergiesAndPopup(run);
        overlay.destroy();
        npcG.destroy();
        npcLabel.destroy();
        this.scene.resume();
        this.hud.setPerks(run.perks ?? []);
        const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60,
          `PERK: ${perk.name}\n${perk.description}`,
          { fontFamily: "monospace", fontSize: "13px", color: "#f2c14e",
            stroke: "#000000", strokeThickness: 2, align: "center" })
          .setOrigin(0.5).setScrollFactor(0).setDepth(999);
        this.tweens.add({ targets: msg, alpha: 0, duration: 800, delay: 2200, onComplete: () => msg.destroy() });
      });
      overlay.add(hitArea);
    });

    // Also handle keyboard selection
    const k1 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    const k2 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    const pickPerk = (idx: number) => {
      if (!overlay.active) return;
      const perkId = options[idx];
      if (!perkId) return;
      const perk = PERKS[perkId];
      applyPerk(perkId, this.player, run);
      this.checkSynergiesAndPopup(run);
      overlay.destroy();
      npcG.destroy();
      npcLabel.destroy();
      k1.destroy();
      k2.destroy();
      this.scene.resume();
      this.hud.setPerks(run.perks ?? []);
      const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60,
        `PERK: ${perk.name}\n${perk.description}`,
        { fontFamily: "monospace", fontSize: "13px", color: "#f2c14e",
          stroke: "#000000", strokeThickness: 2, align: "center" })
        .setOrigin(0.5).setScrollFactor(0).setDepth(999);
      this.tweens.add({ targets: msg, alpha: 0, duration: 800, delay: 2200, onComplete: () => msg.destroy() });
    };
    overlay.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, "[1] Esquerda   [2] Direita", {
      fontFamily: "monospace", fontSize: "10px", color: "#666666",
    }).setOrigin(0.5));
    k1.on("down", () => pickPerk(0));
    k2.on("down", () => pickPerk(1));
  }

  // Coloca um cache de VR em cima da plataforma mais alta do layout — premia
  // quem explora verticalmente. A alcançabilidade é garantida pelo LevelValidator.
  private spawnVerticalReward(): void {
    let bestTop = Infinity;
    let best: Phaser.Physics.Arcade.StaticBody | undefined;
    this.platforms.getChildren().forEach(p => {
      const b = (p as Phaser.GameObjects.GameObject & { body?: Phaser.Physics.Arcade.StaticBody }).body;
      if (!b) return;
      if (b.y < FLOOR_Y - 45 && b.y < bestTop) { bestTop = b.y; best = b; }
    });
    if (!best) return;
    const cx = best.x + best.width / 2;
    for (let i = 0; i < 5; i++) {
      const d = this.drops.create(cx + (i - 2) * 12, best.y - 16, "tex-vr") as Phaser.Physics.Arcade.Sprite;
      d.setDepth(9);
    }
    this.add.text(cx, best.y - 34, "💰", { fontSize: "14px" }).setOrigin(0.5).setDepth(9);
  }

  private spawnCoffeeDrop(x: number, y: number): void {
    // Copo de café real (sprite com tampa + cinta + vapor) em vez do bloco marrom.
    const [tex, frame] = resolveSprite("item-coffee-cup-active0");
    const coffee = this.coffeeDrops.create(x, y - 10, tex, frame) as Phaser.Physics.Arcade.Sprite;
    coffee.setDisplaySize(20, 26).setDepth(9);
    const body = coffee.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Phaser.Math.Between(-80, 80), Phaser.Math.Between(-200, -120));
    body.setBounce(0.3);
    // Anima o vapor ciclando os 3 frames enquanto o copo existe.
    let f = 0;
    const steam = this.time.addEvent({
      delay: 180, loop: true, callback: () => {
        f = (f + 1) % 3;
        const [t2, fr2] = resolveSprite(`item-coffee-cup-active${f}`);
        if (coffee.active) coffee.setTexture(t2, fr2);
      },
    });
    this.time.delayedCall(10000, () => { if (coffee.active) coffee.destroy(); steam.remove(); });
  }

  // Item 1 — registra um kill no medidor de Produtividade e devolve o multiplicador de VR.
  private registerKill(x: number, y: number): number {
    const now = this.time.now;
    if (now - this.prodLastKillAt > OpenSpaceV2Scene.PROD_WINDOW_MS) this.prodStreak = 0;
    this.prodStreak++;
    this.prodLastKillAt = now;
    const mult = 1 + Math.min(this.prodStreak * 0.1, 1.0); // até 2x no streak 10+
    if (this.prodStreak >= 2) {
      const t = this.add.text(x, y - 34, `x${this.prodStreak} PRODUTIVIDADE`, {
        fontFamily: "monospace", fontSize: this.prodStreak >= 5 ? "13px" : "10px",
        color: this.prodStreak >= 5 ? "#ffcc22" : "#aaffaa",
        stroke: "#000000", strokeThickness: 2,
      }).setOrigin(0.5).setDepth(610);
      this.tweens.add({ targets: t, y: t.y - 22, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    }
    return mult;
  }

  private drawProdMeter(time: number): void {
    const active = time - this.prodLastKillAt <= OpenSpaceV2Scene.PROD_WINDOW_MS && this.prodStreak >= 2;
    this.prodMeter.clear();
    if (!active) { this.prodLabel.setText(""); return; }
    const ratio = Math.max(0, 1 - (time - this.prodLastKillAt) / OpenSpaceV2Scene.PROD_WINDOW_MS);
    const w = 120, h = 6, x = GAME_WIDTH / 2 - w / 2, y = 74;
    this.prodMeter.fillStyle(0x000000, 0.5);
    this.prodMeter.fillRect(x - 1, y - 1, w + 2, h + 2);
    const col = this.prodStreak >= 5 ? 0xffcc22 : 0x66dd88;
    this.prodMeter.fillStyle(col, 0.9);
    this.prodMeter.fillRect(x, y, w * ratio, h);
    this.prodLabel.setText(`PRODUTIVIDADE x${this.prodStreak}  (+${Math.round(Math.min(this.prodStreak * 0.1, 1.0) * 100)}% VR)`)
      .setColor(this.prodStreak >= 5 ? "#ffcc22" : "#aaffaa");
  }

  // Item 2 — sorteia um modificador da sala a partir do seed + loop e aplica seus efeitos.
  private rollRoomEvent(run: ReturnType<typeof getRun>): void {
    const EVENTS = [
      { id: "reuniao",   name: "REUNIÃO OBRIGATÓRIA", desc: "Inimigos mais resistentes, mas +50% VR",
        color: "#ff8844", apply: () => { this.eventVrMult = 1.5; this.buffEnemyHp(1.2); } },
      { id: "homeoffice",name: "HOME OFFICE",          desc: "Sua sanidade não cai nesta sala",
        color: "#66ddff", apply: () => { this.eventNoSanityDrain = true; } },
      { id: "sextou",    name: "SEXTOU",               desc: "+25% velocidade e dash mais rápido",
        color: "#ffdd44", apply: () => { this.player.walkSpeed *= 1.25; this.player.dashCooldownBonus += 250; } },
      { id: "deadline",  name: "DEADLINE INADIÁVEL",   desc: "Inimigos mais rápidos, mas +40% VR",
        color: "#ff5566", apply: () => { this.eventVrMult = 1.4; } },
      { id: "normal",    name: "",                     desc: "", color: "#ffffff", apply: () => {} },
    ];
    const seedNum = run.seed ? parseInt(run.seed.replace(/\D/g, "").slice(0, 8) || "0", 10) : 0;
    const idx = (seedNum + run.loopCount) % EVENTS.length;
    const ev = EVENTS[idx];
    if (!ev.name) return; // sala normal, sem banner
    ev.apply();
    // Banner de entrada
    const banner = this.add.text(GAME_WIDTH / 2, 110, ev.name,
      { fontFamily: "monospace", fontSize: "18px", color: ev.color,
        stroke: "#000000", strokeThickness: 4 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(970).setAlpha(0);
    const sub = this.add.text(GAME_WIDTH / 2, 132, ev.desc,
      { fontFamily: "monospace", fontSize: "11px", color: "#dddddd",
        stroke: "#000000", strokeThickness: 3 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(970).setAlpha(0);
    this.tweens.add({ targets: [banner, sub], alpha: 1, duration: 400, hold: 2600, yoyo: true,
      onComplete: () => { banner.destroy(); sub.destroy(); } });
  }

  private buffEnemyHp(mult: number): void {
    [this.estagiarios, this.sobrecarregados, this.analistas, this.onboardings,
     this.facilitadores, this.scrums, this.coordenadores, this.seniors, this.rhs].forEach(g =>
      g.getChildren().forEach(c => {
        const e = c as Phaser.Physics.Arcade.Sprite & { hp?: number };
        if (typeof e.hp === "number") e.hp = Math.round(e.hp * mult);
      }));
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
    if (!this.eventNoSanityDrain) this.player.tickPassive(time);
    this.drawProdMeter(time);
    this.updateHealerMarkers(time);

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

    // Item 3 — Tutorial implícito: show control hints for first 12s on loop 0.
    // Barra horizontal no topo do playfield (abaixo do header da HUD), fora da
    // área do painel inferior — a versão antiga ficava em y>=460, escondida
    // atrás da HUD (depth 1000).
    if (!this.tutorialShown && getRun(this).loopCount === 0 && time - this.startTimeMs < 12000) {
      this.tutorialShown = true;
      const hintBar = "← → mover    Espaço pular    Shift dash    J atacar    K especial    E interagir";
      const y = HUD_TOP_H + 22;
      const t = this.add.text(GAME_WIDTH / 2, y, hintBar,
        { fontFamily: "monospace", fontSize: "11px", color: "#cfd6e0",
          stroke: "#000000", strokeThickness: 3 })
        .setOrigin(0.5).setScrollFactor(0).setDepth(980).setAlpha(0);
      const bg = this.add.rectangle(GAME_WIDTH / 2, y, t.width + 24, 20, 0x0a0d12, 0.72)
        .setScrollFactor(0).setDepth(979).setAlpha(0);
      this.tweens.add({ targets: [t, bg], alpha: 1, duration: 400 });
      this.tweens.add({ targets: [t, bg], alpha: 0, duration: 800, delay: 8000,
        onComplete: () => { t.destroy(); bg.destroy(); } });
    }

    // Item 8 — Boss room dramatic entry: trigger when player crosses x=1580
    if (!this.bossEntryTriggered && !this.bossDefeated && this.player.x > 1580) {
      this.bossEntryTriggered = true;
      Sfx.bossEntry();
      this.cameras.main.shake(400, 0.012);
      this.cameras.main.flash(120, 180, 0, 0, false);
      const titleCard = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60,
        "ZONA DE PERIGO",
        { fontFamily: "monospace", fontSize: "22px", color: "#ff4444",
          stroke: "#000000", strokeThickness: 4 })
        .setOrigin(0.5).setScrollFactor(0).setDepth(995).setAlpha(0);
      const sub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30,
        "O Gerente está perto...",
        { fontFamily: "monospace", fontSize: "13px", color: "#cc3333",
          stroke: "#000000", strokeThickness: 3 })
        .setOrigin(0.5).setScrollFactor(0).setDepth(995).setAlpha(0);
      this.tweens.add({ targets: titleCard, alpha: 1, duration: 300 });
      this.tweens.add({ targets: sub, alpha: 1, duration: 300, delay: 200 });
      this.tweens.add({ targets: [titleCard, sub], alpha: 0, duration: 700, delay: 2200,
        onComplete: () => { titleCard.destroy(); sub.destroy(); } });
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
    });
  }
}
