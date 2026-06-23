import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { HUD_BOT_Y, HUD_TOP_H } from "../systems/Hud";
import { addPhaseBackground } from "../systems/Background";
import { PLAT_DEFS } from "../systems/TextureFactory";
import { Player } from "../entities/Player";
import { EstagiarioDesesperado } from "../entities/Enemies";
import { CeoBoss } from "../entities/CeoBoss";
import { getRun, savePersisted } from "../systems/PlayerState";
import { CLASSES, WEAPONS, WeaponId, ClassId } from "../systems/WeaponSystem";
import { SanityFx } from "../systems/SanityFx";
import { Hud } from "../systems/Hud";
import { resolveSprite } from "../systems/SpriteLibrary";
import { reapplyAllPerks } from "../systems/PerkSystem";

const LEVEL_WIDTH = 960; // single screen fight
const FLOOR_Y = HUD_BOT_Y - 32;

export class CeoScene extends Phaser.Scene {
  private platIdx = 0;
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private boss!: CeoBoss;
  private minions!: Phaser.Physics.Arcade.Group;
  private inkProjectiles!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private drops!: Phaser.Physics.Arcade.Group;
  private startTimeMs = 0;
  private fx!: SanityFx;
  private hud!: Hud;
  private levelWidth = LEVEL_WIDTH;

  constructor() {
    super("CeoScene");
  }

  preload() {
    this.load.image("bg-cobertura", "/assets/bg-cobertura.png");
  }

  create() {
    const run = getRun(this);
    this.platIdx = 0;
    this.startTimeMs = this.time.now;

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.bg);

    addPhaseBackground(this, "bg-cobertura", HUD_TOP_H, FLOOR_Y);

    // Add dramatic dark overlay
    this.add.rectangle(LEVEL_WIDTH / 2, GAME_HEIGHT / 2, LEVEL_WIDTH, GAME_HEIGHT, 0x000000, 0.3).setDepth(-1);

    this.platforms = this.physics.add.staticGroup();
    this.platIdx = 0;
    this.buildFloor();
    // Two side platforms for mobility
    this.buildPlatform(100, FLOOR_Y - 30, 4);
    this.buildPlatform(LEVEL_WIDTH - 228, FLOOR_Y - 30, 4);
    // Center elevated platform
    this.buildPlatform(LEVEL_WIDTH / 2 - 80, FLOOR_Y - 72, 5);

    const classDef = CLASSES[(run.characterClass ?? "analista") as ClassId];
    const weaponDef = WEAPONS[(run.weaponId ?? classDef.startWeapon) as WeaponId] ?? WEAPONS[classDef.startWeapon];

    this.player = new Player(this, 80, FLOOR_Y - 60);
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
    this.player.energy = run.energy;
    this.player.sanity = run.sanity;
    this.player.vr     = run.vr;
    reapplyAllPerks(this.player, run);

