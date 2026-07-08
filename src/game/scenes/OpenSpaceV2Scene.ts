import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { HUD_BOT_Y, HUD_TOP_H } from "../systems/Hud";
import { addPhaseBackground } from "../systems/Background";
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
  fxGlow,
} from "../entities/Enemies";
import { GerenteMicrogestor, EmailProjectil } from "../entities/Boss";
import { getRun, savePersisted } from "../systems/PlayerState";
import { WEAPONS, WeaponId } from "../systems/WeaponSystem";
import { ParticleFactory } from "../systems/ParticleFactory";
import { SanityFx } from "../systems/SanityFx";
import { CombatFx } from "../systems/CombatFx";
import { Hud } from "../systems/Hud";
import { applyPerk, checkAndApplySynergies, PERKS, SYNERGIES, PerkId } from "../systems/PerkSystem";
import { HEAT_LEVELS } from "./HoraExtraScene";
import { CulturaId, selectableCulturaIds } from "../systems/CulturaSystem";
import { addImage, resolveSprite } from "../systems/SpriteLibrary";
import { Sfx } from "../systems/AudioSystem";
import { Telemetry } from "../systems/Telemetry";
import { Music } from "../systems/MusicSystem";
import { MeleeHost } from "../systems/MeleeCombat";
import { ProductivityMeter } from "../systems/ProductivityMeter";
import { Apagao } from "../systems/Apagao";
import { BasePhaseScene } from "./BasePhaseScene";

const LEVEL_WIDTH = 1920;
const FLOOR_Y = HUD_BOT_Y - 32;

// Teto do empilhamento evento×produtividade no drop de VR (economia de VR).
const VR_COMBO_CAP = 2.5;

// Tipos de inimigo componíveis por seed nas zonas 1-4 (ver spawnEnemyOfType).
type F1EnemyType = "estagiario" | "sobrecarregado" | "junior" | "rh" | "onboarding" | "facilitador";

export class OpenSpaceV2Scene extends BasePhaseScene {
  // Campos herdados de BasePhaseScene (protected): player, platforms,
  // furnitureBodies, inkProjectiles, drops, boss, bossDefeated, startTimeMs,
  // fx, combatFx, hud, doorLabel, interactKey, levelWidth. Aqui só os da Fase 1.
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
  private coffeeDrops!: Phaser.Physics.Arcade.Group;
  // O boss da Fase 1 é sempre um GerenteMicrogestor; a referência tipada evita
  // casts repetidos (this.boss herdado é o supertipo BossEntity).
  private gerente?: GerenteMicrogestor;
  // Evento APAGÃO + segredo do extintor
  private extintorLooted = false;
  private shadowG!: Phaser.GameObjects.Graphics;
  private reuniaoUsed = false;
  private bossEntryTriggered = false;

  // Pulinho ao travar de lado num móvel (chão): usado por inimigos E boss —
  // sem isso o perseguidor encalha atrás da mesa (o boss "sumia" fora da câmera).
  private hopOverFurniture: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (eObj) => {
    const e = eObj as Phaser.Physics.Arcade.Sprite;
    const body = e.body as Phaser.Physics.Arcade.Body;
    if (!body || !body.blocked.down) return;
    if (!(body.blocked.left || body.blocked.right)) return;
    const now = this.time.now;
    if (now < ((e.getData("nextHop") as number) ?? 0)) return;
    body.setVelocityY(-320);
    e.setData("nextHop", now + 500);
  };
  private tutorialShown = false;
  private arenaGate?: Phaser.GameObjects.Rectangle;
  private parryTaught = false;

