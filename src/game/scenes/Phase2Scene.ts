import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { HUD_BOT_Y, HUD_TOP_H } from "../systems/Hud";
import { addPhaseBackground } from "../systems/Background";
import { PLAT_DEFS } from "../systems/TextureFactory";
import { Player } from "../entities/Player";
import { CoordenadorDeSinergia } from "../entities/Enemies";
import {
  TelemarketerZumbi,
  ImpressoraAssombrada,
  GuardiaoDoCafe,
  NuvemBoardSentinela,
} from "../entities/PhaseEnemies";
import { getRun, savePersisted } from "../systems/PlayerState";
import { CLASSES, WEAPONS, WeaponId, ClassId } from "../systems/WeaponSystem";
import { SanityFx } from "../systems/SanityFx";
import { Hud } from "../systems/Hud";
import { reapplyAllPerks } from "../systems/PerkSystem";

const LEVEL_WIDTH = 1920;
const FLOOR_Y = HUD_BOT_Y - 32;

export class Phase2Scene extends Phaser.Scene {
  private platIdx = 0;
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private telemarketers!: Phaser.Physics.Arcade.Group;
  private impressoras!: Phaser.Physics.Arcade.Group;
  private guardioes!: Phaser.Physics.Arcade.Group;
  private nuvens!: Phaser.Physics.Arcade.Group;
  private coordenadores!: Phaser.Physics.Arcade.Group;
  private inkProjectiles!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private drops!: Phaser.Physics.Arcade.Group;
  private furnitureBodies!: Phaser.Physics.Arcade.StaticGroup;
  private boss?: CoordenadorDeSinergia;
  private bossDefeated = false;
  private startTimeMs = 0;
  private fx!: SanityFx;
  private hud!: Hud;
  private doorCopa!: Phaser.GameObjects.Image;
  private doorLabel!: Phaser.GameObjects.Text;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private levelWidth = LEVEL_WIDTH;

  constructor() {
    super("Phase2Scene");
  }

  preload() {
    this.load.image("bg-atendimento", "/assets/bg-atendimento.png");
  }

  create() {
    const run = getRun(this);
    this.platIdx = 0;
    this.startTimeMs = this.time.now;
    this.bossDefeated = false;

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.bg);

    addPhaseBackground(this, "bg-atendimento", HUD_TOP_H, FLOOR_Y);

    this.platforms = this.physics.add.staticGroup();
    this.furnitureBodies = this.physics.add.staticGroup();
    this.platIdx = 0;
    this.buildFloor();
    this.buildPlatform(200, FLOOR_Y - 30, 5);
    this.buildPlatform(460, FLOOR_Y - 72, 4);
    this.buildPlatform(700, FLOOR_Y - 30, 5);
    this.buildPlatform(1000, FLOOR_Y - 72, 6);
    this.buildPlatform(1350, FLOOR_Y - 30, 5);
    this.buildPlatform(1620, FLOOR_Y - 72, 4);

    // Copa door — locked until boss defeated
    this.doorCopa = this.add.image(LEVEL_WIDTH - 60, FLOOR_Y - 30, "tex-door");
    this.doorCopa.setTint(0x555555);
    this.doorLabel = this.add.text(LEVEL_WIDTH - 60, FLOOR_Y - 72, "COPA\n[BLOQUEADO]", {
      fontFamily: "monospace", fontSize: "9px", color: "#666666", align: "center",
    }).setOrigin(0.5);

    const classDef = CLASSES[(run.characterClass ?? "analista") as ClassId];
    const weaponId = (run.weaponId ?? classDef.startWeapon) as WeaponId;
    const weaponDef = WEAPONS[weaponId] ?? WEAPONS[classDef.startWeapon];