    this.physics.add.collider(this.player, this.platforms);
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
      this.handleSpecial(type, fx, fy, facing, def);
    };

    this.minions = this.physics.add.group({ runChildUpdate: false });
    this.inkProjectiles  = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group();
    this.drops           = this.physics.add.group();

    this.physics.add.collider(this.minions, this.platforms);
    this.physics.add.collider(this.drops, this.platforms);

    // Boss
    this.boss = new CeoBoss(this, LEVEL_WIDTH - 120, FLOOR_Y - 60);
    this.boss.target = this.player;
    this.physics.add.collider(this.boss, this.platforms);

    this.boss.onHpChange = (hp, _maxHp) => {
      this.hud.updateBoss(hp);
    };

    this.boss.onSummon = (sx, sy) => {
      for (let i = 0; i < 2; i++) {
        const dir: 1 | -1 = i === 0 ? -1 : 1;
        const m = new EstagiarioDesesperado(this, sx + (i === 0 ? -40 : 40), FLOOR_Y - 60, dir);
        this.minions.add(m);
        this.physics.add.collider(m, this.platforms);
      }
    };

    this.boss.onGoldenParachute = (px, py) => {
      for (let i = 0; i < 3; i++) {
        const [convTex, convFrame] = resolveSprite("tex-convite");
        const proj = this.enemyProjectiles.create(px + (i - 1) * 60, py, convTex, convFrame) as Phaser.Physics.Arcade.Sprite;
        const pbody = proj.body as Phaser.Physics.Arcade.Body;
        pbody.setAllowGravity(false);
        pbody.setVelocity((i - 1) * 80, 150);
        proj.setData("damage", 16);
        proj.setTint(0xffdd00);
        this.time.delayedCall(3000, () => { if (proj.active) proj.destroy(); });
      }
    };

    this.boss.onDemissao = () => {
      // Screen flash + all minions get +20 HP
      const flash = this.add.rectangle(LEVEL_WIDTH / 2, GAME_HEIGHT / 2, LEVEL_WIDTH, GAME_HEIGHT, 0xff4400, 0.4).setScrollFactor(0).setDepth(900);
      this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
      const warning = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "DEMISSÃO EM MASSA!", {
        fontFamily: "monospace", fontSize: "20px", fontStyle: "bold",
        color: "#ff4400", stroke: "#000000", strokeThickness: 4,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(950);
      this.tweens.add({ targets: warning, scaleX: 1.3, scaleY: 1.3, alpha: 0, duration: 1500, onComplete: () => warning.destroy() });

      // Summon a wave
      for (let i = 0; i < 3; i++) {
        const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
        const m = new EstagiarioDesesperado(this, 100 + i * 250, FLOOR_Y - 60, dir);
        this.minions.add(m);
        this.physics.add.collider(m, this.platforms);
      }
    };

    this.boss.onSpread = (px, py, pFacing) => {
      for (let i = -2; i <= 2; i++) {
        const angle = (i * 0.3);
        const proj = this.enemyProjectiles.create(px, py, "tex-inkproj") as Phaser.Physics.Arcade.Sprite;
        const pbody = proj.body as Phaser.Physics.Arcade.Body;
        pbody.setAllowGravity(false);
        pbody.setVelocity(pFacing * Math.cos(angle) * 320, Math.sin(angle) * 320);
        proj.setData("damage", 14);
        proj.setTint(0xffaa00);
        this.time.delayedCall(2500, () => { if (proj.active) proj.destroy(); });
      }
    };

    this.boss.onDeath = () => this.handleBossDefeat();

    // Overlaps
    this.physics.add.overlap(this.player, this.enemyProjectiles, (_p, pObj) => {
      const p = pObj as Phaser.Physics.Arcade.Sprite;
      if (!p.active || this.player.isInvulnerable(this.time.now)) return;
      this.player.takeDamage((p.getData("damage") as number) ?? 10, 5);
      p.destroy();
    });

    this.physics.add.overlap(this.player, this.minions, (_p, mObj) => {
      const m = mObj as Phaser.Physics.Arcade.Sprite;
      if (!m.active || this.player.isInvulnerable(this.time.now)) return;
      this.player.takeDamage(6, 3, m.x);
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

    this.physics.add.overlap(this.inkProjectiles, this.boss, (inkObj) => {
      const ink = inkObj as Phaser.Physics.Arcade.Sprite;
      if (!ink.active || !this.boss.active) return;
      const dmg = (ink.getData("damage") as number) ?? 10;
      const piercing = (ink.getData("piercing") as boolean) ?? false;
      this.boss.hit(Math.round(dmg * this.player.damageMult), 0);
      if (!piercing) ink.destroy();
    });

    this.physics.add.overlap(this.inkProjectiles, this.minions, (inkObj, mObj) => {
      const ink = inkObj as Phaser.Physics.Arcade.Sprite;
      if (!ink.active) return;
      const m = mObj as Phaser.Physics.Arcade.Sprite & { hit?: (d: number, k: number) => boolean };
      if (!m.active || !m.hit) return;
      const dmg = (ink.getData("damage") as number) ?? 10;
      const piercing = (ink.getData("piercing") as boolean) ?? false;
      const died = m.hit(Math.round(dmg * this.player.damageMult), 0);
      if (!piercing) ink.destroy();
      if (died) {
        this.dropVR(m.x, m.y, Math.max(1, Math.round(2 * this.player.vrDropMult)));
        m.destroy();
      }
    });

    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      this.player.addVR(1);
      (dObj as Phaser.Physics.Arcade.Sprite).destroy();
    });

    this.fx  = new SanityFx(this);
    this.hud = new Hud(this, LEVEL_WIDTH);
    this.hud.setPhaseTitle("CEO — CONFRONTO FINAL");
    this.hud.setObjective("Derrote o CEO Milton Freitas da Cunha IV");
    this.hud.showBoss("CEO — Milton Freitas da Cunha IV", this.boss.maxHp);

    // Intro cutscene text
    const intro = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60,
      "\"Boa tarde. Precisamos conversar\nsobre performance.\"",
      {
        fontFamily: "monospace", fontSize: "15px", color: "#ffeecc",
        stroke: "#000000", strokeThickness: 3, align: "center",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(999);
    this.tweens.add({ targets: intro, alpha: 0, duration: 900, delay: 2500, onComplete: () => intro.destroy() });

    const title = this.add.text(GAME_WIDTH / 2, 110, "SALA DA COBERTURA — CONFRONTO FINAL", {
      fontFamily: "monospace", fontSize: "14px", color: "#eaeaea",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(999);
    this.tweens.add({ targets: title, alpha: 0, duration: 800, delay: 2000, onComplete: () => title.destroy() });
  }

  private handleBossDefeat() {
    this.hud.hideBoss();

    const r = getRun(this);
    r.reconhecimento += Math.floor(this.player.vr * 0.5) + 200;
    r.loopCount = (r.loopCount ?? 0) + 1;
    savePersisted(r.reconhecimento, r.fgts, r.loopCount);

    // Explosion VR shower
    for (let i = 0; i < 30; i++) {
      this.time.delayedCall(i * 50, () => {
        this.dropVR(
          LEVEL_WIDTH / 2 + Phaser.Math.Between(-200, 200),
          FLOOR_Y - Phaser.Math.Between(40, 160),
          1
        );
      });
    }

    const victory = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50,
      "VOCÊ CONSEGUIU!\n\nO CEO Milton foi derrotado.",
      {
        fontFamily: "monospace", fontSize: "18px", color: "#f2c14e",
        stroke: "#000000", strokeThickness: 4, align: "center",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

    this.time.delayedCall(3500, () => {
      this.persist();
      this.scene.start("VitoriaScene", {
        vr: this.player.vr,
        reconhecimento: r.reconhecimento,
        loopCount: r.loopCount,
      });
    });
  }

  private persist() {
    const r = getRun(this);
    r.energy = this.player.energy;
    r.sanity = this.player.sanity;
    r.vr     = this.player.vr;
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
    let strikeMult = 1.0;
    if (this.player.firstStrikeReady) {
      this.player.firstStrikeReady = false;
      strikeMult = 1.5;
      this.cameras.main.flash(180, 255, 215, 0, false);
    }
    const damage = Math.round((def.hitDamages[dmgIndex] || def.hitDamages[0]) * this.player.damageMult * strikeMult);
    const knockback = (step >= comboHits ? def.comboKnockback : 80) * this.player.facing;

    const slash = this.add.rectangle(hb.x + hb.width / 2, hb.y + hb.height / 2, hb.width, hb.height, 0xffffff, 0.5);
    this.tweens.add({ targets: slash, alpha: 0, duration: 140, onComplete: () => slash.destroy() });
    if (step >= comboHits) this.cameras.main.shake(80, 0.006);

    const tryHit = (s: Phaser.Physics.Arcade.Sprite) =>
      Phaser.Geom.Intersects.RectangleToRectangle(hb, s.getBounds());

    // Boss hit
    if (this.boss.active && tryHit(this.boss)) {
      this.boss.hit(damage, knockback);
    }

    // Minion hits
    this.minions.getChildren().forEach((c) => {
      const m = c as Phaser.Physics.Arcade.Sprite & { hit?: (d: number, k: number) => boolean };
      if (!m.active || !m.hit || !tryHit(m)) return;
      if (m.hit(damage, knockback)) {
        this.dropVR(m.x, m.y, Math.max(1, Math.round(2 * this.player.vrDropMult)));
        m.destroy();
      }
    });
  }

  private handleSpecial(type: string, fx: number, fy: number, facing: 1 | -1, def: any) {
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
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(-300);
        break;
      case "throw_weapon":
        this.spawnProjectile({ x: fx + facing * 20, y: fy - 10, velX: facing * 700, damage: def.hitDamages[1] * 2 });
        break;
      case "emp_pulse": {
        this.boss.applyFreeze(900);
        this.minions.getChildren().forEach(m => { const e = m as any; if (e.applyFreeze) e.applyFreeze(900); });
        const ring = this.add.circle(this.player.x, this.player.y, 8, 0x88aaff, 0.6);
        this.tweens.add({ targets: ring, scaleX: 15, scaleY: 15, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
        break;
      }
      case "paper_spread":
        [-0.25, 0, 0.25].forEach(a => {
          const spd = def.rangedSpeed || 500;
          this.spawnProjectile({ x: fx + facing * 20, y: fy - 5, velX: facing * spd * Math.cos(a), velY: spd * Math.sin(a), damage: def.rangedDamage || def.hitDamages[0], piercing: def.rangedPiercing });
        });
        break;
      case "caneca_arc":
        this.spawnProjectile({ x: fx + facing * 20, y: fy - 20, velX: facing * 400, velY: -350, damage: def.hitDamages[2], arc: true });
        break;
      case "wide_beam": {
        const lineW = facing > 0 ? (this.levelWidth - fx) : fx;
        this.resolveAttack(new Phaser.Geom.Rectangle(facing > 0 ? fx : 0, fy - 25, facing > 0 ? this.levelWidth - fx : fx, 30), 3);
        const line = this.add.rectangle(facing > 0 ? fx + lineW / 2 : fx / 2, fy - 10, lineW, 6, 0x88aaff, 0.8);
        this.tweens.add({ targets: line, alpha: 0, duration: 300, onComplete: () => line.destroy() });
        break;
      }
      case "spray_knockback": {
        this.resolveAttack(new Phaser.Geom.Rectangle(facing > 0 ? fx : fx - 120, fy - 30, 120, 60), 3);
        const cloud = this.add.circle(fx + facing * 60, fy, 12, 0xffffff, 0.5);
        this.tweens.add({ targets: cloud, scaleX: 5, scaleY: 4, alpha: 0, duration: 500, onComplete: () => cloud.destroy() });
        break;
      }
      case "chain_lightning": {
        const allTargets: any[] = [this.boss, ...this.minions.getChildren()];
        allTargets.filter(e => e.active).sort((a, b) =>
          Phaser.Math.Distance.Between(fx, fy, a.x, a.y) - Phaser.Math.Distance.Between(fx, fy, b.x, b.y)
        ).slice(0, 3).forEach((enemy, i) => {
          this.time.delayedCall(i * 80, () => {
            (enemy as any).hit?.(def.hitDamages[2], 150);
            const flash = this.add.rectangle(enemy.x, enemy.y, 6, 40, 0xffff44, 0.9);
            this.time.delayedCall(150, () => flash.destroy());
          });
        });
        break;
      }
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

    // NOTE: preUpdate is called automatically by Phaser for scene children — no manual calls needed

    // Boss melee check
    if (this.boss.active && this.boss.swingActive && this.boss.swingHitbox) {
      if (!this.player.isInvulnerable(time) &&
        Phaser.Geom.Intersects.RectangleToRectangle(this.boss.swingHitbox, this.player.getBounds())) {
        this.player.takeDamage(this.boss.swingDamage, 8, this.boss.x);
        this.boss.swingActive = false;
        this.boss.swingHitbox = null;
      }
    }

    // Boss contact damage
    if (this.boss.active && !this.player.isInvulnerable(time) &&
      Phaser.Geom.Intersects.RectangleToRectangle(this.boss.getBounds(), this.player.getBounds())) {
      this.player.takeDamage(this.boss.contactDamage, 5, this.boss.x);
    }

    // Ink projectile homing + lifetime
    this.inkProjectiles.getChildren().forEach(obj => {
      const ink = obj as Phaser.Physics.Arcade.Sprite;
      if (!ink.active) return;
      const lifetime = ink.getData("lifetime") as number;
      if (lifetime && lifetime < time) { ink.destroy(); return; }
      if (!ink.getData("homing") || !this.boss.active) return;
      const ibody = ink.body as Phaser.Physics.Arcade.Body;
      const angle = Phaser.Math.Angle.Between(ink.x, ink.y, this.boss.x, this.boss.y);
      ibody.setVelocity(Math.cos(angle) * 480, Math.sin(angle) * 480);
    });

    this.fx.update(time, this.player.sanity);

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
      dashCooldown: this.player.getDashCooldownRatio(time),
    });
  }
}