  // Disparo de post-it compartilhado por Onboarding e Facilitador (ranged).
  private rangedShoot = (fx: number, fy: number, tx: number, ty: number): void => {
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

  // Item 1 — Produtividade (combo de kills) e evento APAGÃO: sistemas dedicados.
  private prod!: ProductivityMeter;
  private apagao!: Apagao;

  // Item 2 — Evento aleatório da sala
  private eventVrMult = 1;
  private eventNoSanityDrain = false;

  // Marcadores de "healer" (ícone + sobre o coordenador) — seguem o inimigo
  private healerMarkers: { e: Phaser.Physics.Arcade.Sprite; m: Phaser.GameObjects.Text }[] = [];

  constructor() {
    super("OpenSpaceV2Scene");
  }

  // --- Métodos abstratos de BasePhaseScene ---
  // A Fase 1 mantém create()/update() próprios (não chama super.create()), então
  // estes servem de fonte única de verdade e habilitam a futura unificação total.
  protected getBgKey(): string {
    return "pxbg-openspace";
  }
  protected getPhaseTitle(): string {
    return "FASE 1 — OPEN SPACE";
  }
  protected getPhaseNumber(): 1 {
    return 1;
  }
  protected getInitialObjective(): string {
    return "Derrote o Gerente e acesse a Copa";
  }
  protected getPlatformLayout(): Array<[number, number, number]> {
    return [
      [200, FLOOR_Y - 30, 5],
      [460, FLOOR_Y - 72, 4],
      [700, FLOOR_Y - 30, 5],
      [1000, FLOOR_Y - 72, 6],
      [1350, FLOOR_Y - 30, 5],
      [1620, FLOOR_Y - 72, 4],
    ];
  }
  protected getDoorConfig() {
    return {
      x: LEVEL_WIDTH - 60,
      tint: 0x555555,
      label: "COPA\n[BLOQUEADO]",
      cameFrom: "openspace",
      destScene: "CopaScene",
      nextScene: "Phase2Scene",
      nearLabel: "Entrar na Copa",
    };
  }
  protected getBossName(): string {
    return "Gerente Microgestor";
  }
  // A Fase 1 monta seus inimigos no próprio create() via spawnEnemies().
  protected setupEnemiesAndGroups(): void {}

  create() {
    const run = getRun(this);
    const seedNum = run.seed ? parseInt(run.seed.replace(/\D/g, "").slice(0, 8) || "0", 10) : 0;
    const seedVariant = seedNum % 4; // 0–3: 4 variantes de layout
    this.startTimeMs = this.time.now;
    this.bossDefeated = false;
    // A Fase 1 tem create() próprio (não chama super.create()) → precisa semear
    // o this.rng ela mesma. Sem isso, rollSanityDrop() (drop de café por kill)
    // quebrava com "this.rng is undefined" a CADA inimigo morto.
    this.rng = new Phaser.Math.RandomDataGenerator([run.seed ?? "CLT", this.scene.key]);
    Music.start("office");

    this.setupWorldAndCamera();

    addPhaseBackground(this, "pxbg-openspace", HUD_TOP_H, FLOOR_Y);
    if (run.cameFrom !== "copa") Telemetry.runStart(run.characterClass, run.culturas);
    Telemetry.phaseEnter(this.scene.key);
    this.spawnDustParticles();
    this.buildClockOverlays();

    // Office bay decoratives — depth 2 (behind furniture surfaces at depth 4-6)
    [80, 340, 600, 860, 1120, 1380, 1640, 1880].forEach((x) => {
      addImage(this, x, FLOOR_Y - 28, "tex-baia").setDepth(2);
    });

    // Item 5 — Mid parallax layer: rows of distant cubicles drifting at 0.5
    // (entre o fundo em 0.2 e o mundo em 1.0 → cria profundidade real de 3 camadas)
    const mid = this.add.graphics().setDepth(1).setScrollFactor(0.5, 0);
    for (let x = 60; x < LEVEL_WIDTH; x += 180) {
      mid.fillStyle(0x161d27, 0.6);
      mid.fillRect(x, FLOOR_Y - 56, 70, 56); // divisória distante
      mid.fillStyle(0x1d2733, 0.6);
      mid.fillRect(x + 6, FLOOR_Y - 50, 58, 6); // topo da divisória
      mid.fillStyle(0x10161e, 0.5);
      mid.fillRect(x + 30, FLOOR_Y - 44, 18, 14); // monitor distante
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
    [100, 500, 900, 1300, 1700].forEach((x) => {
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
      this.buildPlatform(200, FLOOR_Y - 30, 5);
      this.buildPlatform(460, FLOOR_Y - 72, 4);
      this.buildPlatform(700, FLOOR_Y - 30, 5);
      this.buildPlatform(1000, FLOOR_Y - 72, 6);
      this.buildPlatform(1350, FLOOR_Y - 30, 5);
      this.buildPlatform(1620, FLOOR_Y - 72, 4);
    } else if (seedVariant === 1) {
      // Elevated layout — more platforms high up
      this.buildPlatform(180, FLOOR_Y - 72, 4);
      this.buildPlatform(440, FLOOR_Y - 30, 5);
      this.buildPlatform(720, FLOOR_Y - 72, 5);
      this.buildPlatform(1040, FLOOR_Y - 30, 6);
      this.buildPlatform(1380, FLOOR_Y - 72, 5);
      this.buildPlatform(1640, FLOOR_Y - 30, 4);
    } else if (seedVariant === 2) {
      // Dense layout — more platforms, smaller gaps
      this.buildPlatform(150, FLOOR_Y - 30, 4);
      this.buildPlatform(380, FLOOR_Y - 60, 4);
      this.buildPlatform(620, FLOOR_Y - 30, 4);
      this.buildPlatform(860, FLOOR_Y - 60, 5);
      this.buildPlatform(1140, FLOOR_Y - 30, 5);
      this.buildPlatform(1400, FLOOR_Y - 60, 4);
      this.buildPlatform(1660, FLOOR_Y - 30, 3);
    } else {
      // Staircase layout — escadas escalonadas que sobem/descem, exigindo
      // pulos encadeados (mostra a alcançabilidade em cadeia + premia subir).
      this.buildPlatform(240, FLOOR_Y - 32, 4);
      this.buildPlatform(430, FLOOR_Y - 72, 4);
      this.buildPlatform(720, FLOOR_Y - 40, 5);
      this.buildPlatform(980, FLOOR_Y - 72, 4);
      this.buildPlatform(1200, FLOOR_Y - 40, 4);
      this.buildPlatform(1440, FLOOR_Y - 72, 5);
      this.buildPlatform(1660, FLOOR_Y - 36, 4);
    }

    // Floor-level decoratives
    addImage(this, 60, FLOOR_Y - 28, "tex-cafe-machine")
      .setDepth(8)
      .setDisplaySize(40, 56);
    addImage(this, 490, FLOOR_Y - 24, "tex-bebedouro")
      .setDepth(8)
      .setDisplaySize(32, 48);
    addImage(this, 140, FLOOR_Y - 32, "tex-ponto")
      .setDepth(8)
      .setDisplaySize(32, 48);
    // Extintor: drawn procedurally (frame not in atlas)
    const ext = this.add.graphics().setDepth(8);
    ext.fillStyle(0xcc2020, 1);
    ext.fillRect(1793, FLOOR_Y - 44, 14, 30); // body
    ext.fillStyle(0x882020, 1);
    ext.fillRect(1793, FLOOR_Y - 44, 14, 4); // band
    ext.fillStyle(0x555555, 1);
    ext.fillRect(1797, FLOOR_Y - 50, 6, 8); // neck
    ext.fillStyle(0x333333, 1);
    ext.fillRect(1795, FLOOR_Y - 14, 10, 6); // base

    // (computadores agora ficam em cima das mesas — ver buildPlatform)

    // Wall decoratives (parallax, very back)
    [450, 1100, 1650].forEach((x) =>
      addImage(this, x, HUD_TOP_H + 80, "tex-quadro-motivacional")
        .setDepth(2)
        .setDisplaySize(48, 56)
        .setScrollFactor(0.2, 0),
    );

    // Copa door — locked until boss defeated
    this.doorEl = addImage(this, LEVEL_WIDTH - 60, FLOOR_Y - 30, "tex-door");
    this.doorEl.setTint(0x555555);
    this.doorLabel = this.add
      .text(LEVEL_WIDTH - 60, FLOOR_Y - 72, "COPA\n[BLOQUEADO]", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#666666",
        align: "center",
      })
      .setOrigin(0.5);

    // Setup do player compartilhado (stats/arma/upgrades/perks/culturas/onDeath/
    // onAttack/onRangedAttack) via BasePhaseScene. Callbacks abaixo são da Fase 1.
    const spawnX = run.cameFrom === "copa" ? 120 : 80;
    this.buildPlayer(run, spawnX);
    // Específico da Fase 1: sinergias de perks + multiplicador de Heat (Hora Extra)
    checkAndApplySynergies(this.player, run);
    const heatLvl = HEAT_LEVELS[run.heatLevel ?? 0] ?? HEAT_LEVELS[0];
    this.player.vrDropMult *= heatLvl.vrMult;

    this.player.onSpecialAttack = (type, fx, fy, facing) => {
      const def = WEAPONS[this.player.weaponId as WeaponId] ?? WEAPONS.grampeador;
      switch (type) {
        case "burst_ranged":
          for (let i = 0; i < 2; i++)
            this.time.delayedCall(i * 100, () =>
              this.spawnProjectile({
                x: fx + facing * 20,
                y: fy - 5,
                velX: facing * (def.rangedSpeed || 500),
                damage: def.rangedDamage || def.hitDamages[0],
              }),
            );
          break;
        case "wide_sweep":
          this.resolveAttack(
            new Phaser.Geom.Rectangle(facing > 0 ? fx : fx - 100, fy - 24, 100, 48),
            3,
          );
          break;
        case "aerial_spike":
          this.resolveAttack(new Phaser.Geom.Rectangle(fx - 20, fy - 50, 40, 50), 3);
          if (this.player.body) (this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(-300);
          break;
        case "throw_weapon":
          this.spawnProjectile({
            x: fx + facing * 20,
            y: fy - 10,
            velX: facing * 700,
            damage: def.hitDamages[1] * 2,
          });
          break;
        case "emp_pulse":
          [
            this.estagiarios,
            this.sobrecarregados,
            this.analistas,
            this.onboardings,
            this.facilitadores,
            this.scrums,
            this.coordenadores,
            this.seniors,
            this.rhs,
          ].forEach((g) =>
            g
              ?.getChildren()
              .forEach((e) =>
                (
                  e as Phaser.Physics.Arcade.Sprite & { applyFreeze?: (ms: number) => void }
                ).applyFreeze?.(1200),
              ),
          );
          break;
        case "heal_pulse":
          this.player.energy = Math.min(
            this.player.maxEnergy,
            this.player.energy + Math.round(this.player.maxEnergy * 0.2),
          );
          break;
        case "dash_strike":
          this.resolveAttack(new Phaser.Geom.Rectangle(fx + facing * 20 - 20, fy - 20, 80, 40), 3);
          break;
        case "clock_slow":
          [
            this.estagiarios,
            this.sobrecarregados,
            this.analistas,
            this.onboardings,
            this.facilitadores,
            this.scrums,
            this.coordenadores,
            this.seniors,
            this.rhs,
          ].forEach((g) =>
            g
              ?.getChildren()
              .forEach((e) =>
                (
                  e as Phaser.Physics.Arcade.Sprite & { applySlowdown?: (ms: number) => void }
                ).applySlowdown?.(2500),
              ),
          );
          break;
      }
    };

    // Parry "Reclamar" — compartilhado com Base (usa enemyGroups, populado abaixo).
    this.wireParryReclamar();

    // Enemy groups (no classType — entities added manually)
    this.estagiarios = this.physics.add.group({ runChildUpdate: false });
    this.sobrecarregados = this.physics.add.group({ runChildUpdate: false });
    this.analistas = this.physics.add.group({ runChildUpdate: false });
    this.onboardings = this.physics.add.group({ runChildUpdate: false });
    this.facilitadores = this.physics.add.group({ runChildUpdate: false });
    this.scrums = this.physics.add.group({ runChildUpdate: false });
    this.coordenadores = this.physics.add.group({ runChildUpdate: false });
    this.seniors = this.physics.add.group({ runChildUpdate: false });
    this.rhs = this.physics.add.group({ runChildUpdate: false });
    this.postits = this.physics.add.group();
    this.emails = this.physics.add.group();
    this.coffeeDrops = this.physics.add.group();
    this.inkProjectiles = this.physics.add.group();
    this.drops = this.physics.add.group();
    // Contra-jogo do Burnout: a Fase 1 tem create() próprio, então cria o grupo
    // de cafezinhos de Sanidade aqui (a Base cria no seu próprio create()).
    this.sanityDrops = this.physics.add.group();

    // Registro no array herdado enemyGroups: BasePhaseScene.update() usa isso p/
    // o homing do projétil (a Fase 1 mantém seus próprios colliders/overlaps no
    // create, com os hooks de VR — este array é só a lista viva de inimigos).
    this.enemyGroups = [
      { group: this.estagiarios, vrDrop: 1 },
      { group: this.sobrecarregados, vrDrop: 2 },
      { group: this.analistas, vrDrop: 3 },
      { group: this.onboardings, vrDrop: 2 },
      { group: this.facilitadores, vrDrop: 2 },
      { group: this.scrums, vrDrop: 2 },
      { group: this.coordenadores, vrDrop: 4 },
      { group: this.seniors, vrDrop: 6 },
      { group: this.rhs, vrDrop: 3 },
    ];

    // Recompensa de exploração vertical: cache de VR na plataforma mais alta.
    this.spawnZoneTints();
    this.spawnVerticalReward();
    this.spawnMidBreather();

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
      this.doorEl.clearTint();
      this.doorLabel.setText("COPA").setColor("#c9a36a");
    } else {
      this.spawnEnemies();
    }

    // Colliders: enemy groups land on platform surfaces
    [
      this.estagiarios,
      this.sobrecarregados,
      this.analistas,
      this.onboardings,
      this.facilitadores,
      this.scrums,
      this.coordenadores,
      this.seniors,
      this.rhs,
      this.drops,
    ].forEach((g) => this.physics.add.collider(g, this.platforms));
    // Enemies collide with world bounds so they turn at level edges
    [
      this.estagiarios,
      this.sobrecarregados,
      this.analistas,
      this.onboardings,
      this.facilitadores,
      this.scrums,
      this.coordenadores,
      this.seniors,
      this.rhs,
    ].forEach((g) => {
      g.getChildren().forEach((c) => {
        const body = (c as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
        body.setCollideWorldBounds(true);
      });
    });

    // Separação entre inimigos de chão: evita que se empilhem no mesmo ponto.
    // A colisão só resolve a sobreposição (empurra de leve para o lado); a IA
    // re-aplica a velocidade no frame seguinte, então continuam perseguindo.
    const groundGroups = [
      this.estagiarios,
      this.sobrecarregados,
      this.analistas,
      this.facilitadores,
      this.scrums,
      this.coordenadores,
      this.seniors,
      this.rhs,
    ];
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
    // (callback em hopOverFurniture — o boss também usa)
    [...groundGroups, this.onboardings].forEach((g) =>
      this.physics.add.collider(g, this.furnitureBodies, this.hopOverFurniture),
    );

    // Contact damage
    const contactDamage = (
      group: Phaser.Physics.Arcade.Group,
      dmg: (e: Phaser.Physics.Arcade.Sprite) => number,
    ) => {
      this.physics.add.overlap(this.player, group, (_p, eObj) => {
        if (this.player.isInvulnerable(this.time.now)) return;
        const e = eObj as Phaser.Physics.Arcade.Sprite;
        this.player.takeDamage(dmg(e), 4, e.x);
      });
    };
    contactDamage(this.estagiarios, (e) => (e as EstagiarioDesesperado).contactDamage);
    contactDamage(this.sobrecarregados, (e) => (e as EstagiarioSobrecarregado).contactDamage);
    contactDamage(this.scrums, (e) => (e as ScrumMasterCaotico).contactDamage);
    contactDamage(this.coordenadores, (e) => (e as CoordenadorDeSinergia).contactDamage);
    contactDamage(this.seniors, (e) => (e as AnalistaSeniorExausto).contactDamage);
    contactDamage(this.rhs, (e) => (e as EnemyRH).contactDamage);

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
      [this.estagiarios, 1],
      [this.sobrecarregados, 2],
      [this.analistas, 3],
      [this.onboardings, 2],
      [this.facilitadores, 2],
      [this.scrums, 2],
      [this.coordenadores, 4],
      [this.seniors, 6],
      [this.rhs, 3],
    ];
    inkDmgGroups.forEach(([group, vrDrop]) => {
      this.physics.add.overlap(this.inkProjectiles, group, (inkObj, enemyObj) => {
        const ink = inkObj as Phaser.Physics.Arcade.Sprite;
        if (!ink.active) return;
        const enemy = enemyObj as Phaser.Physics.Arcade.Sprite & {
          hit?: (d: number, k: number) => boolean;
        };
        if (!enemy.active || !enemy.hit) return;
        const dmg = (ink.getData("damage") as number) ?? 10;
        const piercing = (ink.getData("piercing") as boolean) ?? false;
        if (enemy.hit(Math.round(dmg * this.player.damageMult), 0)) {
          const prodMult = this.prod.registerKill(enemy.x, enemy.y);
          // Cap do empilhamento evento×produtividade (economia de VR): evita
          // combos de ~5x que zeravam a tensão de escolha na 1ª Copa.
          const combo = Math.min(this.eventVrMult * prodMult, VR_COMBO_CAP);
          this.dropVR(
            enemy.x,
            enemy.y,
            Math.max(1, Math.round(vrDrop * this.player.vrDropMult * combo)),
          );
          if (this.player.healOnKill > 0)
            this.player.energy = Math.min(
              this.player.maxEnergy,
              this.player.energy + this.player.healOnKill,
            );
          this.player.onKill?.();
          this.rollSanityDrop(enemy.x, enemy.y);
          enemy.destroy();
        }
        if (!piercing) ink.destroy();
      });
    });

    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      const spr = dObj as Phaser.Physics.Arcade.Sprite;
      if (!spr.active) return;
      this.player.addVR(1);
      Sfx.vrPickup();
      spr.destroy();
    });

    // Cafezinhos de Sanidade (contra-jogo do Burnout) — mesmo comportamento da Base.
    this.physics.add.collider(this.sanityDrops, this.platforms);
    this.wireSanityDropPickup();

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
      const msg = this.add
        .text(this.player.x, this.player.y - 40, "☕ CAFÉ +2", {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#ffcc44",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(200);
      this.tweens.add({
        targets: msg,
        y: msg.y - 28,
        alpha: 0,
        duration: 700,
        onComplete: () => msg.destroy(),
      });
    });

    // Pause on ESC
    this.setupPauseKey();

    // Copa door interaction zone
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

    this.fx = new SanityFx(this);
    this.combatFx = new CombatFx(this);
    this.hud = new Hud(this, LEVEL_WIDTH);
    this.shadowG = this.add.graphics().setDepth(5);

    // #5 Camera flash + #6 Chromatic aberration on player hit
    this.player.onHit = () => {
      this.cameras.main.flash(60, 255, 20, 20, false);
      this.fx.triggerChromaticHit();
    };
    this.hud.setPhaseTitle("FASE 1 — OPEN SPACE");
    this.hud.setObjective("Derrote o Gerente e acesse a Copa");

    // Item 1 — medidor de Produtividade + Item 2 — evento APAGÃO (sistemas)
    this.prod = new ProductivityMeter(this);
    this.apagao = new Apagao(this);

    // Item 2 — modificador da sala (depende do seed + loop)
    this.rollRoomEvent(run);

    // Validação de fase (só DEV) + overlay na tecla V — helper compartilhado.
    this.installLevelDebug(
      {
        label: "OpenSpaceV2",
        seedVariant,
        floorY: FLOOR_Y,
        ceilingY: HUD_TOP_H,
        levelWidth: LEVEL_WIDTH,
        playerSpawn: { x: spawnX, y: FLOOR_Y - 60 },
        jumpVel: -520,
        gravity: 1200, // JUMP_VEL / GRAVITY (Player.ts / config.ts)
        platforms: this.platforms,
        furniture: this.furnitureBodies,
        enemies: [
          this.estagiarios,
          this.sobrecarregados,
          this.analistas,
          this.onboardings,
          this.facilitadores,
          this.scrums,
          this.coordenadores,
          this.seniors,
          this.rhs,
        ],
        boss: this.boss,
        exit: { x: this.doorEl.x, y: this.doorEl.y },
      },
      `OpenSpaceV2 (seed variant ${seedVariant})`,
    );
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
      const hours = (now.getHours() % 12) + minutes / 60;
      const minAngle = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
      const hrAngle = (hours / 12) * Math.PI * 2 - Math.PI / 2;
      CLOCK_POSITIONS.forEach((cx) => {
        const cy = CLOCK_Y;
        clockG.fillStyle(0x14100a, 1);
        // Minute hand (long)
        clockG.fillRect(
          cx + Math.round(Math.cos(minAngle) * 10) - 1,
          cy + Math.round(Math.sin(minAngle) * 10) - 1,
          2,
          2,
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
    const zoneTop = HUD_TOP_H + 20;
    const zoneBot = FLOOR_Y - 20;
    const zoneH = zoneBot - zoneTop;

    // Layer 1 — fine dust: many tiny specks drifting upward very slowly
    this.add
      .particles(0, zoneTop, "__WHITE", {
        x: { min: 0, max: LEVEL_WIDTH },
        y: { min: 0, max: zoneH },
        speedX: { min: -10, max: 10 },
        speedY: { min: -14, max: -3 },
        lifespan: { min: 7000, max: 13000 },
        alpha: { start: 0.06, end: 0 },
        scale: { min: 0.5, max: 1.2 },
        tint: [0xd4c8a0, 0xe8d8b0, 0xfff4d0],
        frequency: 160,
        maxAliveParticles: 90,
        gravityY: 6, // gentle resistance — float, then drift back
      })
      .setDepth(2);

    // Layer 2 — lazy motes: fewer, larger, longer-lived
    this.add
      .particles(0, zoneTop + 40, "__WHITE", {
        x: { min: 0, max: LEVEL_WIDTH },
        y: { min: 0, max: zoneH - 80 },
        speedX: { min: -5, max: 5 },
        speedY: { min: -7, max: -1 },
        lifespan: { min: 12000, max: 22000 },
        alpha: { start: 0.09, end: 0 },
        scale: { min: 1.5, max: 3.0 },
        tint: [0xf0e8c8, 0xffe8c0],
        frequency: 500,
        maxAliveParticles: 28,
        gravityY: 2,
      })
      .setDepth(2);
  }

  protected buildFloor(): void {
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
  protected buildPlatform(x: number, surfY: number, tiles: number): void {
    const w = tiles * 32;
    const cx = x + w / 2;
    const bodyTop = surfY + 7;
    const bodyH = FLOOR_Y - bodyTop;
    const bodyMidY = bodyTop + bodyH / 2;

    const WOOD_TOP = 0x7a4a22; // tampo claro
    const WOOD_EDGE = 0x5c3318; // borda frontal
    const WOOD_DARK = 0x3a2412; // pernas
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
    addImage(this, cx, surfY - 16, "tex-monitor")
      .setDepth(9)
      .setDisplaySize(34, 26);
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
    const m = this.add
      .text(e.x, e.y - e.displayHeight - 4, "✚", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#55ff99",
        stroke: "#06301c",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(560);
    this.healerMarkers.push({ e, m });
  }

  private updateHealerMarkers(time: number): void {
    const bob = Math.sin(time / 250) * 2;
    for (let i = this.healerMarkers.length - 1; i >= 0; i--) {
      const { e, m } = this.healerMarkers[i];
      if (!e.active) {
        m.destroy();
        this.healerMarkers.splice(i, 1);
        continue;
      }
      m.setPosition(e.x, e.y - e.displayHeight - 4 + bob);
    }
  }

  // Cria e liga um inimigo do tipo pedido na posição x (dir aleatória pela rng).
  private spawnEnemyOfType(
    type: F1EnemyType,
    x: number,
    rng: Phaser.Math.RandomDataGenerator,
  ): void {
    const dir: 1 | -1 = rng.frac() > 0.5 ? 1 : -1;
    switch (type) {
      case "estagiario": {
        const e = new EstagiarioDesesperado(this, x, FLOOR_Y - 40, dir);
        e.target = this.player;
        this.estagiarios.add(e);
        break;
      }
      case "sobrecarregado": {
        const e = new EstagiarioSobrecarregado(this, x, FLOOR_Y - 40, dir);
        e.target = this.player;
        this.sobrecarregados.add(e);
        break;
      }
      case "junior": {
        const a = new AnalistaJunior(this, x, FLOOR_Y - 60);
        a.target = this.player;
        this.analistas.add(a);
        break;
      }
      case "rh": {
        const rh = new EnemyRH(this, x, FLOOR_Y - 60);
        rh.target = this.player;
        this.rhs.add(rh);
        break;
      }
      case "onboarding": {
        const a = new AnalistaOnboarding(this, x, FLOOR_Y - 60);
        a.target = this.player;
        a.onShoot = this.rangedShoot;
        this.onboardings.add(a);
        break;
      }
      case "facilitador": {
        const f = new FacilitadorDeWorkshop(this, x, FLOOR_Y - 60);
        f.target = this.player;
        f.onShoot = this.rangedShoot;
        this.facilitadores.add(f);
        break;
      }
    }
  }

  private spawnEnemies(): void {
    // ── Dificuldade escalonada: fácil (esquerda) → difícil (direita) ──────────
    // O jogador entra em x≈80 e avança para a direita rumo ao boss (x≈1820).
    // Zona 1 (300-560): só estagiários (melee básico) para ensinar o combate.
    // Zona 2 (660-990): sobrecarregados + analistas junior.
    // Zona 3 (1100-1210): RH (perseguidores).
    // Zona 4 (1230-1520): inimigos à distância (onboarding + facilitador).
    // Zona 5 (1620-1760): elite — scrum, coordenador (healer) e sênior (tanky).
    // Zonas 4 e 5 SEPARADAS (antes 4=1320-1620 e 5=1480-1740 se sobrepunham,
    // formando um muro injusto de ranged+healer+tank grudado no boss).

    // ── Composição por seed: as zonas 1-4 variam o TIPO de inimigo por run,
    // com CONTAGEM fixa por zona (3/4/2/4) → orçamento de ameaça e distribuição
    // do LevelValidator estáveis. Presets do mesmo tier evitam desbalanceamento.
    // A zona 5 (elite/healer) é âncora fixa. Determinístico pela seed da run.
    const rng = new Phaser.Math.RandomDataGenerator([getRun(this).seed ?? "CLT"]);

    // Zona 1 (fodder, ensina melee) — 3 slots, quase sempre estagiários
    const z1 = rng.pick([
      ["estagiario", "estagiario", "estagiario"],
      ["estagiario", "estagiario", "sobrecarregado"],
    ]) as F1EnemyType[];
    [320, 440, 560].forEach((x, i) => this.spawnEnemyOfType(z1[i], x, rng));

    // Zona 2 (melee leve) — 4 slots: sobrecarregados + juniores
    const z2 = rng.shuffle(
      rng.pick([
        ["sobrecarregado", "sobrecarregado", "junior", "junior"],
        ["sobrecarregado", "junior", "junior", "junior"],
        ["sobrecarregado", "sobrecarregado", "sobrecarregado", "junior"],
      ]),
    ) as F1EnemyType[];
    [660, 770, 880, 990].forEach((x, i) => this.spawnEnemyOfType(z2[i], x, rng));

    // Zona 3 (perseguidor) — 2 slots
    const z3 = rng.pick([
      ["rh", "rh"],
      ["rh", "sobrecarregado"],
    ]) as F1EnemyType[];
    [1100, 1210].forEach((x, i) => this.spawnEnemyOfType(z3[i], x, rng));

    // Zona 4 (ranged) — 4 slots: onboarding + facilitador
    const z4 = rng.shuffle(
      rng.pick([
        ["onboarding", "onboarding", "facilitador", "facilitador"],
        ["onboarding", "onboarding", "onboarding", "facilitador"],
        ["onboarding", "facilitador", "facilitador", "facilitador"],
      ]),
    ) as F1EnemyType[];
    [1230, 1340, 1420, 1520].forEach((x, i) => this.spawnEnemyOfType(z4[i], x, rng));

    // Zona 5 — Scrum Master Caótico (elite, perto do boss) — âncora fixa
    const scrum = new ScrumMasterCaotico(this, 1590, FLOOR_Y - 60);
    scrum.target = this.player;
    scrum.onShout = (fromX) => {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, fromX, this.player.y) < 260) {
        const dir = fromX < this.player.x ? -1 : 1;
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(dir * -220);
      }
    };
    this.scrums.add(scrum);

    // Zona 5 — Coordenador de Sinergia (HEALER, prioridade) guardando o boss
    const coord = new CoordenadorDeSinergia(this, 1700, FLOOR_Y - 60);
    coord.target = this.player;
    coord.onCoffeeDrop = (cx, cy) => this.spawnCoffeeDrop(cx, cy);
    this.coordenadores.add(coord);
    this.tagHealer(coord);

    // Zona 5 — Analista Sênior Exausto (tanky)
    const sr = new AnalistaSeniorExausto(this, 1780, FLOOR_Y - 60);
    sr.target = this.player;
    this.seniors.add(sr);

    // GD C — atirador na plataforma alta: dá MOTIVO DE COMBATE pra subir (além
    // do loot). Fustiga do alto; o jeito limpo de calá-lo é ir até ele pelo pulo
    // encadeado. Determinístico (mesma plataforma-topo do cache vertical).
    this.spawnHighHarasser();

    // GD B — porta da arena: parede INVISÍVEL só-para-inimigos em x≈1580, ligada
    // quando o boss ativa. Impede que o trash das zonas 1-4 forme uma "conga
    // line" atrás do jogador e polua o clímax. O player atravessa livremente
    // (sem collider com ele); só os grupos de trash colidem. Elites (zona 5) já
    // estão na arena e não são travados.
    const gate = this.add.rectangle(1580, GAME_HEIGHT / 2, 12, GAME_HEIGHT, 0x000000, 0);
    this.physics.add.existing(gate, true);
    (gate.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.arenaGate = gate;

    // ── Sem boss na Fase 1 (decisão de design) ────────────────────────────
    // A Fase 1 é onboarding: ensina o loop (andar/atacar/energia/sanidade/VR) e
    // a Copa, SEM o muro de um chefe. O 1º boss de verdade é o Coordenador na
    // Fase 2. O trio da zona 5 (Scrum/Coordenador/Sênior) acima é a "onda final"
    // leve; a Copa destrava ao CHEGAR NA SAÍDA (ver handlePhase1Complete). O
    // GerenteMicrogestor fica guardado p/ reaproveitar como boss/elite futuro.

    // Feature 3 + 7: Loop difficulty + Heat scaling
    const runNow = getRun(this);
    const loop = runNow.loopCount ?? 0;
    const heatDef = HEAT_LEVELS[runNow.heatLevel ?? 0] ?? HEAT_LEVELS[0];
    const ngMult = runNow.ngPlus ? 1.4 : 1; // New Game+ "Quinta-feira"
    if (loop > 0 || heatDef.hpMult > 1 || runNow.ngPlus) {
      const hpMult = (1 + loop * 0.2) * heatDef.hpMult * ngMult; // +20%/loop + heat + NG+
      const allEnemyGroups = [
        this.estagiarios,
        this.sobrecarregados,
        this.analistas,
        this.onboardings,
        this.facilitadores,
        this.scrums,
        this.coordenadores,
        this.seniors,
        this.rhs,
      ];
      allEnemyGroups.forEach((g) =>
        g.getChildren().forEach((c) => {
          const e = c as Phaser.Physics.Arcade.Sprite & { hp: number };
          if (e.hp !== undefined) e.hp = Math.round(e.hp * hpMult);
        }),
      );
      // At loop >= 3, make 1 enemy per group "jammed" (golden tint, +50% HP)
      if (loop >= 3) {
        allEnemyGroups.forEach((g) => {
          const children = g.getChildren();
          if (children.length === 0) return;
          const jammed = children[0] as Phaser.Physics.Arcade.Sprite & { hp: number };
          jammed.setTint(0xffaa00);
          if (jammed.hp !== undefined) jammed.hp = Math.round(jammed.hp * 1.5);
          // Label it
          const jamLabel = this.add
            .text(jammed.x, jammed.y - 30, "TRAVADO", {
              fontFamily: "monospace",
              fontSize: "7px",
              color: "#ffaa00",
            })
            .setOrigin(0.5)
            .setDepth(500);
          this.time.delayedCall(2000, () => {
            if (jamLabel.scene) jamLabel.destroy();
          });
        });
      }
    }

    // (sem boss na Fase 1 → sem overlap ink×boss)
  }

  // Fase 1 sem boss: "concluída" ao CHEGAR NA SAÍDA (chamado no onPhaseUpdate).
  // Libera a Copa e dá o mesmo bônus "Expediente Cumprido" se a sala foi limpa.
  private handlePhase1Complete(): void {
    if (this.bossDefeated) return;
    this.bossDefeated = true; // reusa o flag herdado como "fase liberada"
    Telemetry.bossDefeat(this.scene.key);
    getRun(this).openSpaceCleared = true;
    this.hud.hideBoss();
    this.hud.setObjective("Expediente encerrado! Copa liberada — [ E ] na porta.");
    this.cameras.main.flash(200, 255, 200, 50, false);

    // Incentivo de combate (carrot): "EXPEDIENTE CUMPRIDO" — se o jogador chegou
    // à saída com a sala praticamente limpa (não fez rush), ganha bônus de VR +
    // Sanidade. Não pune quem corre (rush segue válido); só premia quem enfrenta.
    const trashLeft = [
      this.estagiarios,
      this.sobrecarregados,
      this.analistas,
      this.onboardings,
      this.facilitadores,
      this.scrums,
      this.coordenadores,
      this.seniors,
      this.rhs,
    ].reduce((n, g) => n + (g?.countActive?.() ?? 0), 0);
    if (trashLeft <= 2) {
      this.player.addVR(30);
      this.player.sanity = Math.min(this.player.maxSanity, this.player.sanity + 25);
      const bonus = this.add
        .text(
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2 - 140,
          "EXPEDIENTE CUMPRIDO!  +30 VR  •  +25 Sanidade",
          {
            fontFamily: "monospace",
            fontSize: "16px",
            fontStyle: "bold",
            color: "#66ff99",
            align: "center",
            stroke: "#000000",
            strokeThickness: 4,
          },
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(999);
      this.tweens.add({
        targets: bonus,
        y: bonus.y - 24,
        alpha: 0,
        duration: 2200,
        delay: 800,
        onComplete: () => bonus.destroy(),
      });
    }

    const run = getRun(this);
    run.autonomia = true;
    this.player.autonomia = true;
    savePersisted(run.reconhecimento, run.fgts, run.loopCount);

    this.doorEl.clearTint();
    this.doorLabel.setText("COPA").setColor("#c9a36a");

    // #9 Hover: door label bobs to signal the way out
    this.tweens.add({
      targets: this.doorLabel,
      y: this.doorLabel.y - 5,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const msg = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 30,
        "GERENTE DERROTADO!\n\nPerk: AUTONOMIA ativado\n\nPorta da Copa desbloqueada ->",
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
      delay: 4500,
      onComplete: () => msg.destroy(),
    });

    this.time.delayedCall(1000, () => {
      const options = (Phaser.Utils.Array.Shuffle(selectableCulturaIds()) as CulturaId[]).slice(
        0,
        3,
      );
      this.scene.pause();
      this.scene.launch("CulturaSelectScene", { caller: "OpenSpaceV2Scene", options });
    });
  }

  private checkSynergiesAndPopup(run: import("../systems/PlayerState").RunState): void {
    const prevSynergies = run.activeSynergies ?? [];
    const newSynergies = checkAndApplySynergies(this.player, run);
    const gained = newSynergies.filter((id) => !prevSynergies.includes(id));
    if (gained.length === 0) return;
    const syn = SYNERGIES[gained[0]];
    if (!syn) return;
    const popup = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 90,
        `${syn.icon} SINERGIA ATIVADA!\n${syn.name}\n${syn.desc}`,
        {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#ffdd44",
          stroke: "#000000",
          strokeThickness: 3,
          align: "center",
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1100);
    this.tweens.add({
      targets: popup,
      alpha: 0,
      duration: 800,
      delay: 2500,
      onComplete: () => popup.destroy(),
    });
  }

  // Combate canônico (systems/MeleeCombat) com os hooks da Fase 1:
  // produtividade × evento no VR, segredo do extintor no 1º frame, e boss
  // tratado pelo onDied do próprio GerenteMicrogestor (não pelo host).
  // Sobrescreve BasePhaseScene.getMeleeHost() e reusa o cache herdado _meleeHost.
  protected getMeleeHost(): MeleeHost {
    if (!this._meleeHost) {
      this._meleeHost = {
        scene: this,
        player: this.player,
        combatFx: this.combatFx,
        getGroups: () => [
          { group: this.estagiarios, vrDrop: 1 },
          { group: this.sobrecarregados, vrDrop: 2 },
          { group: this.analistas, vrDrop: 3 },
          { group: this.onboardings, vrDrop: 2 },
          { group: this.facilitadores, vrDrop: 2 },
          { group: this.scrums, vrDrop: 2 },
          { group: this.coordenadores, vrDrop: 4 },
          { group: this.seniors, vrDrop: 6 },
          { group: this.rhs, vrDrop: 3 },
        ],
        getBoss: () => this.boss as ReturnType<MeleeHost["getBoss"]>,
        dropVR: (x, y, n) => this.dropVR(x, y, n),
        // O GerenteMicrogestor dispara handleBossDefeat via onDied próprio.
        onBossDied: () => {},
        killVrMult: (x, y) =>
          Math.min(this.prod.registerKill(x, y) * this.eventVrMult, VR_COMBO_CAP),
        onSwingStart: (hb) => this.checkExtintorSecret(hb),
        onEnemyKilled: (e) => this.rollSanityDrop(e.x, e.y),
      };
    }
    this._meleeHost.player = this.player;
    this._meleeHost.combatFx = this.combatFx;
    return this._meleeHost;
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
    for (let li = 0; li < 4; li++)
      memoG.lineBetween(mx - 7, my - 10 + li * 5, mx + 7, my - 10 + li * 5);

    const memoLabel = this.add
      .text(mx, my - 22, "MEMO", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#f2a800",
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.tweens.add({
      targets: [memoG, memoLabel],
      y: "-=5",
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    let memoTaken = false;
    const memoZone = this.add.zone(mx, my, 40, 40);
    this.physics.add.existing(memoZone, true);
    this.physics.add.overlap(this.player, memoZone, () => {
      if (memoTaken) return;
      if (
        Phaser.Input.Keyboard.JustDown(this.interactKey) ||
        this.player.gamepadInteractJustPressed
      ) {
        memoTaken = true;
        memoG.destroy();
        memoLabel.destroy();
        // Apply a random perk the player doesn't have yet
        const allPerkIds = Object.keys(PERKS) as PerkId[];
        const available = allPerkIds.filter((id) => !(run.perks ?? []).includes(id));
        if (available.length > 0) {
          const chosen = Phaser.Utils.Array.GetRandom(available) as PerkId;
          applyPerk(chosen, this.player, run);
          this.checkSynergiesAndPopup(run);
          this.hud.setPerks(run.perks ?? []);
          const perk = PERKS[chosen];
          const msg = this.add
            .text(this.player.x, this.player.y - 50, `MEMO!\nPerk: ${perk.name}`, {
              fontFamily: "monospace",
              fontSize: "13px",
              color: "#ffffff",
              stroke: "#000000",
              strokeThickness: 2,
              align: "center",
            })
            .setOrigin(0.5)
            .setDepth(999);
          this.tweens.add({
            targets: msg,
            alpha: 0,
            duration: 800,
            delay: 2200,
            onComplete: () => msg.destroy(),
          });
        }
      }
    });
  }

  private spawnReuniao(nx: number, run: import("../systems/PlayerState").RunState): void {
    // "?" NPC que oferece 2 perks grátis. Era desenhado como PLACEHOLDER (um
    // retângulo dourado + cabeça oval) e parecia "inimigo sem sprite / bloco
    // amarelo". Agora usa um sprite de personagem corporativo (tintado dourado
    // p/ sinalizar NPC especial).
    const npcSpr = addImage(this, nx, FLOOR_Y - 30, "tex-rh-idle0")
      .setDepth(9)
      .setDisplaySize(48, 60)
      .setTint(0xffdd88);
    const npcLabel = this.add
      .text(nx, FLOOR_Y - 72, "?", {
        fontFamily: "monospace",
        fontSize: "22px",
        fontStyle: "bold",
        color: "#ffdd00",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(10);
    // bob animation
    this.tweens.add({
      targets: npcLabel,
      y: npcLabel.y - 6,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const npcZone = this.add.zone(nx, FLOOR_Y - 30, 60, 60);
    this.physics.add.existing(npcZone, true);
    this.physics.add.overlap(this.player, npcZone, () => {
      if (this.reuniaoUsed) return;
      if (
        Phaser.Input.Keyboard.JustDown(this.interactKey) ||
        this.player.gamepadInteractJustPressed
      ) {
        this.reuniaoUsed = true;
        this.showPerkChoice(run, npcSpr, npcLabel);
      }
    });
  }

  private showPerkChoice(
    run: import("../systems/PlayerState").RunState,
    npcG: Phaser.GameObjects.Image,
    npcLabel: Phaser.GameObjects.Text,
  ): void {
    const allPerkIds = Object.keys(PERKS) as PerkId[];
    const available = allPerkIds.filter((id) => !(run.perks ?? []).includes(id));
    if (available.length === 0) return;
    const options = Phaser.Utils.Array.Shuffle([...available]).slice(0, 2) as PerkId[];

    // Congela a FÍSICA (não a cena) durante a escolha: scene.pause() também
    // desliga o input → nem teclado nem clique funcionavam (deadlock: os
    // handlers que dariam resume nunca disparavam). physics.pause() para o
    // mundo mas mantém update/input vivos.
    this.physics.world.pause();

    const overlay = this.add.container(0, 0).setDepth(2000).setScrollFactor(0);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.add(bg);

    overlay.add(
      this.add
        .text(GAME_WIDTH / 2, 120, "REUNIAO RELAMPAGO", {
          fontFamily: "monospace",
          fontSize: "20px",
          fontStyle: "bold",
          color: "#f2a800",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(GAME_WIDTH / 2, 148, "Escolha um perk gratuito:", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#aaaaaa",
        })
        .setOrigin(0.5),
    );

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

      overlay.add(
        this.add
          .text(bx, by - 40, perk.icon, { fontFamily: "monospace", fontSize: "28px" })
          .setOrigin(0.5),
      );
      overlay.add(
        this.add
          .text(bx, by - 10, perk.name.toUpperCase(), {
            fontFamily: "monospace",
            fontSize: "12px",
            fontStyle: "bold",
            color: "#f2c14e",
          })
          .setOrigin(0.5),
      );
      overlay.add(
        this.add
          .text(bx, by + 10, perk.description, {
            fontFamily: "monospace",
            fontSize: "8px",
            color: "#cccccc",
            wordWrap: { width: 240 },
            align: "center",
          })
          .setOrigin(0.5, 0),
      );

      const hitArea = this.add
        .rectangle(bx, by, 260, 140, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hitArea.on("pointerover", () => {
        cardG.lineStyle(2, 0xffffff, 1);
        cardG.strokeRect(bx - 130, by - 60, 260, 140);
      });
      hitArea.on("pointerout", () => {
        cardG.lineStyle(2, 0xf2a800, 0.8);
        cardG.strokeRect(bx - 130, by - 60, 260, 140);
      });
      hitArea.on("pointerdown", () => {
        applyPerk(perkId, this.player, run);
        this.checkSynergiesAndPopup(run);
        overlay.destroy();
        npcG.destroy();
        npcLabel.destroy();
        this.physics.world.resume();
        this.hud.setPerks(run.perks ?? []);
        const msg = this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, `PERK: ${perk.name}\n${perk.description}`, {
            fontFamily: "monospace",
            fontSize: "13px",
            color: "#f2c14e",
            stroke: "#000000",
            strokeThickness: 2,
            align: "center",
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(999);
        this.tweens.add({
          targets: msg,
          alpha: 0,
          duration: 800,
          delay: 2200,
          onComplete: () => msg.destroy(),
        });
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
      this.physics.world.resume();
      this.hud.setPerks(run.perks ?? []);
      const msg = this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, `PERK: ${perk.name}\n${perk.description}`, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#f2c14e",
          stroke: "#000000",
          strokeThickness: 2,
          align: "center",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(999);
      this.tweens.add({
        targets: msg,
        alpha: 0,
        duration: 800,
        delay: 2200,
        onComplete: () => msg.destroy(),
      });
    };
    overlay.add(
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, "[1] Esquerda   [2] Direita", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#666666",
        })
        .setOrigin(0.5),
    );
    k1.on("down", () => pickPerk(0));
    k2.on("down", () => pickPerk(1));
  }

  // Coloca um cache de VR em cima da plataforma mais alta do layout — premia
  // quem explora verticalmente. A alcançabilidade é garantida pelo LevelValidator.
  private spawnVerticalReward(): void {
    let bestTop = Infinity;
    let best: Phaser.Physics.Arcade.StaticBody | undefined;
    this.platforms.getChildren().forEach((p) => {
      const b = (p as Phaser.GameObjects.GameObject & { body?: Phaser.Physics.Arcade.StaticBody })
        .body;
      if (!b) return;
      if (b.y < FLOOR_Y - 45 && b.y < bestTop) {
        bestTop = b.y;
        best = b;
      }
    });
    if (!best) return;
    const cx = best.x + best.width / 2;
    // Recompensa vertical com PROPÓSITO (GD P3): cache maior (7 VR) + um café,
    // e um facho pulsante que seduz o olhar pra cima desde o chão.
    for (let i = 0; i < 7; i++) {
      const d = this.drops.create(
        cx + (i - 3) * 12,
        best.y - 12,
        "tex-vr",
      ) as Phaser.Physics.Arcade.Sprite;
      d.setDepth(9);
      // Sem gravidade: as moedas FLUTUAM na borda da plataforma em vez de cair
      // (e às vezes pousar em cima de um móvel inalcançável). Assim o jogador as
      // coleta ao passar/pular por elas — o overlap pega no toque.
      const body = d.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      body.setVelocity(0, 0);
    }
    this.spawnCoffeeDrop(cx, best.y - 20);
    this.add
      .text(cx, best.y - 34, "💰", { fontSize: "16px" })
      .setOrigin(0.5)
      .setDepth(9);
    // Facho vertical: coluna luminosa do cache até o chão, pulsando — sinaliza
    // "vale subir aqui" sem texto. setScrollFactor(1) para acompanhar o mundo.
    const beam = this.add
      .rectangle(cx, (best.y + FLOOR_Y) / 2, 10, FLOOR_Y - best.y, 0xffdd66, 0.12)
      .setDepth(2);
    this.tweens.add({
      targets: beam,
      alpha: 0.28,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  // GD P1 — batida de respiro: no vão entre as zonas de melee (1-2) e as de
  // ranged/elite (4-5), um bebedouro largado como cafezinho de Sanidade + uma
  // placa de lore. Cria o ritmo tensão→alívio→pico sem alterar contagem de
  // inimigos (o validador continua estável).
  // GD D — tint por zona: bandas de luz coloridas dão "sense of place" a cada
  // trecho do corredor (mesmo cenário) — frio na zona de perseguição, âmbar na
  // de ranged, avermelhado rumo ao boss. Sutil (alpha baixo), blend aditivo.
  private spawnZoneTints(): void {
    const top = HUD_TOP_H;
    const h = FLOOR_Y - top + 32;
    const bands: Array<[number, number, number]> = [
      // [xStart, xEnd, cor]
      [1000, 1220, 0x225577], // zona 3 — perseguição (frio)
      [1220, 1560, 0x7a5a1a], // zona 4 — ranged (âmbar)
      [1560, 1920, 0x772222], // zona 5 + boss (perigo/vermelho)
    ];
    bands.forEach(([x0, x1, color]) => {
      this.add
        .rectangle(x0, top, x1 - x0, h, color, 0.08)
        .setOrigin(0, 0)
        .setDepth(1)
        .setBlendMode(Phaser.BlendModes.ADD);
    });
  }

  // GD C — coloca um Facilitador (ranged) na plataforma mais alta, junto do
  // cache vertical: o alto passa a ter valor tático (calar o atirador), não só loot.
  private spawnHighHarasser(): void {
    let bestTop = Infinity;
    let best: Phaser.Physics.Arcade.StaticBody | undefined;
    this.platforms.getChildren().forEach((p) => {
      const b = (p as Phaser.GameObjects.GameObject & { body?: Phaser.Physics.Arcade.StaticBody })
        .body;
      if (!b) return;
      // Só plataformas altas e longe do boss (não empilhar na arena).
      if (b.y < FLOOR_Y - 45 && b.x + b.width / 2 < 1500 && b.y < bestTop) {
        bestTop = b.y;
        best = b;
      }
    });
    if (!best) return;
    const cx = best.x + best.width / 2;
    const f = new FacilitadorDeWorkshop(this, cx, best.y - 40);
    f.target = this.player;
    f.onShoot = this.rangedShoot;
    this.facilitadores.add(f);
    this.physics.add.collider(f, this.platforms);
  }

  private spawnMidBreather(): void {
    const x = 1050;
    // Cafezinho de Sanidade parado no chão (não some) — alívio deliberado.
    const d = this.sanityDrops.create(x, FLOOR_Y - 30, ...resolveSprite("tex-coffee")) as
      | Phaser.Physics.Arcade.Sprite
      | undefined;
    if (d) {
      d.setDepth(8).setDisplaySize(20, 20).setData("sanity", 15).setTint(0x66ffdd);
      (d.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      this.tweens.add({ targets: d, y: d.y - 6, duration: 900, yoyo: true, repeat: -1 });
    }
    this.add
      .text(x, FLOOR_Y - 66, "🚰 METADE DO EXPEDIENTE", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#8899aa",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(6);
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
      delay: 180,
      loop: true,
      callback: () => {
        f = (f + 1) % 3;
        const [t2, fr2] = resolveSprite(`item-coffee-cup-active${f}`);
        if (coffee.active) coffee.setTexture(t2, fr2);
      },
    });
    this.time.delayedCall(10000, () => {
      if (coffee.active) coffee.destroy();
      steam.remove();
    });
  }

  // ── Evento APAGÃO: escuridão com "lanterna" ao redor do player ──────────────
  // Máscaras de geometria são Canvas-only no Phaser 4 (o jogo roda WebGL), então
  // a lanterna é uma textura 2x maior que a tela, escura com um furo radial no
  // centro (recorte via destination-out), centralizada no player a cada frame.
  // ── Evento FISCALIZAÇÃO: um Sênior extra ronda o meio da sala ───────────────
  private spawnFiscal(): void {
    const sr = new AnalistaSeniorExausto(this, 1050, FLOOR_Y - 60);
    sr.target = this.player;
    this.seniors.add(sr); // colliders/dano/hit já cobrem membros novos do grupo
    fxGlow(sr, 0xffaa33, 1200); // destaque de entrada do fiscal
  }

  // ── Segredo: bater no extintor derruba um cache de VR (1x por run) ──────────
  private checkExtintorSecret(hb: Phaser.Geom.Rectangle): void {
    if (this.extintorLooted) return;
    const zone = new Phaser.Geom.Rectangle(1782, FLOOR_Y - 54, 28, 48);
    if (!Phaser.Geom.Intersects.RectangleToRectangle(hb, zone)) return;
    this.extintorLooted = true;
    ParticleFactory.hitLight(this, 1800, FLOOR_Y - 30);
    this.dropVR(1795, FLOOR_Y - 40, 3);
    const t = this.add
      .text(1800, FLOOR_Y - 70, "🧯 CAIXINHA DO EXTINTOR  +3 VR", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffdd66",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(610);
    this.tweens.add({
      targets: t,
      y: t.y - 24,
      alpha: 0,
      duration: 1200,
      onComplete: () => t.destroy(),
    });
  }

  // Item 2 — sorteia um modificador da sala a partir do seed + loop e aplica seus efeitos.
  private rollRoomEvent(run: ReturnType<typeof getRun>): void {
    const EVENTS = [
      {
        id: "reuniao",
        name: "REUNIÃO OBRIGATÓRIA",
        desc: "Inimigos mais resistentes, mas +50% VR",
        tip: "Use o combo até o 3º hit — o VR extra paga o esforço.",
        color: "#ff8844",
        apply: () => {
          this.eventVrMult = 1.5;
          this.buffEnemyHp(1.2);
        },
      },
      {
        id: "homeoffice",
        name: "HOME OFFICE",
        desc: "Sua sanidade não cai nesta sala",
        tip: "Sem pressa: explore o alto e pegue tudo com calma.",
        color: "#66ddff",
        apply: () => {
          this.eventNoSanityDrain = true;
        },
      },
      {
        id: "sextou",
        name: "SEXTOU",
        desc: "+25% velocidade e dash mais rápido",
        tip: "Abuse do dash: encadeie kills pra manter a produtividade.",
        color: "#ffdd44",
        apply: () => {
          this.player.walkSpeed *= 1.25;
          this.player.dashCooldownBonus += 250;
        },
      },
      {
        id: "deadline",
        name: "DEADLINE INADIÁVEL",
        desc: "Inimigos mais rápidos, mas +40% VR",
        tip: "Fique em movimento e use plataformas pra quebrar a perseguição.",
        color: "#ff5566",
        apply: () => {
          this.eventVrMult = 1.4;
        },
      },
      // Eventos MECÂNICOS (mudam regra, não só número):
      {
        id: "apagao",
        name: "APAGÃO",
        desc: "Só se vê perto de você. +60% VR",
        tip: "Mate rápido e agrupado — o VR alto premia agressividade.",
        color: "#aa88ff",
        apply: () => {
          this.eventVrMult = 1.6;
          this.apagao.enable();
        },
      },
      {
        id: "fiscal",
        name: "FISCALIZAÇÃO",
        desc: "Um Sênior extra ronda a sala. +50% VR",
        tip: "Isole o Sênior num canto antes de limpar o resto.",
        color: "#ffaa33",
        apply: () => {
          this.eventVrMult = 1.5;
          this.spawnFiscal();
        },
      },
      { id: "normal", name: "", desc: "", tip: "", color: "#ffffff", apply: () => {} },
    ];
    const seedNum = run.seed ? parseInt(run.seed.replace(/\D/g, "").slice(0, 8) || "0", 10) : 0;
    // Primeira run (loopCount === 0): sala NORMAL sempre. Um novato não deve
    // cair de cara no APAGÃO (tela escura) ou na FISCALIZAÇÃO (inimigo extra) —
    // isso é o "às vezes começa diferente". A variedade de eventos entra da 2ª
    // run em diante, quando o jogador já conhece a fase base.
    const normalIdx = EVENTS.findIndex((e) => e.id === "normal");
    const idx = run.loopCount === 0 ? normalIdx : (seedNum + run.loopCount) % EVENTS.length;
    const ev = EVENTS[idx];
    if (!ev.name) return; // sala normal, sem banner
    ev.apply();

    // Indicador FIXO do evento ativo (o banner de entrada some em ~3s e deixava
    // o jogador sem saber por que a sala mudou — ex.: escuridão do APAGÃO). Fica
    // no canto durante toda a fase; depth 972 > 950 da escuridão do apagão.
    const badge = this.add
      .text(12, HUD_TOP_H + 10, `◉ ${ev.name}\n${ev.desc}\n→ ${ev.tip}`, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: ev.color,
        stroke: "#000000",
        strokeThickness: 3,
        lineSpacing: 2,
        wordWrap: { width: 250 },
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(972);
    this.add
      .rectangle(badge.x - 4, badge.y - 3, badge.width + 8, badge.height + 6, 0x0a0d12, 0.6)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(971);

    // Banner de entrada
    const banner = this.add
      .text(GAME_WIDTH / 2, 110, ev.name, {
        fontFamily: "monospace",
        fontSize: "18px",
        color: ev.color,
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(970)
      .setAlpha(0);
    const sub = this.add
      .text(GAME_WIDTH / 2, 132, ev.desc, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#dddddd",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(970)
      .setAlpha(0);
    this.tweens.add({
      targets: [banner, sub],
      alpha: 1,
      duration: 400,
      hold: 2600,
      yoyo: true,
      onComplete: () => {
        banner.destroy();
        sub.destroy();
      },
    });
  }

  private buffEnemyHp(mult: number): void {
    [
      this.estagiarios,
      this.sobrecarregados,
      this.analistas,
      this.onboardings,
      this.facilitadores,
      this.scrums,
      this.coordenadores,
      this.seniors,
      this.rhs,
    ].forEach((g) =>
      g.getChildren().forEach((c) => {
        const e = c as Phaser.Physics.Arcade.Sprite & { hp?: number };
        if (typeof e.hp === "number") e.hp = Math.round(e.hp * mult);
      }),
    );
  }

  protected dropVR(x: number, y: number, count = 1): void {
    for (let i = 0; i < count; i++) {
      const d = this.drops.create(
        x + (i - count / 2) * 8,
        y - 10,
        "tex-vr",
      ) as Phaser.Physics.Arcade.Sprite;
      d.setDepth(8).setTint(0xffd700);
      const body = d.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Phaser.Math.Between(-120, 120), Phaser.Math.Between(-260, -160));
      body.setBounce(0.4);
      body.setDrag(120, 0);
      // #4 Glow + #9 Hover: after drop settles, pulse scale
      this.time.delayedCall(700, () => {
        if (d.active && d.scene) {
          this.tweens.add({
            targets: d,
            scaleX: 1.25,
            scaleY: 1.25,
            duration: 480,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
      });
    }
  }

  // BasePhaseScene.update() cuida de player.update, tickPassive (via
  // sanityDrainEnabled), homing ink, contato+HUD do boss, sanity fx, near-door e
  // hud.update. Aqui ficam só os extras exclusivos da Fase 1.
  protected sanityDrainEnabled(): boolean {
    return !this.eventNoSanityDrain;
  }

  protected onPhaseUpdate(time: number, _delta: number): void {
    this.prod.draw(time);
    this.updateHealerMarkers(time);

    // APAGÃO: centraliza o furo da escuridão no player (coords de tela).
    this.apagao.reposition(this.player.x, this.player.y);

    // Physics body sleep: disable body for enemies far off-screen to save CPU
    const camBounds = this.cameras.main.worldView;
    const padding = 300; // px beyond viewport
    for (const group of [
      this.estagiarios,
      this.analistas,
      this.facilitadores,
      this.scrums,
      this.coordenadores,
      this.seniors,
      this.rhs,
    ]) {
      group.getChildren().forEach((child) => {
        const sprite = child as Phaser.Physics.Arcade.Sprite;
        if (!sprite.active) return;
        const inView = sprite.x > camBounds.left - padding && sprite.x < camBounds.right + padding;
        if (sprite.body) (sprite.body as Phaser.Physics.Arcade.Body).enable = inView;
      });
    }

    // AnalistaJunior melee hitbox
    this.analistas.getChildren().forEach((c) => {
      const a = c as AnalistaJunior;
      if (
        a.swingActive &&
        a.swingHitbox &&
        Phaser.Geom.Intersects.RectangleToRectangle(a.swingHitbox, this.player.getBounds())
      ) {
        this.player.takeDamage(a.swingDamage, 6, a.x);
        a.swingActive = false;
        a.swingHitbox = null;
      }
    });

    // AnalistaSenior melee hitbox
    this.seniors.getChildren().forEach((c) => {
      const sr = c as AnalistaSeniorExausto;
      if (
        sr.swingActive &&
        sr.swingHitbox &&
        !this.player.isInvulnerable(time) &&
        Phaser.Geom.Intersects.RectangleToRectangle(sr.swingHitbox, this.player.getBounds())
      ) {
        this.player.takeDamage(sr.swingDamage, 3, sr.x);
        sr.swingActive = false;
        sr.swingHitbox = null;
      }
    });

    // EnemyRH melee hitbox
    this.rhs.getChildren().forEach((c) => {
      const rh = c as EnemyRH;
      if (
        rh.swingActive &&
        rh.swingHitbox &&
        !this.player.isInvulnerable(time) &&
        Phaser.Geom.Intersects.RectangleToRectangle(rh.swingHitbox, this.player.getBounds())
      ) {
        this.player.takeDamage(rh.swingDamage, 5, rh.x);
        rh.swingActive = false;
        rh.swingHitbox = null;
      }
    });

    // Golpe (swing) do Gerente — o contato + HUD do boss são tratados por
    // BasePhaseScene.update(); aqui só a hitbox de ataque, que a base não conhece.
    const gerente = this.gerente;
    if (
      gerente?.active &&
      gerente.swingActive &&
      gerente.swingHitbox &&
      !this.player.isInvulnerable(time) &&
      Phaser.Geom.Intersects.RectangleToRectangle(gerente.swingHitbox, this.player.getBounds())
    ) {
      this.player.takeDamage(gerente.swingDamage, 5, gerente.x);
      gerente.swingActive = false;
      gerente.swingHitbox = null;
    }

    // Item 3 — Tutorial implícito: show control hints for first 12s on loop 0.
    // Barra horizontal no topo do playfield (abaixo do header da HUD), fora da
    // área do painel inferior — a versão antiga ficava em y>=460, escondida
    // atrás da HUD (depth 1000).
    if (!this.tutorialShown && getRun(this).loopCount === 0 && time - this.startTimeMs < 12000) {
      this.tutorialShown = true;
      const hintBar =
        "← → mover    Espaço pular    Shift dash    J atacar    K especial    E interagir";
      const y = HUD_TOP_H + 22;
      const t = this.add
        .text(GAME_WIDTH / 2, y, hintBar, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#cfd6e0",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(980)
        .setAlpha(0);
      const bg = this.add
        .rectangle(GAME_WIDTH / 2, y, t.width + 24, 20, 0x0a0d12, 0.72)
        .setScrollFactor(0)
        .setDepth(979)
        .setAlpha(0);
      this.tweens.add({ targets: [t, bg], alpha: 1, duration: 400 });
      this.tweens.add({
        targets: [t, bg],
        alpha: 0,
        duration: 800,
        delay: 8000,
        onComplete: () => {
          t.destroy();
          bg.destroy();
        },
      });
    }

    // Teaching de parry por demonstração: quando o 1º estagiário chega perto
    // (o contato dele é parryável), um prompt ensina "aperte F para RECLAMAR".
    // A zona 1 tem 3 estagiários, então há chances repetidas de tentar.
    if (!this.parryTaught && getRun(this).loopCount === 0) {
      let nearEnemy = false;
      this.estagiarios.getChildren().forEach((c) => {
        const e = c as Phaser.Physics.Arcade.Sprite;
        if (e.active && Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < 130)
          nearEnemy = true;
      });
      if (nearEnemy) {
        this.parryTaught = true;
        const p = this.add
          .text(GAME_WIDTH / 2, HUD_TOP_H + 54, "⚠ APERTE  [ F ]  PARA RECLAMAR (parry)!", {
            fontFamily: "monospace",
            fontSize: "13px",
            fontStyle: "bold",
            color: "#ffdd44",
            stroke: "#000000",
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(985);
        this.tweens.add({
          targets: p,
          scaleX: 1.08,
          scaleY: 1.08,
          duration: 420,
          yoyo: true,
          repeat: 4,
          ease: "Sine.easeInOut",
        });
        this.tweens.add({
          targets: p,
          alpha: 0,
          duration: 700,
          delay: 4200,
          onComplete: () => p.destroy(),
        });
      }
    }

    // Item 8 — Boss room dramatic entry: trigger when player crosses x=1580
    // Fase 1 sem boss: ao ALCANÇAR A SAÍDA (depois da onda final da zona 5, cujo
    // trio fica em x≈1590/1700/1780), a Copa é liberada. x>1800 = perto da porta.
    if (!this.bossEntryTriggered && !this.bossDefeated && this.player.x > 1800) {
      this.bossEntryTriggered = true; // one-shot
      this.handlePhase1Complete();
    }

    // #8 Fake shadows: ellipses drawn just below each entity's feet
    this.shadowG.clear();
    this.shadowG.fillStyle(0x000000, 0.22);
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    const pLift = Math.max(0, FLOOR_Y - pb.bottom);
    this.shadowG.fillEllipse(
      this.player.x,
      Math.min(pb.bottom, FLOOR_Y) + 4,
      Math.max(10, 32 - pLift * 0.14),
      Math.max(2, 6 - pLift * 0.03),
    );
    [
      this.estagiarios,
      this.analistas,
      this.facilitadores,
      this.scrums,
      this.coordenadores,
      this.seniors,
      this.rhs,
    ].forEach((g) =>
      g.getChildren().forEach((c) => {
        const e = c as Phaser.Physics.Arcade.Sprite;
        if (!e.active) return;
        const eb = e.body as Phaser.Physics.Arcade.Body;
        this.shadowG.fillEllipse(e.x, Math.min(eb.bottom, FLOOR_Y) + 4, 26, 5);
      }),
    );
    if (this.boss?.active) {
      const bb = this.boss.body as Phaser.Physics.Arcade.Body;
      const bLift = Math.max(0, FLOOR_Y - bb.bottom);
      this.shadowG.fillEllipse(
        this.boss.x,
        Math.min(bb.bottom, FLOOR_Y) + 4,
        Math.max(14, 44 - bLift * 0.1),
        Math.max(3, 8 - bLift * 0.03),
      );
    }
  }
}
