import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { HUD_BOT_Y, HUD_TOP_H } from "../systems/Hud";
import { addPhaseBackground } from "../systems/Background";
import { PLAT_DEFS } from "../systems/TextureFactory";
import { Player } from "../entities/Player";
import {
  EstagiarioDesesperado, AnalistaJunior,
  FacilitadorDeWorkshop, PostIt,
  ScrumMasterCaotico,
  CoordenadorDeSinergia,
  AnalistaSeniorExausto,
  ConviteReuniao,
} from "../entities/Enemies";
import { GerenteMicrogestor, EmailProjectil } from "../entities/Boss";
import { getRun, savePersisted } from "../systems/PlayerState";
import { CLASSES, WEAPONS, WeaponDef, WeaponId, ClassId } from "../systems/WeaponSystem";
import { SanityFx } from "../systems/SanityFx";
import { Hud } from "../systems/Hud";
import { reapplyAllPerks } from "../systems/PerkSystem";
import { addImage } from "../systems/SpriteLibrary";

const LEVEL_WIDTH = 1920;
const FLOOR_Y = HUD_BOT_Y - 32;

export class OpenSpaceScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
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
  private convites: ConviteReuniao[] = [];
  private boss?: GerenteMicrogestor;
  private levelWidth = LEVEL_WIDTH;
  private bossDefeated = false;
  private phase2Active = false;
  private startTimeMs = 0;
  private fx!: SanityFx;
  private hud!: Hud;
  private doorCopa!: Phaser.GameObjects.Image;
  private doorLabel!: Phaser.GameObjects.Text;
  private interactKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super("OpenSpaceScene");
  }

  create() {
    const run = getRun(this);
    this.startTimeMs = this.time.now;
    this.bossDefeated = false;
    this.phase2Active = false;
    this.convites = [];

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.bg);

    // Pixel-art office background (generated — consistent with game art style)
    addPhaseBackground(this, "pxbg-openspace", HUD_TOP_H, FLOOR_Y);

    [80, 340, 600, 860, 1120, 1380, 1640, 1880].forEach(x => {
      addImage(this, x, FLOOR_Y - 28, "tex-baia");
    });

    this.platforms = this.physics.add.staticGroup();
    this.buildFloor();
    this.buildDecor();
    this.buildInteractiveObjects();

    // Zone 1 — Entrada (x 100-520): cluster de mesas + estante
    this.buildPlatform(200, 0, 3);   // mesa, 3 tiles → x=200-296
    this.buildPlatform(350, 1, 2);   // estante alta, 2 tiles → x=350-414

    // Zone 2 — Open Space A (x 520-960): mesa cluster + armário
    this.buildPlatform(540, 0, 4);   // mesa cluster, 4 tiles → x=540-668
    this.buildPlatform(730, 2, 2);   // armário, 2 tiles → x=730-794

    // Zone 3 — Open Space B (x 960-1440): área densa
    this.buildPlatform(1000, 0, 3);  // mesa, 3 tiles
    this.buildPlatform(1150, 1, 2);  // estante, 2 tiles
    this.buildPlatform(1290, 2, 2);  // armário, 2 tiles

    // Zone 4 — Área do Boss (x 1440-1920): últimas coberturas
    this.buildPlatform(1500, 0, 3);  // mesa
    this.buildPlatform(1660, 0, 2);  // mesa menor

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

    // Apply class base stats
    this.player.maxEnergy   = classDef.maxEnergy;
    this.player.maxSanity   = classDef.maxSanity;
    this.player.walkSpeed   = 200 * classDef.speedMult;
    this.player.damageMult  = classDef.damageMult;
    this.player.vrDropMult  = classDef.vrMult;
    this.player.weaponId    = weaponId;
    this.player.attackRange = weaponDef.attackRange;
    this.player.specialCooldown = weaponDef.specialCooldown;
    this.player.specialType = weaponDef.specialType;
    this.player.hitAutoRanged = weaponDef.hitAutoRanged;
    this.player.isRangedPrimary = weaponDef.type === "ranged";
    this.player.comboHits = (weaponDef.type === "melee" && weaponDef.hitDamages[2] === 0) ? 2 : 3;
    this.player.attackIntervalMs = Math.round(220 / (weaponDef.attackSpeedMult ?? 1));

    if (run.cameFrom === "copa") {
      this.player.energy = run.energy;
      this.player.sanity = run.sanity;
    } else {
      this.player.energy = classDef.maxEnergy;
      this.player.sanity = classDef.maxSanity;
    }
    this.player.vr = run.vr;
    this.player.autonomia = run.autonomia ?? false;
    reapplyAllPerks(this.player, run);
    this.physics.add.collider(this.player, this.platforms);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.player.onDeath = (cause) => {
      const run = getRun(this);
      if ((run.extraLives ?? 0) > 0) {
        run.extraLives!--;
        this.player.energy = 30;
        this.player.sanity = Math.max(this.player.sanity, 25);
        (this.player as any).invulnUntil = this.time.now + 1500;
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
          for (let i = 0; i < 2; i++) {
            this.time.delayedCall(i * 100, () => {
              this.spawnProjectile({ x: fx + facing * 20, y: fy - 5, velX: facing * (def.rangedSpeed || 500), damage: def.rangedDamage || def.hitDamages[0] });
            });
          }
          break;
        case "wide_sweep": {
          const hb = new Phaser.Geom.Rectangle(
            facing > 0 ? fx : fx - 100, fy - 24, 100, 48
          );
          this.resolveAttack(hb, 3);
          break;
        }
        case "aerial_spike": {
          const hb = new Phaser.Geom.Rectangle(fx - 20, fy - 50, 40, 50);
          this.resolveAttack(hb, 3);
          this.player.body && ((this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(-300));
          break;
        }
        case "throw_weapon": {
          this.spawnProjectile({ x: fx + facing * 20, y: fy - 10, velX: facing * 700, damage: def.hitDamages[1] * 2 });
          break;
        }
        case "emp_pulse": {
          const stun = (sprite: Phaser.GameObjects.GameObject) => {
            if (sprite instanceof Phaser.Physics.Arcade.Sprite) {
              const s = sprite as any;
              if (s.applyFreeze) s.applyFreeze(900);
            }
          };
          [this.estagiarios, this.analistas, this.facilitadores, this.scrums, this.coordenadores, this.seniors].forEach(g => g?.getChildren().forEach(stun));
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
              velX: facing * spd * Math.cos(a),
              velY: spd * Math.sin(a),
              damage: def.rangedDamage || def.hitDamages[0],
              piercing: def.rangedPiercing,
            });
          });
          break;
        }
        case "caneca_arc": {
          this.spawnProjectile({
            x: fx + facing * 20, y: fy - 20,
            velX: facing * 400, velY: -350,
            damage: def.hitDamages[2],
            arc: true,
          });
          break;
        }
        case "wide_beam": {
          const beamY = fy - 10;
          const beamRect = new Phaser.Geom.Rectangle(
            facing > 0 ? fx : 0,
            beamY - 15,
            facing > 0 ? this.levelWidth - fx : fx,
            30
          );
          this.resolveAttack(beamRect, 3);
          const lineW = facing > 0 ? (this.levelWidth - fx) : fx;
          const lineX = facing > 0 ? fx + lineW / 2 : fx / 2;
          const line = this.add.rectangle(lineX, beamY, lineW, 6, 0x88aaff, 0.8);
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
          [this.estagiarios, this.analistas, this.facilitadores, this.scrums, this.coordenadores, this.seniors].forEach(g => {
            g?.getChildren().forEach(e => allEnemies.push(e as Phaser.Physics.Arcade.Sprite));
          });
          const sorted = allEnemies
            .filter(e => e.active)
            .sort((a, b) => Phaser.Math.Distance.Between(fx, fy, a.x, a.y) - Phaser.Math.Distance.Between(fx, fy, b.x, b.y));
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
      }
    };

    // Enemy groups
    this.estagiarios  = this.physics.add.group({ classType: EstagiarioDesesperado, runChildUpdate: false });
    this.analistas    = this.physics.add.group({ classType: AnalistaJunior,         runChildUpdate: false });
    this.facilitadores = this.physics.add.group({ classType: FacilitadorDeWorkshop, runChildUpdate: false });
    this.scrums       = this.physics.add.group({ classType: ScrumMasterCaotico,     runChildUpdate: false });
    this.coordenadores = this.physics.add.group({ classType: CoordenadorDeSinergia, runChildUpdate: false });
    this.seniors      = this.physics.add.group({ classType: AnalistaSeniorExausto,  runChildUpdate: false });
    this.postits         = this.physics.add.group();
    this.emails          = this.physics.add.group();
    this.inkProjectiles  = this.physics.add.group();
    this.drops           = this.physics.add.group();

    if (run.openSpaceCleared === true) {
      this.bossDefeated = true;
      this.doorCopa.clearTint();
      this.doorLabel.setText("COPA").setColor("#c9a36a");
    } else {
      this.spawnEnemies();
    }

    // Colliders
    [this.estagiarios, this.analistas, this.facilitadores, this.scrums,
     this.coordenadores, this.seniors, this.drops].forEach((g) =>
      this.physics.add.collider(g, this.platforms)
    );

    // Player ↔ enemy contacts
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

    // Ink projectile hits enemies
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
        const died = enemy.hit(Math.round(dmg * this.player.damageMult), 0);
        if (!piercing) ink.destroy();
        if (died) {
          this.dropVR(enemy.x, enemy.y, Math.max(1, Math.round(vrDrop * this.player.vrDropMult)));
          enemy.destroy();
        }
      });
    });

    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      this.player.addVR(1);
      (dObj as Phaser.Physics.Arcade.Sprite).destroy();
    });

    // Copa door zone (locked until boss death)
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
    this.hud.setPhaseTitle("FASE 1 — OPEN SPACE");
    this.hud.setObjective("Derrote o Gerente e acesse a Copa");

    const title = this.add
      .text(GAME_WIDTH / 2, 110, "18:00 — Quarta-feira\nArea 1: Estacoes de Trabalho", {
        fontFamily: "monospace", fontSize: "18px", color: "#eaeaea", align: "center",
        stroke: "#000000", strokeThickness: 3,
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(999);
    this.tweens.add({ targets: title, alpha: 0, duration: 800, delay: 2200, onComplete: () => title.destroy() });
  }

  private persist() {
    const r = getRun(this);
    r.energy    = this.player.energy;
    r.sanity    = this.player.sanity;
    r.vr        = this.player.vr;
    r.autonomia = this.player.autonomia;
  }

  private buildFloor() {
    this.add.tileSprite(LEVEL_WIDTH / 2, FLOOR_Y + 8, LEVEL_WIDTH, 16, "tex-floor");
    const floorPhys = this.add.rectangle(LEVEL_WIDTH / 2, FLOOR_Y + 8, LEVEL_WIDTH, 16, 0x000000, 0);
    this.physics.add.existing(floorPhys, true);
    this.platforms.add(floorPhys);
  }

  private buildPlatform(x: number, defIdx: number, tiles: number): void {
    const def = PLAT_DEFS[defIdx];
    const surfY = FLOOR_Y - def.height;  // surface is always grounded at floor
    const w = tiles * 32;

    // Surface tiles (14px, centered at surfY)
    for (let i = 0; i < tiles; i++) {
      this.add.image(x + i * 32 + 16, surfY, def.surf)
        .setDisplaySize(32, 14).setDepth(9);
    }

    // Body: extends from below surface all the way to the floor
    const bodyTop = surfY + 7;  // bottom edge of surface tile
    const bodyH = FLOOR_Y - bodyTop;
    const bodyMidY = bodyTop + bodyH / 2;
    for (let i = 0; i < tiles; i++) {
      this.add.image(x + i * 32 + 16, bodyMidY, def.body)
        .setDisplaySize(32, bodyH).setDepth(7);
    }

    // Drop shadow under furniture group (depth 5, slightly wider than furniture)
    this.add.rectangle(x + w / 2, FLOOR_Y + 3, w + 8, 7, 0x000000, 0.26).setDepth(5);

    // Physics rectangle at surface level
    const plat = this.add.rectangle(x + w / 2, surfY, w, 14, 0x000000, 0);
    this.physics.add.existing(plat, true);
    this.platforms.add(plat);
  }

  private buildInteractiveObjects(): void {
    // Café machine — near entrance corner (real sprite ~40×56 at 2x)
    addImage(this, 60, FLOOR_Y - 28, "tex-cafe-machine").setDepth(8).setDisplaySize(40, 56);

    // Bebedouro — between zones 1 and 2 (real sprite 32×48)
    addImage(this, 490, FLOOR_Y - 24, "tex-bebedouro").setDepth(8).setDisplaySize(32, 48);

    // Impressora — near desk cluster zone 2
    addImage(this, 690, FLOOR_Y - 18, "tex-obj-impressora").setDepth(8).setDisplaySize(48, 36);

    // Quadro motivacional — wall decoration with parallax (real sprite 48×56)
    [450, 1100, 1650].forEach(x => {
      addImage(this, x, HUD_TOP_H + 80, "tex-quadro-motivacional").setDepth(2).setDisplaySize(48, 56).setScrollFactor(0.2, 0);
    });

    // Quadro branco — meeting room / open area wall (real sprite 48×40)
    [780, 1300].forEach(x => {
      addImage(this, x, HUD_TOP_H + 70, "tex-quadro-branco").setDepth(2).setDisplaySize(48, 40).setScrollFactor(0.2, 0);
    });

    // Relógio de parede (real sprite 28×28, displayed 2x)
    [320, 960, 1480].forEach(x => {
      addImage(this, x, HUD_TOP_H + 36, "tex-relogio").setDepth(2).setDisplaySize(28, 28).setScrollFactor(0.2, 0);
    });

    // Relógio do ponto — at entrance
    addImage(this, 140, FLOOR_Y - 32, "tex-ponto").setDepth(8).setDisplaySize(32, 48);

    // Extintor — red on wall near elevator area
    addImage(this, 1800, FLOOR_Y - 22, "tex-extintor").setDepth(8).setDisplaySize(20, 44);

    // Monitores — on desk surfaces (real sprite 44×32)
    [220, 380, 560, 620, 1020, 1300, 1510].forEach(x => {
      addImage(this, x, FLOOR_Y - 46, "tex-monitor").setDepth(9).setDisplaySize(44, 32);
    });

    // Pilha de documentos — on desks or floor (real sprite 32×32)
    [240, 600, 1050, 1530].forEach(x => {
      addImage(this, x, FLOOR_Y - 12, "tex-pilha-docs").setDepth(8).setDisplaySize(32, 32);
    });

    // Caixa de papel — floor level (real sprite 36×32)
    [350, 1200, 1680].forEach(x => {
      addImage(this, x, FLOOR_Y - 16, "tex-caixa-papel").setDepth(8).setDisplaySize(36, 32);
    });

    // Lixeiras — near desk clusters (real sprite 24×32)
    [280, 650, 1070, 1570].forEach(x => {
      addImage(this, x, FLOOR_Y - 16, "tex-lixeira").setDepth(8).setDisplaySize(24, 32);
    });

    // Porta de reunião — meeting room door in wall background
    addImage(this, 780, FLOOR_Y - 48, "tex-porta-reuniao").setDepth(8).setDisplaySize(48, 80);

    // Elevador — at the far end (destination after clearing the boss, real sprite 32×56 shown 2x)
    addImage(this, LEVEL_WIDTH - 80, FLOOR_Y - 44, "tex-elevador").setDepth(8).setDisplaySize(64, 88);
  }

  private buildDecor(): void {
    // Cadeiras (decorativas — não têm física)
    [160, 490, 660, 970, 1380, 1620].forEach(x => {
      addImage(this, x, FLOOR_Y - 14, "tex-cadeira").setDisplaySize(32, 28).setDepth(6);
    });

    // Plantas (decorativas, real sprite 32×40)
    [120, 500, 870, 1340, 1580, 1820].forEach(x => {
      addImage(this, x, FLOOR_Y - 20, "tex-planta-deco").setDisplaySize(32, 40).setDepth(6);
    });

    // Bebedouro decorativo (real sprite 32×48)
    [850, 1430].forEach(x => {
      addImage(this, x, FLOOR_Y - 24, "tex-bebedouro-deco").setDisplaySize(32, 48).setDepth(6);
    });

    // Mesas decorativas no chão (real sprite 64×40)
    [200, 560, 1000, 1500].forEach(x => {
      addImage(this, x + 32, FLOOR_Y - 20, "tex-mesa-deco").setDisplaySize(64, 40).setDepth(5);
    });

    // Impressoras decorativas (no chão, não como plataforma)
    addImage(this, 1350, FLOOR_Y - 14, "tex-obj-impressora").setDepth(6).setScale(0.5);
  }

  private spawnEnemies() {
    // Area 1 (x 300-700): Estagiários básicos
    [380, 560, 700].forEach((x) => {
      const e = new EstagiarioDesesperado(this, x, FLOOR_Y - 40, Math.random() > 0.5 ? 1 : -1);
      this.estagiarios.add(e);
    });

    // Area 2 (x 700-1100): Facilitadores + Scrums + Convites de Reunião
    [820, 1020].forEach((x) => {
      const f = new FacilitadorDeWorkshop(this, x, FLOOR_Y - 60);
      f.target = this.player;
      f.onShoot = (fx, fy, tx, ty) => this.spawnPostIt(fx, fy, tx, ty);
      this.facilitadores.add(f);
    });
    const scrum = new ScrumMasterCaotico(this, 950, FLOOR_Y - 60);
    scrum.target = this.player;
    scrum.onShout = (fromX, fromY) => this.handleScrumShout(fromX, fromY);
    this.scrums.add(scrum);

    // Convites de Reunião (traps) — Area 2
    [740, 840, 920, 1060].forEach((x) => {
      const y = Phaser.Math.Between(FLOOR_Y - 200, FLOOR_Y - 100);
      this.convites.push(new ConviteReuniao(this, x, y));
    });

    // Area 3 (x 1100-1500): AnalistaJunior
    [1150, 1250, 1400].forEach((x) => {
      const a = new AnalistaJunior(this, x, FLOOR_Y - 60);
      a.target = this.player;
      this.analistas.add(a);
    });

    // Area 4 (x 1500-1900): Coordenadores + Seniors + boss
    [1500, 1700].forEach((x) => {
      const e = new EstagiarioDesesperado(this, x, FLOOR_Y - 40, Math.random() > 0.5 ? 1 : -1);
      this.estagiarios.add(e);
    });
    const coord = new CoordenadorDeSinergia(this, 1620, FLOOR_Y - 60);
    coord.target = this.player;
    this.coordenadores.add(coord);

    const sr = new AnalistaSeniorExausto(this, 1700, FLOOR_Y - 60);
    sr.target = this.player;
    this.seniors.add(sr);

    // Boss — Gerente Microgestor
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
      // Pull player toward boss: positive dir means boss is to the right of player
      const dir = targetX > this.player.x ? 1 : -1;
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(dir * 360);
    };
    boss.onFreeze = (ms) => this.player.applyFreeze(ms);
    boss.onSpawn  = (x, y) => {
      const e = new EstagiarioDesesperado(this, x, y, Math.random() > 0.5 ? 1 : -1);
      this.estagiarios.add(e);
      this.physics.add.collider(e, this.platforms);
    };
    boss.onPhase2 = () => {
      this.phase2Active = true;
      this.hud.setObjective("FASE 2 — Deadline Inadiavel!");
      const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0.35)
        .setScrollFactor(0).setDepth(990);
      this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
    };
    boss.onDied = () => this.handleBossDefeat(boss);
    this.boss = boss;
    this.physics.add.collider(boss, this.platforms);

    // Ink projectiles can also hit the boss
    this.physics.add.overlap(this.inkProjectiles, boss, (inkObj) => {
      const ink = inkObj as Phaser.Physics.Arcade.Sprite;
      if (!ink.active || !this.boss?.active) return;
      const dmg = (ink.getData("damage") as number) ?? 10;
      const piercing = (ink.getData("piercing") as boolean) ?? false;
      this.boss.hit(Math.round(dmg * this.player.damageMult), 0);
      if (!piercing) ink.destroy();
    });
  }

  private spawnPostIt(fx: number, fy: number, tx: number, ty: number) {
    const p = new PostIt(this, fx, fy);
    this.postits.add(p);
    p.fire(tx, ty);
  }

  private handleScrumShout(fromX: number, fromY: number) {
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, fromX, fromY);
    if (dist < 260) {
      const dir = fromX < this.player.x ? -1 : 1;
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(dir * -220);
    }
  }

  private handleBossDefeat(boss: GerenteMicrogestor) {
    this.bossDefeated = true;
    getRun(this).openSpaceCleared = true;
    this.hud.hideBoss();
    this.hud.setObjective("Copa desbloqueada! Use [ E ] na porta.");

    // Drop VR shower (scaled by class/perk vrDropMult)
    const dropsPerTick = Math.max(1, Math.round(this.player.vrDropMult));
    for (let i = 0; i < 18; i++) {
      this.time.delayedCall(i * 60, () => {
        if (!boss.active) this.dropVR(boss.x + Phaser.Math.Between(-70, 70), boss.y - 20, dropsPerTick);
      });
    }
    boss.destroy();

    // Grant Autonomia perk
    const run = getRun(this);
    run.autonomia = true;
    this.player.autonomia = true;
    savePersisted(run.reconhecimento, run.fgts, run.loopCount);

    // Unlock Copa door
    this.doorCopa.clearTint();
    this.doorLabel.setText("COPA").setColor("#c9a36a");

    // Victory message
    const msg = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30,
        "GERENTE DERROTADO!\n\nPerk: AUTONOMIA ativado\n-50% duracao de controles\n\nPorta da Copa desbloqueada  ->",
        { fontFamily: "monospace", fontSize: "15px", color: "#f2c14e",
          stroke: "#000000", strokeThickness: 3, align: "center" })
      .setOrigin(0.5).setScrollFactor(0).setDepth(999);
    this.tweens.add({ targets: msg, alpha: 0, duration: 900, delay: 4500, onComplete: () => msg.destroy() });
  }

  private resolveAttack(hb: Phaser.Geom.Rectangle, step: number) {
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
    const tryHitGO = (s: Phaser.GameObjects.Sprite) =>
      Phaser.Geom.Intersects.RectangleToRectangle(hb, s.getBounds());

    const hitGroup = (
      group: Phaser.Physics.Arcade.Group,
      vrDrop: number,
      cast: (c: Phaser.GameObjects.GameObject) => Phaser.Physics.Arcade.Sprite & { hit: (d: number, k: number) => boolean; applySlowdown?: (ms: number) => void },
    ) => {
      group.getChildren().forEach((c) => {
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
          this.tweens.add({
            targets: e,
            scaleX: 1.6, scaleY: 0.2, alpha: 0,
            duration: 120,
            onComplete: () => e.destroy(),
          });
          e.setActive(false);
        }
      });
    };

    hitGroup(this.estagiarios,   1, (c) => c as EstagiarioDesesperado);
    hitGroup(this.analistas,     3, (c) => c as AnalistaJunior);
    hitGroup(this.facilitadores, 2, (c) => c as FacilitadorDeWorkshop);
    hitGroup(this.scrums,        2, (c) => c as ScrumMasterCaotico);
    hitGroup(this.coordenadores, 4, (c) => c as CoordenadorDeSinergia);
    hitGroup(this.seniors,       6, (c) => c as AnalistaSeniorExausto);

    // Boss
    if (this.boss && this.boss.active && tryHit(this.boss)) {
      const bossDmgText = this.add.text(this.boss.x, this.boss.y - 20, `-${damage}`, {
        fontFamily: "monospace", fontSize: "11px", fontStyle: "bold",
        color: step >= comboHits ? "#ff4444" : "#ffcc44",
        stroke: "#000000", strokeThickness: 2,
      }).setOrigin(0.5).setDepth(600);
      this.tweens.add({ targets: bossDmgText, y: bossDmgText.y - 28, alpha: 0, duration: 500, onComplete: () => bossDmgText.destroy() });
      this.boss.hit(damage, knockback);
    }

    // Convites (1 hit destroys, +1 VR bonus)
    this.convites = this.convites.filter((c) => {
      if (!c.active) return false;
      if (tryHitGO(c)) { c.destroy(); this.player.addVR(1); return false; }
      return true;
    });
  }

  private spawnProjectile(opts: {
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

  private dropVR(x: number, y: number, count = 1) {
    for (let i = 0; i < count; i++) {
      const d = this.drops.create(x + (i - count / 2) * 8, y - 10, "tex-vr") as Phaser.Physics.Arcade.Sprite;
      const body = d.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Phaser.Math.Between(-120, 120), Phaser.Math.Between(-260, -160));
      body.setBounce(0.4);
      body.setDrag(120, 0);
    }
  }

  update(time: number, delta: number) {
    this.player.update(time, delta);
    this.player.tickPassive(time);

    // Homing projectiles
    this.inkProjectiles.getChildren().forEach(obj => {
      const ink = obj as Phaser.Physics.Arcade.Sprite;
      if (!ink.active) return;
      // Expire old projectiles
      const lifetime = ink.getData("lifetime") as number;
      if (lifetime && lifetime < time) { ink.destroy(); return; }
      if (!ink.getData("homing")) return;
      // Find nearest active enemy
      const allEnemies: Phaser.Physics.Arcade.Sprite[] = [];
      [this.estagiarios, this.analistas, this.facilitadores, this.scrums, this.coordenadores, this.seniors].forEach(g => {
        g?.getChildren().forEach(e => allEnemies.push(e as Phaser.Physics.Arcade.Sprite));
      });
      const nearest = allEnemies.filter(e => e.active).sort((a, b) =>
        Phaser.Math.Distance.Between(ink.x, ink.y, a.x, a.y) - Phaser.Math.Distance.Between(ink.x, ink.y, b.x, b.y)
      )[0];
      if (nearest) {
        const ibody = ink.body as Phaser.Physics.Arcade.Body;
        const angle = Phaser.Math.Angle.Between(ink.x, ink.y, nearest.x, nearest.y);
        const spd = 480;
        ibody.setVelocity(Math.cos(angle) * spd, Math.sin(angle) * spd);
      }
    });

    // AnalistaJunior swing
    this.analistas.getChildren().forEach((c) => {
      const a = c as AnalistaJunior;
      if (a.swingActive && a.swingHitbox) {
        if (Phaser.Geom.Intersects.RectangleToRectangle(a.swingHitbox, this.player.getBounds())) {
          this.player.takeDamage(a.swingDamage, 6, a.x);
          a.swingActive = false; a.swingHitbox = null;
        }
      }
    });

    // AnalistaSenior slam
    this.seniors.getChildren().forEach((c) => {
      const sr = c as AnalistaSeniorExausto;
      if (sr.swingActive && sr.swingHitbox) {
        if (!this.player.isInvulnerable(time) &&
            Phaser.Geom.Intersects.RectangleToRectangle(sr.swingHitbox, this.player.getBounds())) {
          this.player.takeDamage(sr.swingDamage, 3, sr.x);
          sr.swingActive = false; sr.swingHitbox = null;
        }
      }
    });

    // Boss dash contact
    if (this.boss?.active) {
      if (this.boss.swingActive && this.boss.swingHitbox) {
        if (!this.player.isInvulnerable(time) &&
            Phaser.Geom.Intersects.RectangleToRectangle(this.boss.swingHitbox, this.player.getBounds())) {
          this.player.takeDamage(this.boss.swingDamage, 5, this.boss.x);
          this.boss.swingActive = false; this.boss.swingHitbox = null;
        }
      }
      // Boss contact walk damage
      if (!this.player.isInvulnerable(time) &&
          Phaser.Geom.Intersects.RectangleToRectangle(this.boss.getBounds(), this.player.getBounds())) {
        this.player.takeDamage(this.boss.contactDamage, 3, this.boss.x);
      }
    }

    // Convites de Reunião collision
    this.convites = this.convites.filter((c) => c.active);
    this.convites.forEach((c) => {
      if (!this.player.isInvulnerable(time) &&
          Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), c.getBounds())) {
        this.player.sanity = Math.max(0, this.player.sanity - 10);
        this.player.applySlowdown(2000);
        c.destroy();
      }
    });

    // Coordenador buff — no per-frame velocity multiplication (causes compounding)

    this.fx.update(time, this.player.sanity);

    // Phase 2: extra sanity drain
    if (this.phase2Active && time % 1200 < delta) {
      this.player.sanity = Math.max(0, this.player.sanity - 1);
    }

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
