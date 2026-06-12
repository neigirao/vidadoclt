import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { HUD_BOT_Y } from "../systems/Hud";
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

    // Full level background image
    const HUD_TOP_H = 68;
    this.add.image(LEVEL_WIDTH / 2, (HUD_TOP_H + FLOOR_Y) / 2, "bg-openspace")
      .setDisplaySize(LEVEL_WIDTH, FLOOR_Y - HUD_TOP_H);

    for (let x = 80; x < LEVEL_WIDTH; x += 260) {
      const baia = this.add.image(x, FLOOR_Y - 28, "tex-baia");
      baia.setTint(0x4b525e);
    }

    this.platforms = this.physics.add.staticGroup();
    this.buildFloor();
    this.buildPlatform(260, FLOOR_Y - 110, 6);
    this.buildPlatform(520, FLOOR_Y - 180, 5);
    this.buildPlatform(780, FLOOR_Y - 110, 6);
    this.buildPlatform(1080, FLOOR_Y - 200, 4);
    this.buildPlatform(1300, FLOOR_Y - 120, 6);
    this.buildPlatform(1580, FLOOR_Y - 180, 5);

    // Copa door — locked until boss defeated
    this.doorCopa = this.add.image(LEVEL_WIDTH - 60, FLOOR_Y - 30, "tex-door");
    this.doorCopa.setTint(0x555555);
    this.doorLabel = this.add.text(LEVEL_WIDTH - 60, FLOOR_Y - 72, "COPA\n[BLOQUEADO]", {
      fontFamily: "monospace", fontSize: "9px", color: "#666666", align: "center",
    }).setOrigin(0.5);

    const classDef = CLASSES[(run.characterClass ?? "analista") as ClassId];
    const weaponDef = WEAPONS[classDef.startWeapon];

    const spawnX = run.cameFrom === "copa" ? LEVEL_WIDTH - 120 : 80;
    this.player = new Player(this, spawnX, FLOOR_Y - 60);

    // Apply class base stats
    this.player.maxEnergy   = classDef.maxEnergy;
    this.player.maxSanity   = classDef.maxSanity;
    this.player.walkSpeed   = 200 * classDef.speedMult;
    this.player.damageMult  = classDef.damageMult;
    this.player.vrDropMult  = classDef.vrMult;
    this.player.weaponId    = classDef.startWeapon;
    this.player.attackRange = weaponDef.attackRange;
    this.player.specialCooldown = weaponDef.specialCooldown;
    this.player.specialType = weaponDef.specialType;
    this.player.hitAutoRanged = weaponDef.hitAutoRanged;
    this.player.comboHits = (weaponDef.type === "melee" && weaponDef.hitDamages[2] === 0) ? 2 : 3;

    if (run.cameFrom === "copa") {
      this.player.energy = run.energy;
      this.player.sanity = run.sanity;
    } else {
      this.player.energy = classDef.maxEnergy;
      this.player.sanity = classDef.maxSanity;
    }
    this.player.vr = run.vr;
    this.player.autonomia = run.autonomia ?? false;
    this.physics.add.collider(this.player, this.platforms);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.player.onDeath = (cause) => {
      const run = getRun(this);
      if ((run.extraLives ?? 0) > 0) {
        run.extraLives!--;
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

    if (run.cameFrom !== "copa") this.spawnEnemies();

    // Colliders
    [this.estagiarios, this.analistas, this.facilitadores, this.scrums,
     this.coordenadores, this.seniors, this.drops].forEach((g) =>
      this.physics.add.collider(g, this.platforms)
    );

    // Player ↔ enemy contacts
    const contactDamage = (group: Phaser.Physics.Arcade.Group, dmg: (e: Phaser.Physics.Arcade.Sprite) => number) => {
      this.physics.add.overlap(this.player, group, (_p, eObj) => {
        if (this.player.isInvulnerable(this.time.now)) return;
        this.player.takeDamage(dmg(eObj as Phaser.Physics.Arcade.Sprite), 4);
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
        this.scene.start("CopaScene");
      }
    });

    this.fx  = new SanityFx(this);
    this.hud = new Hud(this, LEVEL_WIDTH);
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
    const tileCount = Math.ceil(LEVEL_WIDTH / 32);
    for (let i = 0; i < tileCount; i++) {
      const t = this.add.image(i * 32 + 16, FLOOR_Y + 8, "tex-floor");
      t.setDisplaySize(32, 16);
      this.physics.add.existing(t, true);
      this.platforms.add(t);
    }
  }

  private buildPlatform(x: number, y: number, tiles: number) {
    for (let i = 0; i < tiles; i++) {
      const t = this.add.image(x + i * 32 + 16, y, "tex-platform");
      t.setDisplaySize(32, 14);
      this.physics.add.existing(t, true);
      this.platforms.add(t);
    }
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
    [600, 1150, 1350].forEach((x) => {
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
      const dir = targetX < this.player.x ? -1 : 1;
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(dir * -360);
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
    this.hud.hideBoss();
    this.hud.setObjective("Copa desbloqueada! Use [ E ] na porta.");

    // Drop VR shower
    for (let i = 0; i < 18; i++) {
      this.time.delayedCall(i * 60, () => {
        if (!boss.active) this.dropVR(boss.x + Phaser.Math.Between(-70, 70), boss.y - 20);
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
    const damage = Math.round(baseDmg * this.player.damageMult);
    const knockback = (step >= comboHits ? def.comboKnockback : 80) * this.player.facing;
    const slowMs = def.hitSlow;

    const slash = this.add.rectangle(hb.x + hb.width / 2, hb.y + hb.height / 2, hb.width, hb.height, 0xffffff, 0.5);
    this.tweens.add({ targets: slash, alpha: 0, duration: 140, onComplete: () => slash.destroy() });

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
        if (e.hit(damage, knockback)) {
          this.dropVR(e.x, e.y, Math.max(1, Math.round(vrDrop * this.player.vrDropMult)));
          e.destroy();
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
          this.player.takeDamage(a.swingDamage, 6);
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
          this.player.takeDamage(sr.swingDamage, 3);
          sr.swingActive = false; sr.swingHitbox = null;
        }
      }
    });

    // Boss dash contact
    if (this.boss?.active) {
      if (this.boss.swingActive && this.boss.swingHitbox) {
        if (!this.player.isInvulnerable(time) &&
            Phaser.Geom.Intersects.RectangleToRectangle(this.boss.swingHitbox, this.player.getBounds())) {
          this.player.takeDamage(this.boss.swingDamage, 5);
          this.boss.swingActive = false; this.boss.swingHitbox = null;
        }
      }
      // Boss contact walk damage
      if (!this.player.isInvulnerable(time) &&
          Phaser.Geom.Intersects.RectangleToRectangle(this.boss.getBounds(), this.player.getBounds())) {
        this.player.takeDamage(this.boss.contactDamage, 3);
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

    // Coordenador buff
    this.coordenadores.getChildren().forEach((c) => {
      const coord = c as CoordenadorDeSinergia;
      if (!coord.active || !coord.isBuffing) return;
      [this.estagiarios, this.analistas, this.scrums].forEach((g) =>
        g.getChildren().forEach((e) => {
          const enemy = e as Phaser.Physics.Arcade.Sprite & { speed?: number };
          if (!enemy.active) return;
          if (Phaser.Math.Distance.Between(coord.x, coord.y, enemy.x, enemy.y) < 160) {
            (enemy.body as Phaser.Physics.Arcade.Body).setVelocityX(
              (enemy.body as Phaser.Physics.Arcade.Body).velocity.x * 1.4,
            );
          }
        })
      );
    });

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
    });
  }
}
