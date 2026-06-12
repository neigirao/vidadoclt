import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { HUD_BOT_Y } from "../systems/Hud";
import { Player } from "../entities/Player";
import { AnalistaSeniorExausto } from "../entities/Enemies";
import {
  EvangelistaCorporativo,
  ColetorDeDados,
  PlanilhaViva,
} from "../entities/PhaseEnemies";
import { getRun, savePersisted } from "../systems/PlayerState";
import { CLASSES, WEAPONS, WeaponId, ClassId } from "../systems/WeaponSystem";
import { SanityFx } from "../systems/SanityFx";
import { Hud } from "../systems/Hud";

const LEVEL_WIDTH = 1920;
const FLOOR_Y = HUD_BOT_Y - 32;

export class Phase3Scene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private evangelistas!: Phaser.Physics.Arcade.Group;
  private coletores!: Phaser.Physics.Arcade.Group;
  private planilhas!: Phaser.Physics.Arcade.Group;
  private seniors!: Phaser.Physics.Arcade.Group;
  private inkProjectiles!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private drops!: Phaser.Physics.Arcade.Group;
  private boss?: AnalistaSeniorExausto;
  private bossDefeated = false;
  private startTimeMs = 0;
  private fx!: SanityFx;
  private hud!: Hud;
  private doorCopa!: Phaser.GameObjects.Image;
  private doorLabel!: Phaser.GameObjects.Text;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private levelWidth = LEVEL_WIDTH;

  constructor() {
    super("Phase3Scene");
  }

  create() {
    const run = getRun(this);
    this.startTimeMs = this.time.now;
    this.bossDefeated = false;

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.bg);

    const HUD_TOP_H = 68;
    this.add.image(LEVEL_WIDTH / 2, (HUD_TOP_H + FLOOR_Y) / 2, "bg-comercial")
      .setDisplaySize(LEVEL_WIDTH, FLOOR_Y - HUD_TOP_H);

    this.platforms = this.physics.add.staticGroup();
    this.buildFloor();
    this.buildPlatform(220, FLOOR_Y - 120, 5);
    this.buildPlatform(500, FLOOR_Y - 180, 4);
    this.buildPlatform(760, FLOOR_Y - 120, 6);
    this.buildPlatform(1050, FLOOR_Y - 160, 5);
    this.buildPlatform(1320, FLOOR_Y - 100, 6);
    this.buildPlatform(1600, FLOOR_Y - 180, 4);

    this.doorCopa = this.add.image(LEVEL_WIDTH - 60, FLOOR_Y - 30, "tex-door");
    this.doorCopa.setTint(0x555555);
    this.doorLabel = this.add.text(LEVEL_WIDTH - 60, FLOOR_Y - 72, "COPA\n[BLOQUEADO]", {
      fontFamily: "monospace", fontSize: "9px", color: "#666666", align: "center",
    }).setOrigin(0.5);

    const classDef = CLASSES[(run.characterClass ?? "analista") as ClassId];
    const weaponDef = WEAPONS[classDef.startWeapon];

    const spawnX = run.cameFrom === "copa" ? LEVEL_WIDTH - 120 : 80;
    this.player = new Player(this, spawnX, FLOOR_Y - 60);

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
          [this.evangelistas, this.coletores, this.planilhas, this.seniors].forEach(g =>
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
          [this.evangelistas, this.coletores, this.planilhas, this.seniors].forEach(g => {
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

    this.evangelistas   = this.physics.add.group({ runChildUpdate: false });
    this.coletores      = this.physics.add.group({ runChildUpdate: false });
    this.planilhas      = this.physics.add.group({ runChildUpdate: false });
    this.seniors        = this.physics.add.group({ runChildUpdate: false });
    this.inkProjectiles  = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group();
    this.drops           = this.physics.add.group();

    this.spawnEnemies();

    [this.evangelistas, this.planilhas, this.seniors, this.drops].forEach(g =>
      this.physics.add.collider(g, this.platforms)
    );

    const contactDamage = (group: Phaser.Physics.Arcade.Group, dmg: (e: Phaser.Physics.Arcade.Sprite) => number) => {
      this.physics.add.overlap(this.player, group, (_p, eObj) => {
        if (this.player.isInvulnerable(this.time.now)) return;
        this.player.takeDamage(dmg(eObj as Phaser.Physics.Arcade.Sprite), 4);
      });
    };
    contactDamage(this.evangelistas, (e) => (e as EvangelistaCorporativo).contactDamage);
    contactDamage(this.planilhas,    (e) => (e as PlanilhaViva).contactDamage);
    contactDamage(this.seniors,      (e) => (e as AnalistaSeniorExausto).contactDamage);

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
      [this.evangelistas, 3], [this.coletores, 1], [this.planilhas, 6], [this.seniors, 6],
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
        r.cameFrom = "phase3";
        r.nextScene = "Phase4Scene";
        this.scene.start("CopaScene");
      }
    });

    this.fx  = new SanityFx(this);
    this.hud = new Hud(this, LEVEL_WIDTH);
    this.hud.setObjective("Derrote o Analista Sênior e avance");

    const title = this.add.text(GAME_WIDTH / 2, 110, "FASE 3 — COMERCIAL", {
      fontFamily: "monospace", fontSize: "18px", color: "#eaeaea", align: "center",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(999);
    this.tweens.add({ targets: title, alpha: 0, duration: 800, delay: 2200, onComplete: () => title.destroy() });
  }

  private spawnEnemies() {
    [250, 600, 950, 1300].forEach((x) => {
      const e = new EvangelistaCorporativo(this, x, FLOOR_Y - 60);
      e.target = this.player;
      e.onFire = (fx, fy, tx, ty) => this.spawnEnemyProjectile(fx, fy, tx, ty, 12);
      this.evangelistas.add(e);
    });

    [400, 800, 1200].forEach((x) => {
      const e = new ColetorDeDados(this, x, FLOOR_Y - 160);
      e.target = this.player;
      e.onStealVR = () => {
        // steal nearest VR drop
        let nearest: Phaser.Physics.Arcade.Sprite | null = null;
        let bestDist = 50;
        this.drops.getChildren().forEach(d => {
          const drop = d as Phaser.Physics.Arcade.Sprite;
          const dist = Phaser.Math.Distance.Between(e.x, e.y, drop.x, drop.y);
          if (dist < bestDist) { bestDist = dist; nearest = drop; }
        });
        if (nearest) (nearest as Phaser.Physics.Arcade.Sprite).destroy();
      };
      this.coletores.add(e);
    });

    [500, 1100].forEach((x) => {
      const planilha = new PlanilhaViva(this, x, FLOOR_Y - 60);
      planilha.target = this.player;
      planilha.onFire = (px, py) => {
        // vertical danger column — add brief rectangle
        const col = this.add.rectangle(px, FLOOR_Y - 80, 16, 160, 0x44aaff, 0.5).setDepth(200);
        this.tweens.add({ targets: col, alpha: 0, duration: 600, onComplete: () => col.destroy() });
        // deal damage if player is in column
        if (Math.abs(this.player.x - px) < 20) {
          if (!this.player.isInvulnerable(this.time.now)) this.player.takeDamage(15, 0);
        }
      };
      planilha.onSplit = (sx, sy) => {
        for (let i = 0; i < 2; i++) {
          const mini = new PlanilhaViva(this, sx + (i === 0 ? -40 : 40), sy);
          mini.hp = 20;
          mini.maxHp = 20;
          mini.target = this.player;
          this.planilhas.add(mini);
          this.physics.add.collider(mini, this.platforms);
          this.physics.add.overlap(this.inkProjectiles, mini, (inkObj) => {
            const ink = inkObj as Phaser.Physics.Arcade.Sprite;
            if (!ink.active) return;
            const dmg = (ink.getData("damage") as number) ?? 10;
            const piercing = (ink.getData("piercing") as boolean) ?? false;
            const died = mini.hit(Math.round(dmg * this.player.damageMult), 0);
            if (!piercing) ink.destroy();
            if (died) { this.dropVR(mini.x, mini.y, 3); mini.destroy(); }
          });
        }
      };
      this.planilhas.add(planilha);
    });

    // Mini-boss
    const boss = new AnalistaSeniorExausto(this, 1750, FLOOR_Y - 60);
    boss.target = this.player;
    boss.hp = 100;
    // @ts-ignore - maxHp is public on the class
    boss.maxHp = 100;
    this.seniors.add(boss);
    this.boss = boss;
    this.physics.add.collider(boss, this.platforms);
    this.hud.showBoss("Analista Sênior Exausto", 100);

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

  private spawnEnemyProjectile(fx: number, fy: number, tx: number, ty: number, damage: number) {
    const proj = this.enemyProjectiles.create(fx, fy, "tex-inkproj") as Phaser.Physics.Arcade.Sprite;
    const body = proj.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    const angle = Phaser.Math.Angle.Between(fx, fy, tx, ty);
    body.setVelocity(Math.cos(angle) * 190, Math.sin(angle) * 190);
    proj.setData("damage", damage);
    proj.setTint(0xff6600);
    this.time.delayedCall(3000, () => { if (proj.active) proj.destroy(); });
    return proj;
  }

  private handleBossDefeat() {
    this.bossDefeated = true;
    this.hud.hideBoss();
    this.hud.setObjective("Copa desbloqueada! Use [ E ] na porta.");

    if (this.boss?.active) {
      for (let i = 0; i < 14; i++) {
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
      "ANALISTA SÊNIOR DERROTADO!\n\nPorta da Copa desbloqueada ->",
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

    hitGroup(this.evangelistas, 3, (c) => c as EvangelistaCorporativo);
    hitGroup(this.coletores,    1, (c) => c as ColetorDeDados);
    hitGroup(this.planilhas,    6, (c) => c as PlanilhaViva);
    hitGroup(this.seniors,      6, (c) => c as AnalistaSeniorExausto);

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
      const body = d.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Phaser.Math.Between(-120, 120), Phaser.Math.Between(-260, -160));
      body.setBounce(0.4);
      body.setDrag(120, 0);
    }
  }

  update(time: number, delta: number) {
    this.player.update(time, delta);
    this.player.tickPassive(time);

    this.evangelistas.getChildren().forEach(c => (c as EvangelistaCorporativo).preUpdate(time, delta));
    this.coletores.getChildren().forEach(c => (c as ColetorDeDados).preUpdate(time, delta));
    this.planilhas.getChildren().forEach(c => (c as PlanilhaViva).preUpdate(time, delta));
    this.seniors.getChildren().forEach(c => (c as AnalistaSeniorExausto).preUpdate(time, delta));

    // ColetorDeDados steals VR drops nearby
    this.coletores.getChildren().forEach(c => {
      const col = c as ColetorDeDados;
      if (!col.active) return;
      this.drops.getChildren().forEach(d => {
        const drop = d as Phaser.Physics.Arcade.Sprite;
        if (!drop.active) return;
        if (Phaser.Math.Distance.Between(col.x, col.y, drop.x, drop.y) < 50) {
          drop.destroy();
        }
      });
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

    if (this.boss?.active) {
      if (this.boss.swingActive && this.boss.swingHitbox) {
        if (!this.player.isInvulnerable(time) &&
          Phaser.Geom.Intersects.RectangleToRectangle(this.boss.swingHitbox, this.player.getBounds())) {
          this.player.takeDamage(this.boss.swingDamage, 3);
          this.boss.swingActive = false; this.boss.swingHitbox = null;
        }
      }
      if (!this.player.isInvulnerable(time) &&
        Phaser.Geom.Intersects.RectangleToRectangle(this.boss.getBounds(), this.player.getBounds())) {
        this.player.takeDamage(this.boss.contactDamage, 3);
      }
    }

    this.inkProjectiles.getChildren().forEach(obj => {
      const ink = obj as Phaser.Physics.Arcade.Sprite;
      if (!ink.active) return;
      const lifetime = ink.getData("lifetime") as number;
      if (lifetime && lifetime < time) { ink.destroy(); return; }
      if (!ink.getData("homing")) return;
      const allEnemies: Phaser.Physics.Arcade.Sprite[] = [];
      [this.evangelistas, this.coletores, this.planilhas, this.seniors].forEach(g => {
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
    });
  }
}