    const spawnX = run.cameFrom === "copa" ? LEVEL_WIDTH - 120 : 80;
    this.player = new Player(this, spawnX, FLOOR_Y - 60);

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
          this.player.body && ((this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(-300));
          break;
        }
        case "throw_weapon":
          this.spawnProjectile({ x: fx + facing * 20, y: fy - 10, velX: facing * 700, damage: def.hitDamages[1] * 2 });
          break;
        case "emp_pulse": {
          const stun = (sprite: Phaser.GameObjects.GameObject) => {
            const s = sprite as any;
            if (s.applyFreeze) s.applyFreeze(900);
          };
          [this.telemarketers, this.impressoras, this.guardioes, this.nuvens, this.coordenadores].forEach(g => g?.getChildren().forEach(stun));
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
          const beamY = fy - 10;
          const beamRect = new Phaser.Geom.Rectangle(facing > 0 ? fx : 0, beamY - 15, facing > 0 ? this.levelWidth - fx : fx, 30);
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
          [this.telemarketers, this.impressoras, this.guardioes, this.nuvens, this.coordenadores].forEach(g => {
            g?.getChildren().forEach(e => allEnemies.push(e as Phaser.Physics.Arcade.Sprite));
          });
          const sorted = allEnemies.filter(e => e.active).sort((a, b) =>
            Phaser.Math.Distance.Between(fx, fy, a.x, a.y) - Phaser.Math.Distance.Between(fx, fy, b.x, b.y)
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
      }
    };

    // Enemy groups
    this.telemarketers   = this.physics.add.group({ runChildUpdate: false });
    this.impressoras     = this.physics.add.group({ runChildUpdate: false });
    this.guardioes       = this.physics.add.group({ runChildUpdate: false });
    this.nuvens          = this.physics.add.group({ runChildUpdate: false });
    this.coordenadores   = this.physics.add.group({ runChildUpdate: false });
    this.inkProjectiles  = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group();
    this.drops           = this.physics.add.group();

    this.spawnEnemies();

