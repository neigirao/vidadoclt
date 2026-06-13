import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { HUD_BOT_Y, HUD_TOP_H } from "../systems/Hud";
import { addPhaseBackground } from "../systems/Background";
import { PLAT_DEFS } from "../systems/TextureFactory";
import { Player } from "../entities/Player";
import { ScrumMasterCaotico } from "../entities/Enemies";
import {
  CaboDeRede,
  TiSuporte,
  DroneDeVigilancia,
  SegurancaCorporativa,
} from "../entities/PhaseEnemies";
import { getRun, savePersisted } from "../systems/PlayerState";
import { CLASSES, WEAPONS, WeaponId, ClassId } from "../systems/WeaponSystem";
import { SanityFx } from "../systems/SanityFx";
import { Hud } from "../systems/Hud";
import { reapplyAllPerks } from "../systems/PerkSystem";

const LEVEL_WIDTH = 1920;
const FLOOR_Y = HUD_BOT_Y - 32;

export class Phase4Scene extends Phaser.Scene {
  private platIdx = 0;
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private cabos!: Phaser.Physics.Arcade.Group;
  private tiSuportes!: Phaser.Physics.Arcade.Group;
  private drones!: Phaser.Physics.Arcade.Group;
  private segurancas!: Phaser.Physics.Arcade.Group;
  private scrums!: Phaser.Physics.Arcade.Group;
  private inkProjectiles!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private drops!: Phaser.Physics.Arcade.Group;
  private boss?: ScrumMasterCaotico;
  private bossDefeated = false;
  private startTimeMs = 0;
  private fx!: SanityFx;
  private hud!: Hud;
  private doorCopa!: Phaser.GameObjects.Image;
  private doorLabel!: Phaser.GameObjects.Text;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private levelWidth = LEVEL_WIDTH;

  constructor() {
    super("Phase4Scene");
  }

  create() {
    const run = getRun(this);
    this.platIdx = 0;
    this.startTimeMs = this.time.now;
    this.bossDefeated = false;

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.bg);

    addPhaseBackground(this, "bg-tecnologia", HUD_TOP_H, FLOOR_Y);

    this.platforms = this.physics.add.staticGroup();
    this.platIdx = 0;
    this.buildFloor();
    this.buildPlatform(180, FLOOR_Y - 30, 5);
    this.buildPlatform(450, FLOOR_Y - 72, 4);
    this.buildPlatform(750, FLOOR_Y - 30, 6);
    this.buildPlatform(1080, FLOOR_Y - 72, 5);
    this.buildPlatform(1380, FLOOR_Y - 30, 6);
    this.buildPlatform(1660, FLOOR_Y - 72, 4);

    this.doorCopa = this.add.image(LEVEL_WIDTH - 60, FLOOR_Y - 30, "tex-door");
    this.doorCopa.setTint(0x555555);
    this.doorLabel = this.add.text(LEVEL_WIDTH - 60, FLOOR_Y - 72, "COPA\n[BLOQUEADO]", {
      fontFamily: "monospace", fontSize: "9px", color: "#666666", align: "center",
    }).setOrigin(0.5);

    const classDef = CLASSES[(run.characterClass ?? "analista") as ClassId];
    const weaponDef = WEAPONS[(run.weaponId ?? classDef.startWeapon) as WeaponId] ?? WEAPONS[classDef.startWeapon];

    const spawnX = run.cameFrom === "copa" ? LEVEL_WIDTH - 120 : 80;
    this.player = new Player(this, spawnX, FLOOR_Y - 60);

