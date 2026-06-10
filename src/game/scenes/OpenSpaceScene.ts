import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../config";
import { Player } from "../entities/Player";
import { EstagiarioDesesperado, AnalistaJunior } from "../entities/Enemies";

const LEVEL_WIDTH = 1920;
const FLOOR_Y = GAME_HEIGHT - 32;

export class OpenSpaceScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private estagiarios!: Phaser.Physics.Arcade.Group;
  private analistas!: Phaser.Physics.Arcade.Group;
  private drops!: Phaser.Physics.Arcade.Group;
  private startTimeMs = 0;

  // HUD
  private hudEnergy!: Phaser.GameObjects.Graphics;
  private hudSanity!: Phaser.GameObjects.Graphics;
  private hudVR!: Phaser.GameObjects.Text;
  private hudClock!: Phaser.GameObjects.Text;
  private hudCombo!: Phaser.GameObjects.Text;
  private hudHint!: Phaser.GameObjects.Text;

  constructor() {
    super("OpenSpaceScene");
  }

  create() {
    this.startTimeMs = this.time.now;
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.bg);

    // Backdrop "office" stripes
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgDark, 1);
    for (let x = 0; x < LEVEL_WIDTH; x += 120) {
      bg.fillRect(x, 60, 60, GAME_HEIGHT - 120);
    }
    bg.setScrollFactor(0.4);

    // Decorative "baias" (cubicles) along the floor
    for (let x = 80; x < LEVEL_WIDTH; x += 260) {
      const baia = this.add.image(x, FLOOR_Y - 28, "tex-baia");
      baia.setTint(0x4b525e);
    }

    // Platforms
    this.platforms = this.physics.add.staticGroup();
    this.buildFloor();
    this.buildPlatform(260, FLOOR_Y - 110, 6);
    this.buildPlatform(520, FLOOR_Y - 180, 5);
    this.buildPlatform(780, FLOOR_Y - 110, 6);
    this.buildPlatform(1080, FLOOR_Y - 200, 4);
    this.buildPlatform(1300, FLOOR_Y - 120, 6);
    this.buildPlatform(1580, FLOOR_Y - 180, 5);

    // Player
    this.player = new Player(this, 80, FLOOR_Y - 60);
    this.physics.add.collider(this.player, this.platforms);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.player.onDeath = () => {
      this.scene.start("GameOverScene", { vr: this.player.vr });
    };
    this.player.onAttack = (hb, step) => this.resolveAttack(hb, step);

    // Enemy groups
    this.estagiarios = this.physics.add.group({ classType: EstagiarioDesesperado, runChildUpdate: false });
    this.analistas = this.physics.add.group({ classType: AnalistaJunior, runChildUpdate: false });
    this.drops = this.physics.add.group();

    this.spawnEnemies();

    this.physics.add.collider(this.estagiarios, this.platforms);
    this.physics.add.collider(this.analistas, this.platforms);
    this.physics.add.collider(this.drops, this.platforms);

    this.physics.add.overlap(this.player, this.estagiarios, (_p, eObj) => {
      const e = eObj as EstagiarioDesesperado;
      if (this.player.isInvulnerable(this.time.now)) return;
      this.player.takeDamage(e.contactDamage);
    });

    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      const d = dObj as Phaser.Physics.Arcade.Sprite;
      this.player.addVR(1);
      d.destroy();
    });

    // HUD (fixed to camera)
    this.buildHud();

    // Title flash
    const title = this.add
      .text(GAME_WIDTH / 2, 80, "18:00 — Quarta-feira\nÁrea 1: Estações de Trabalho", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#eaeaea",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.tweens.add({ targets: title, alpha: 0, duration: 800, delay: 2200, onComplete: () => title.destroy() });
  }

  private buildFloor() {
    // Solid invisible floor body
    const floor = this.add.rectangle(LEVEL_WIDTH / 2, FLOOR_Y + 16, LEVEL_WIDTH, 32, COLORS.floor);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);
  }

  private buildPlatform(x: number, y: number, tiles: number) {
    const w = tiles * 32;
    const plat = this.add.rectangle(x + w / 2, y, w, 14, COLORS.platform);
    this.physics.add.existing(plat, true);
    this.platforms.add(plat);
  }

  private spawnEnemies() {
    // Estagiários on the floor
    [380, 700, 980, 1240, 1500, 1780].forEach((x) => {
      const e = new EstagiarioDesesperado(this, x, FLOOR_Y - 40, Math.random() > 0.5 ? 1 : -1);
      this.estagiarios.add(e);
    });

    // Analistas (slower, more threatening)
    [600, 1150, 1620].forEach((x) => {
      const a = new AnalistaJunior(this, x, FLOOR_Y - 60);
      a.target = this.player;
      this.analistas.add(a);
    });
  }

  private resolveAttack(hb: Phaser.Geom.Rectangle, step: number) {
    const damage = step === 3 ? 15 : 10;
    const knockback = (step === 3 ? 320 : 120) * this.player.facing;

    // Visual feedback (slash rectangle)
    const slash = this.add.rectangle(hb.x + hb.width / 2, hb.y + hb.height / 2, hb.width, hb.height, 0xffffff, 0.5);
    this.tweens.add({ targets: slash, alpha: 0, duration: 140, onComplete: () => slash.destroy() });

    const tryHit = (sprite: Phaser.Physics.Arcade.Sprite) => {
      const r = sprite.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(hb, r)) return true;
      return false;
    };

    this.estagiarios.getChildren().forEach((c) => {
      const e = c as EstagiarioDesesperado;
      if (!e.active) return;
      if (tryHit(e)) {
        const dead = e.hit(damage, knockback);
        if (dead) {
          this.dropVR(e.x, e.y);
          e.destroy();
        }
      }
    });

    this.analistas.getChildren().forEach((c) => {
      const a = c as AnalistaJunior;
      if (!a.active) return;
      if (tryHit(a)) {
        const dead = a.hit(damage, knockback);
        if (dead) {
          this.dropVR(a.x, a.y, 3);
          a.destroy();
        }
      }
    });
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

  private buildHud() {
    const hud = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    const panel = this.add.rectangle(0, 0, GAME_WIDTH, 56, 0x000000, 0.55).setOrigin(0, 0);
    hud.add(panel);

    this.hudEnergy = this.add.graphics();
    this.hudSanity = this.add.graphics();
    hud.add(this.hudEnergy);
    hud.add(this.hudSanity);

    const lblE = this.add.text(16, 8, "ENERGIA", { fontFamily: "monospace", fontSize: "10px", color: "#ffd0d0" });
    const lblS = this.add.text(16, 30, "SANIDADE", { fontFamily: "monospace", fontSize: "10px", color: "#cfe2ff" });
    hud.add(lblE);
    hud.add(lblS);

    this.hudVR = this.add.text(GAME_WIDTH - 16, 12, "VR: 0", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#f2c14e",
    }).setOrigin(1, 0);
    hud.add(this.hudVR);

    this.hudClock = this.add.text(GAME_WIDTH - 16, 32, "18:00", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#eaeaea",
    }).setOrigin(1, 0);
    hud.add(this.hudClock);

    this.hudCombo = this.add.text(GAME_WIDTH / 2, 28, "", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ffffff",
    }).setOrigin(0.5);
    hud.add(this.hudCombo);

    this.hudHint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 18,
      "← → andar  •  ESPAÇO pular  •  SHIFT dash  •  J atacar", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#aaaaaa",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
  }

  private drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, value: number, max: number, color: number) {
    const w = 180;
    const h = 10;
    g.clear();
    g.fillStyle(0x222222, 0.9);
    g.fillRect(x, y, w, h);
    g.fillStyle(color, 1);
    g.fillRect(x, y, Math.max(0, (value / max) * w), h);
    g.lineStyle(1, 0x000000, 0.6);
    g.strokeRect(x, y, w, h);
  }

  update(time: number, delta: number) {
    this.player.update(time, delta);

    // Analista swing → damage
    this.analistas.getChildren().forEach((c) => {
      const a = c as AnalistaJunior;
      if (a.swingActive && a.swingHitbox) {
        const pb = this.player.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(a.swingHitbox, pb)) {
          this.player.takeDamage(a.swingDamage);
          a.swingActive = false;
          a.swingHitbox = null;
        }
      }
    });

    // HUD updates
    this.drawBar(this.hudEnergy, 88, 8, this.player.energy, 100, COLORS.energyBar);
    this.drawBar(this.hudSanity, 88, 30, this.player.sanity, 100, COLORS.sanityBar);
    this.hudVR.setText(`VR: ${this.player.vr}`);

    // Cosmetic clock: 1 real second = 1 in-game minute, starting 18:00
    const minutes = Math.floor((time - this.startTimeMs) / 1000);
    const hh = 18 + Math.floor(minutes / 60);
    const mm = minutes % 60;
    this.hudClock.setText(`${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`);
  }
}