    [this.telemarketers, this.impressoras, this.guardioes, this.coordenadores, this.drops].forEach(g =>
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
    contactDamage(this.telemarketers,  (e) => (e as TelemarketerZumbi).contactDamage);
    contactDamage(this.impressoras,    (e) => (e as ImpressoraAssombrada).contactDamage);
    contactDamage(this.guardioes,      (e) => (e as GuardiaoDoCafe).contactDamage);
    contactDamage(this.coordenadores,  (e) => (e as CoordenadorDeSinergia).contactDamage);

    // Enemy projectiles hit player
    this.physics.add.overlap(this.player, this.enemyProjectiles, (_p, pObj) => {
      const p = pObj as Phaser.Physics.Arcade.Sprite;
      if (!p.active || this.player.isInvulnerable(this.time.now)) return;
      const dmg = (p.getData("damage") as number) ?? 10;
      this.player.takeDamage(dmg, 3);
      p.destroy();
    });

    // Ink projectile hits platforms
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
      [this.telemarketers, 2], [this.impressoras, 8], [this.guardioes, 4],
      [this.nuvens, 3], [this.coordenadores, 4],
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

    // Ink vs boss
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
        r.cameFrom = "phase2";
        r.nextScene = "Phase3Scene";
        this.scene.start("CopaScene");
      }
    });

    this.fx  = new SanityFx(this);
    this.hud = new Hud(this, LEVEL_WIDTH);
    this.hud.setPhaseTitle("FASE 2 — REUNIAO INFINITA");
    this.hud.setObjective("Derrote o Coordenador e avance");

    const title = this.add
      .text(GAME_WIDTH / 2, 110, "FASE 2 — ATENDIMENTO", {
        fontFamily: "monospace", fontSize: "18px", color: "#eaeaea", align: "center",
        stroke: "#000000", strokeThickness: 3,
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(999);
    this.tweens.add({ targets: title, alpha: 0, duration: 800, delay: 2200, onComplete: () => title.destroy() });
  }

  private spawnEnemies() {
    [300, 550, 800, 1100, 1400].forEach((x) => {
      const e = new TelemarketerZumbi(this, x, FLOOR_Y - 60);
      e.target = this.player;
      e.onFire = (fx, fy, tx, ty) => this.spawnEnemyProjectile(fx, fy, tx, ty, 10);
      this.telemarketers.add(e);
    });

    [600, 1200].forEach((x) => {
      const e = new ImpressoraAssombrada(this, x, FLOOR_Y - 60);
      e.onFire = (fx, fy, dir) => {
        // 3 spread projectiles
        const angle = dir === 0 ? 0 : (dir < 0 ? -0.3 : 0.3);
        const tx = fx + Math.cos(angle) * 200;
        const ty = fy + Math.sin(angle) * 200;
        this.spawnEnemyProjectile(fx, fy, tx, ty, 8);
      };
      this.impressoras.add(e);
    });

    const guardiao = new GuardiaoDoCafe(this, 900, FLOOR_Y - 60);
    guardiao.target = this.player;
    this.guardioes.add(guardiao);

    [400, 1500].forEach((x) => {
      const e = new NuvemBoardSentinela(this, x, FLOOR_Y - 200);
      e.onFire = (fx, fy) => this.spawnEnemyProjectile(fx, fy, fx, fy + 300, 12, 0, 200);
      this.nuvens.add(e);
    });

    // Mini-boss
    const boss = new CoordenadorDeSinergia(this, 1800, FLOOR_Y - 60);
    boss.target = this.player;
    boss.hp = 80;
    this.coordenadores.add(boss);
    this.boss = boss;
    this.physics.add.collider(boss, this.platforms);
    this.hud.showBoss("Coordenador de Sinergia", boss.hp);

    // Re-register ink vs boss now it's set
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

  private spawnEnemyProjectile(fx: number, fy: number, tx: number, ty: number, damage: number, extraVelX = 0, extraVelY = 0) {
    const proj = this.enemyProjectiles.create(fx, fy, "tex-inkproj") as Phaser.Physics.Arcade.Sprite;
    const body = proj.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    const angle = Phaser.Math.Angle.Between(fx, fy, tx, ty);
    body.setVelocity(Math.cos(angle) * 180 + extraVelX, Math.sin(angle) * 180 + extraVelY);
    proj.setData("damage", damage);
    proj.setTint(0xff4444);
    this.time.delayedCall(3000, () => { if (proj.active) proj.destroy(); });
    return proj;
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
      "COORDENADOR DERROTADO!\n\nPorta da Copa desbloqueada ->",
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
    const heightFromFloor = FLOOR_Y - y;
    const matching = platDefs.filter(d => Math.abs(d.height - heightFromFloor) <= 5);
    const pool = matching.length > 0 ? matching : platDefs;
    const def = pool[this.platIdx % pool.length];
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
    // Furniture body blocks the player from walking through the column
    const bodyPlat = this.add.rectangle(x + w / 2, bodyMidY, w, bodyH, 0x000000, 0);
    this.physics.add.existing(bodyPlat, true);
    this.furnitureBodies.add(bodyPlat);
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
          e.destroy();
        }
      });
    };

    hitGroup(this.telemarketers,  2,  (c) => c as TelemarketerZumbi);
    hitGroup(this.impressoras,    8,  (c) => c as ImpressoraAssombrada);
    hitGroup(this.guardioes,      4,  (c) => c as GuardiaoDoCafe);
    hitGroup(this.nuvens,         3,  (c) => c as NuvemBoardSentinela);
    hitGroup(this.coordenadores,  4,  (c) => c as CoordenadorDeSinergia);

    if (this.boss && this.boss.active && tryHit(this.boss)) {
      const died = this.boss.hit(damage, knockback);
      if (died) this.handleBossDefeat();
    }
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

    // Set targets each frame
    [this.telemarketers, this.guardioes].forEach(g => {
      g.getChildren().forEach(c => {
        const e = c as any;
        if (e.target !== undefined) e.target = this.player;
      });
    });
    // NOTE: preUpdate is called automatically by Phaser for scene children — no manual calls needed

    // Expire ink projectiles
    this.inkProjectiles.getChildren().forEach(obj => {
      const ink = obj as Phaser.Physics.Arcade.Sprite;
      if (!ink.active) return;
      const lifetime = ink.getData("lifetime") as number;
      if (lifetime && lifetime < time) { ink.destroy(); return; }
      if (!ink.getData("homing")) return;
      const allEnemies: Phaser.Physics.Arcade.Sprite[] = [];
      [this.telemarketers, this.impressoras, this.guardioes, this.nuvens, this.coordenadores].forEach(g => {
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

    // Boss contact
    if (this.boss?.active) {
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