    this.player.maxEnergy   = classDef.maxEnergy;
    this.player.maxSanity   = classDef.maxSanity;
    this.player.walkSpeed   = 200 * classDef.speedMult;
    this.player.damageMult  = classDef.damageMult;
    this.player.vrDropMult  = classDef.vrMult;
    this.player.weaponId    = run.weaponId ?? classDef.startWeapon;
    this.player.attackRange = weaponDef.attackRange;
    this.player.specialCooldown = weaponDef.specialCooldown;
    this.player.specialType = weaponDef.specialType;
    this.player.hitAutoRanged = weaponDef.hitAutoRanged;
    this.player.isRangedPrimary = weaponDef.type === "ranged";
    this.player.comboHits = (weaponDef.type === "melee" && weaponDef.hitDamages[2] === 0) ? 2 : 3;
    this.player.attackIntervalMs = Math.round(220 / (weaponDef.attackSpeedMult ?? 1));
    this.player.autonomia = run.autonomia ?? false;

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
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.player.onDeath = (cause) => {
      const r = getRun(this);
      if ((r.extraLives ?? 0) > 0) {
        r.extraLives!--;
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
      this.handleSpecial(type, fx, fy, facing, def);
    };

    this.cabos     = this.physics.add.group({ runChildUpdate: false });
    this.tiSuportes = this.physics.add.group({ runChildUpdate: false });
    this.drones    = this.physics.add.group({ runChildUpdate: false });
    this.segurancas = this.physics.add.group({ runChildUpdate: false });
    this.scrums    = this.physics.add.group({ runChildUpdate: false });
    this.inkProjectiles  = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group();
    this.drops           = this.physics.add.group();

    this.fx  = new SanityFx(this);
    this.hud = new Hud(this, LEVEL_WIDTH);
    this.hud.setPhaseTitle("FASE 4 — TI / SERVIDORES");
    this.hud.setObjective("Derrote o Scrum Master e avance");

    this.spawnEnemies();

    [this.cabos, this.tiSuportes, this.segurancas, this.scrums, this.drops].forEach(g =>
      this.physics.add.collider(g, this.platforms)
    );

    const contactDmg = (group: Phaser.Physics.Arcade.Group, dmg: (e: Phaser.Physics.Arcade.Sprite) => number) => {
      this.physics.add.overlap(this.player, group, (_p, eObj) => {
        if (this.player.isInvulnerable(this.time.now)) return;
        const e = eObj as Phaser.Physics.Arcade.Sprite;
        this.player.takeDamage(dmg(e), 4, e.x);
      });
    };
    contactDmg(this.cabos,      (e) => (e as CaboDeRede).contactDamage);
    contactDmg(this.tiSuportes, (e) => (e as TiSuporte).contactDamage);
    contactDmg(this.segurancas, (e) => (e as SegurancaCorporativa).contactDamage);
    contactDmg(this.scrums,     (e) => (e as ScrumMasterCaotico).contactDamage);

    this.physics.add.overlap(this.player, this.enemyProjectiles, (_p, pObj) => {
      const p = pObj as Phaser.Physics.Arcade.Sprite;
      if (!p.active || this.player.isInvulnerable(this.time.now)) return;
      const dmg = (p.getData("damage") as number) ?? 10;
      this.player.takeDamage(dmg, 3);
      p.destroy();
    });

    this.physics.add.collider(this.inkProjectiles, this.platforms, (inkObj) => {
      const ink = inkObj as Phaser.Physics.Arcade.Sprite;
      const bounces = (ink.getData("bounces") as number) ?? 0;
      if (bounces > 0) {
        ink.setData("bounces", bounces - 1);
        const ibody = ink.body as Phaser.Physics.Arcade.Body;
        ibody.setVelocityX(-ibody.velocity.x);
        ibody.setVelocityY(-Math.abs(ibody.velocity.y) * 0.5);
      } else { ink.destroy(); }
    });

    const inkDmgGroups: [Phaser.Physics.Arcade.Group, number][] = [
      [this.cabos, 2], [this.tiSuportes, 3], [this.drones, 3],
      [this.segurancas, 4], [this.scrums, 6],
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

    if (this.boss) {
      this.physics.add.overlap(this.inkProjectiles, this.boss, (inkObj) => {
        const ink = inkObj as Phaser.Physics.Arcade.Sprite;
        if (!ink.active || !this.boss?.active) return;
        const dmg = (ink.getData("damage") as number) ?? 10;
        const piercing = (ink.getData("piercing") as boolean) ?? false;
        const died = this.boss.hit(Math.round(dmg * this.player.damageMult), 0);
        if (!piercing) ink.destroy();
        if (died) this.handleBossDefeat();
      });
    }

    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      this.player.addVR(1);
      (dObj as Phaser.Physics.Arcade.Sprite).destroy();
    });

    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    const doorZone = this.add.zone(this.doorCopa.x, this.doorCopa.y, 40, 60);
    this.physics.add.existing(doorZone, true);
    this.physics.add.overlap(this.player, doorZone, () => {
      if (!this.bossDefeated) return;
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.persist();
        const r = getRun(this);
        r.cameFrom = "phase4";
        r.nextScene = "Phase5Scene";
        this.scene.start("CopaScene");
      }
    });

    const title = this.add.text(GAME_WIDTH / 2, 110, "FASE 4 — TECNOLOGIA", {
      fontFamily: "monospace", fontSize: "18px", color: "#eaeaea", align: "center",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(999);
    this.tweens.add({ targets: title, alpha: 0, duration: 800, delay: 2200, onComplete: () => title.destroy() });
  }

  private spawnEnemies() {
    [280, 700, 1200].forEach((x) => {
      const e = new CaboDeRede(this, x, FLOOR_Y - 60);
      e.target = this.player;
      e.onCable = (player) => {
        if (!this.player.isInvulnerable(this.time.now)) {
          this.player.applyFreeze(700);
          this.player.takeDamage(8, 5, e.x);
        }
      };
      this.cabos.add(e);
    });

    [450, 900, 1450].forEach((x) => {
      const e = new TiSuporte(this, x, FLOOR_Y - 60);
      e.target = this.player;
      e.onSpawnError = (ex, ey) => {
        const err = this.add.text(ex, ey - 20, "ERRO 404", {
          fontFamily: "monospace", fontSize: "11px", color: "#ff4444",
          stroke: "#000000", strokeThickness: 2,
        }).setOrigin(0.5).setDepth(400);
        this.tweens.add({ targets: err, y: err.y - 30, alpha: 0, duration: 800, onComplete: () => err.destroy() });
        if (!this.player.isInvulnerable(this.time.now) &&
          Phaser.Math.Distance.Between(this.player.x, this.player.y, ex, ey) < 60) {
          this.player.takeDamage(10, 4);
        }
      };
      this.tiSuportes.add(e);
    });

    [340, 1000, 1600].forEach((x) => {
      const drone = new DroneDeVigilancia(this, x, FLOOR_Y - 180);
      drone.target = this.player;
      drone.onBomb = (bx, by) => {
        const bomb = this.enemyProjectiles.create(bx, by, "tex-inkproj") as Phaser.Physics.Arcade.Sprite;
        const bbody = bomb.body as Phaser.Physics.Arcade.Body;
        bbody.setVelocity(0, 200);
        bomb.setData("damage", 14);
        bomb.setTint(0xffaa00);
        this.time.delayedCall(2000, () => { if (bomb.active) bomb.destroy(); });
      };
      this.drones.add(drone);
    });

    [600, 1350].forEach((x) => {
      const seg = new SegurancaCorporativa(this, x, FLOOR_Y - 60);
      seg.target = this.player;
      seg.onTase = (player) => {
        if (!this.player.isInvulnerable(this.time.now)) {
          this.player.applyFreeze(1200);
          this.player.takeDamage(6, 8, seg.x);
        }
      };
      this.segurancas.add(seg);
    });

    // Boss
    const boss = new ScrumMasterCaotico(this, 1800, FLOOR_Y - 60);
    boss.target = this.player;
    boss.hp = 120;
    boss.isBoss = true;
    boss.onShout = (bx, by) => {
      if (!this.player.isInvulnerable(this.time.now) &&
        Phaser.Math.Distance.Between(this.player.x, this.player.y, bx, by) < 160) {
        this.player.takeDamage(12, 10, bx);
        this.player.applyFreeze(600);
      }
    };
    boss.onRetrospectiva = (bx, by) => {
      const aoeW = 300;
      this.cameras.main.shake(220, 0.014);
      const shockwave = this.add.rectangle(bx, FLOOR_Y + 4, aoeW, 18, 0xaa44ff, 0.75);
      this.tweens.add({ targets: shockwave, scaleX: 1.4, alpha: 0, duration: 550, onComplete: () => shockwave.destroy() });
      if (!this.player.isInvulnerable(this.time.now) &&
        Math.abs(this.player.x - bx) < aoeW / 2 &&
        this.player.y > by - 80) {
        this.player.takeDamage(20, 9);
        this.player.applyFreeze(900);
      }
    };
    this.scrums.add(boss);
    this.boss = boss;
    this.physics.add.collider(boss, this.platforms);
    this.hud.showBoss("Scrum Master Caótico", 120);

    this.physics.add.overlap(this.inkProjectiles, boss, (inkObj) => {
      const ink = inkObj as Phaser.Physics.Arcade.Sprite;
      if (!ink.active || !this.boss?.active) return;
      const dmg = (ink.getData("damage") as number) ?? 10;
      const piercing = (ink.getData("piercing") as boolean) ?? false;
      const died = this.boss.hit(Math.round(dmg * this.player.damageMult), 0);
      if (!piercing) ink.destroy();
      if (died) this.handleBossDefeat();
    });
  }

  private handleSpecial(type: string, fx: number, fy: number, facing: 1 | -1, def: any) {
    switch (type) {
      case "burst_ranged":
        for (let i = 0; i < 2; i++) {
          this.time.delayedCall(i * 100, () => {
            this.spawnProjectile({ x: fx + facing * 20, y: fy - 5, velX: facing * (def.rangedSpeed || 500), damage: def.rangedDamage || def.hitDamages[0] });
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
        this.spawnProjectile({ x: fx + facing * 20, y: fy - 10, velX: facing * 700, damage: def.hitDamages[1] * 2 });
        break;
      case "emp_pulse": {
        [this.cabos, this.tiSuportes, this.drones, this.segurancas, this.scrums].forEach(g =>
          g?.getChildren().forEach(s => { const e = s as any; if (e.applyFreeze) e.applyFreeze(900); })
        );
        (this.boss as any)?.applyFreeze?.(900);
        const ring = this.add.circle(this.player.x, this.player.y, 8, 0x88aaff, 0.6);
        this.tweens.add({ targets: ring, scaleX: 15, scaleY: 15, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
        break;
      }
      case "paper_spread": {
        const angles = [-0.25, 0, 0.25];
        angles.forEach(a => {
          const spd = def.rangedSpeed || 500;
          this.spawnProjectile({ x: fx + facing * 20, y: fy - 5, velX: facing * spd * Math.cos(a), velY: spd * Math.sin(a), damage: def.rangedDamage || def.hitDamages[0], piercing: def.rangedPiercing });
        });
        break;
      }
      case "caneca_arc":
        this.spawnProjectile({ x: fx + facing * 20, y: fy - 20, velX: facing * 400, velY: -350, damage: def.hitDamages[2], arc: true });
        break;
      case "wide_beam": {
        const beamRect = new Phaser.Geom.Rectangle(facing > 0 ? fx : 0, fy - 25, facing > 0 ? this.levelWidth - fx : fx, 30);
        this.resolveAttack(beamRect, 3);
        const lineW = facing > 0 ? (this.levelWidth - fx) : fx;
        const line = this.add.rectangle(facing > 0 ? fx + lineW / 2 : fx / 2, fy - 10, lineW, 6, 0x88aaff, 0.8);
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
        [this.cabos, this.tiSuportes, this.drones, this.segurancas, this.scrums].forEach(g => {
          g?.getChildren().forEach(e => allEnemies.push(e as Phaser.Physics.Arcade.Sprite));
        });
        allEnemies.filter(e => e.active).sort((a, b) =>
          Phaser.Math.Distance.Between(fx, fy, a.x, a.y) - Phaser.Math.Distance.Between(fx, fy, b.x, b.y)
        ).slice(0, 3).forEach((enemy, i) => {
          this.time.delayedCall(i * 80, () => {
            const e = enemy as any;
            if (e.hit) e.hit(def.hitDamages[2], 150);
            const flash = this.add.rectangle(enemy.x, enemy.y, 6, 40, 0xffff44, 0.9);
            this.time.delayedCall(150, () => flash.destroy());
          });
        });
        break;
      }
    }
  }

  private handleBossDefeat() {
    this.bossDefeated = true;
    this.hud.hideBoss();
    this.hud.setObjective("Copa desbloqueada! Use [ E ] na porta.");

    if (this.boss?.active) {
      for (let i = 0; i < 12; i++) {
        this.time.delayedCall(i * 60, () => {
          if (this.boss) this.dropVR(this.boss.x + Phaser.Math.Between(-60, 60), this.boss.y - 20);
        });
      }
      this.boss.destroy();
    }

    savePersisted(getRun(this).reconhecimento, getRun(this).fgts, getRun(this).loopCount);
    this.doorCopa.clearTint();
    this.doorLabel.setText("COPA").setColor("#c9a36a");

    const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30,
      "SCRUM MASTER DERROTADO!\n\nPorta da Copa desbloqueada ->",
      { fontFamily: "monospace", fontSize: "15px", color: "#f2c14e", stroke: "#000000", strokeThickness: 3, align: "center" })
      .setOrigin(0.5).setScrollFactor(0).setDepth(999);
    this.tweens.add({ targets: msg, alpha: 0, duration: 900, delay: 3500, onComplete: () => msg.destroy() });
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

  private buildPlatform(x: number, y: number, tiles: number) {
    const platDefs = PLAT_DEFS;
    const def = platDefs[this.platIdx % platDefs.length];
    this.platIdx++;
    const w = tiles * 32;

    // Draw surface tiles
    for (let i = 0; i < tiles; i++) {
      this.add.image(x + i * 32 + 16, y, def.surf).setDisplaySize(32, 14).setDepth(9);
    }

    // Body extends to floor so nothing floats
    const bodyTop = y + 7;
    const bodyH = FLOOR_Y - bodyTop;
    const bodyMidY = bodyTop + bodyH / 2;
    for (let i = 0; i < tiles; i++) {
      this.add.image(x + i * 32 + 16, bodyMidY, def.body)
        .setDisplaySize(32, bodyH).setDepth(7);
    }

    // Physics body (invisible rectangle at surface level)
    const plat = this.add.rectangle(x + w / 2, y, w, 14, 0x000000, 0);
    this.physics.add.existing(plat, true);
    this.platforms.add(plat);
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

    const hitGroup = (group: Phaser.Physics.Arcade.Group, vrDrop: number, cast: (c: Phaser.GameObjects.GameObject) => Phaser.Physics.Arcade.Sprite & { hit: (d: number, k: number) => boolean; applySlowdown?: (ms: number) => void }) => {
      group.getChildren().forEach((c) => {
        const e = cast(c);
        if (!e.active || !tryHit(e)) return;
        if (slowMs > 0 && e.applySlowdown) e.applySlowdown(slowMs);
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

    hitGroup(this.cabos,      2, (c) => c as CaboDeRede);
    hitGroup(this.tiSuportes, 3, (c) => c as TiSuporte);
    hitGroup(this.drones,     3, (c) => c as DroneDeVigilancia);
    hitGroup(this.segurancas, 4, (c) => c as SegurancaCorporativa);
    hitGroup(this.scrums,     6, (c) => c as ScrumMasterCaotico);

    if (this.boss && this.boss.active && tryHit(this.boss)) {
      const died = this.boss.hit(damage, knockback);
      if (died) this.handleBossDefeat();
    }
  }

  private spawnProjectile(opts: {
    x: number; y: number; velX: number; velY?: number;
    damage: number; piercing?: boolean; bounces?: number; homing?: boolean; arc?: boolean;
  }) {
    const ink = this.inkProjectiles.create(opts.x, opts.y, "tex-inkproj") as Phaser.Physics.Arcade.Sprite;
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

    // NOTE: preUpdate is called automatically by Phaser for scene children — no manual calls needed

    this.inkProjectiles.getChildren().forEach(obj => {
      const ink = obj as Phaser.Physics.Arcade.Sprite;
      if (!ink.active) return;
      const lifetime = ink.getData("lifetime") as number;
      if (lifetime && lifetime < time) { ink.destroy(); return; }
      if (!ink.getData("homing")) return;
      const allEnemies: Phaser.Physics.Arcade.Sprite[] = [];
      [this.cabos, this.tiSuportes, this.drones, this.segurancas, this.scrums].forEach(g => {
        g?.getChildren().forEach(e => allEnemies.push(e as Phaser.Physics.Arcade.Sprite));
      });
      const nearest = allEnemies.filter(e => e.active).sort((a, b) =>
        Phaser.Math.Distance.Between(ink.x, ink.y, a.x, a.y) - Phaser.Math.Distance.Between(ink.x, ink.y, b.x, b.y)
      )[0];
      if (nearest) {
        const ibody = ink.body as Phaser.Physics.Arcade.Body;
        const angle = Phaser.Math.Angle.Between(ink.x, ink.y, nearest.x, nearest.y);
        ibody.setVelocity(Math.cos(angle) * 480, Math.sin(angle) * 480);
      }
    });

    if (this.boss?.active) {
      if (!this.player.isInvulnerable(time) &&
        Phaser.Geom.Intersects.RectangleToRectangle(this.boss.getBounds(), this.player.getBounds())) {
        this.player.takeDamage(this.boss.contactDamage, 3, this.boss.x);
      }
    }

    this.fx.update(time, this.player.sanity);

    if (this.boss?.active) this.hud.updateBoss(this.boss.hp);

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
