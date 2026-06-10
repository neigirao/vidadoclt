import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { Player } from "../entities/Player";
import { EstagiarioDesesperado, AnalistaJunior } from "../entities/Enemies";
import { getRun } from "../systems/PlayerState";
import { SanityFx } from "../systems/SanityFx";

const LEVEL_WIDTH = 1920;
const FLOOR_Y = GAME_HEIGHT - 32;

export class OpenSpaceScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private estagiarios!: Phaser.Physics.Arcade.Group;
  private analistas!: Phaser.Physics.Arcade.Group;
  private drops!: Phaser.Physics.Arcade.Group;
  private startTimeMs = 0;
  private fx!: SanityFx;
  private doorCopa!: Phaser.GameObjects.Image;
  private interactKey!: Phaser.Input.Keyboard.Key;

  private hudEnergy!: Phaser.GameObjects.Graphics;
  private hudSanity!: Phaser.GameObjects.Graphics;
  private hudVR!: Phaser.GameObjects.Text;
  private hudClock!: Phaser.GameObjects.Text;
  private hudHint!: Phaser.GameObjects.Text;

  constructor() {
    super("OpenSpaceScene");
  }

  create() {
    const run = getRun(this);
    this.startTimeMs = this.time.now;
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.bg);

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgDark, 1);
    for (let x = 0; x < LEVEL_WIDTH; x += 120) bg.fillRect(x, 60, 60, GAME_HEIGHT - 120);
    bg.setScrollFactor(0.4);

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

    // Door to Copa at end
    this.doorCopa = this.add.image(LEVEL_WIDTH - 60, FLOOR_Y - 30, "tex-door");
    this.add.text(LEVEL_WIDTH - 60, FLOOR_Y - 72, "COPA", {
      fontFamily: "monospace", fontSize: "10px", color: "#c9a36a",
    }).setOrigin(0.5);

    const spawnX = run.cameFrom === "copa" ? LEVEL_WIDTH - 120 : 80;
    this.player = new Player(this, spawnX, FLOOR_Y - 60);
    this.player.energy = run.energy;
    this.player.sanity = run.sanity;
    this.player.vr = run.vr;
    this.physics.add.collider(this.player, this.platforms);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.player.onDeath = (cause) => {
      this.persist();
      this.scene.start("GameOverScene", { vr: this.player.vr, cause });
    };
    this.player.onAttack = (hb, step) => this.resolveAttack(hb, step);

    this.estagiarios = this.physics.add.group({ classType: EstagiarioDesesperado, runChildUpdate: false });
    this.analistas = this.physics.add.group({ classType: AnalistaJunior, runChildUpdate: false });
    this.drops = this.physics.add.group();

    if (run.cameFrom !== "copa") this.spawnEnemies();

    this.physics.add.collider(this.estagiarios, this.platforms);
    this.physics.add.collider(this.analistas, this.platforms);
    this.physics.add.collider(this.drops, this.platforms);

    this.physics.add.overlap(this.player, this.estagiarios, (_p, eObj) => {
      const e = eObj as EstagiarioDesesperado;
      if (this.player.isInvulnerable(this.time.now)) return;
      this.player.takeDamage(e.contactDamage, 4);
    });

    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      this.player.addVR(1);
      (dObj as Phaser.Physics.Arcade.Sprite).destroy();
    });

    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    const doorZone = this.add.zone(this.doorCopa.x, this.doorCopa.y, 40, 60);
    this.physics.add.existing(doorZone, true);
    this.physics.add.overlap(this.player, doorZone, () => {
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.persist();
        const r = getRun(this);
        r.cameFrom = "openspace";
        this.scene.start("CopaScene");
      }
    });

    this.fx = new SanityFx(this);
    this.buildHud();

    const title = this.add
      .text(GAME_WIDTH / 2, 80, "18:00 — Quarta-feira\nÁrea 1: Estações de Trabalho", {
        fontFamily: "monospace", fontSize: "18px", color: "#eaeaea", align: "center",
      })
      .setOrigin(0.5).setScrollFactor(0);
    this.tweens.add({ targets: title, alpha: 0, duration: 800, delay: 2200, onComplete: () => title.destroy() });
  }

  private persist() {
    const r = getRun(this);
    r.energy = this.player.energy;
    r.sanity = this.player.sanity;
    r.vr = this.player.vr;
  }

  private buildFloor() {
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
    [380, 700, 980, 1240, 1500, 1780].forEach((x) => {
      const e = new EstagiarioDesesperado(this, x, FLOOR_Y - 40, Math.random() > 0.5 ? 1 : -1);
      this.estagiarios.add(e);
    });
    [600, 1150, 1620].forEach((x) => {
      const a = new AnalistaJunior(this, x, FLOOR_Y - 60);
      a.target = this.player;
      this.analistas.add(a);
    });
  }

  private resolveAttack(hb: Phaser.Geom.Rectangle, step: number) {
    const damage = step === 3 ? 15 : 10;
    const knockback = (step === 3 ? 320 : 120) * this.player.facing;
    const slash = this.add.rectangle(hb.x + hb.width / 2, hb.y + hb.height / 2, hb.width, hb.height, 0xffffff, 0.5);
    this.tweens.add({ targets: slash, alpha: 0, duration: 140, onComplete: () => slash.destroy() });

    const tryHit = (sprite: Phaser.Physics.Arcade.Sprite) =>
      Phaser.Geom.Intersects.RectangleToRectangle(hb, sprite.getBounds());

    this.estagiarios.getChildren().forEach((c) => {
      const e = c as EstagiarioDesesperado;
      if (!e.active) return;
      if (tryHit(e)) {
        if (e.hit(damage, knockback)) { this.dropVR(e.x, e.y); e.destroy(); }
      }
    });

    this.analistas.getChildren().forEach((c) => {
      const a = c as AnalistaJunior;
      if (!a.active) return;
      if (tryHit(a)) {
        if (a.hit(damage, knockback)) { this.dropVR(a.x, a.y, 3); a.destroy(); }
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
    hud.add(this.add.rectangle(0, 0, GAME_WIDTH, 56, 0x000000, 0.55).setOrigin(0, 0));
    this.hudEnergy = this.add.graphics();
    this.hudSanity = this.add.graphics();
    hud.add([this.hudEnergy, this.hudSanity]);
    hud.add(this.add.text(16, 8, "ENERGIA", { fontFamily: "monospace", fontSize: "10px", color: "#ffd0d0" }));
    hud.add(this.add.text(16, 30, "SANIDADE", { fontFamily: "monospace", fontSize: "10px", color: "#cfe2ff" }));
    this.hudVR = this.add.text(GAME_WIDTH - 16, 12, "VR: 0", {
      fontFamily: "monospace", fontSize: "16px", color: "#f2c14e",
    }).setOrigin(1, 0);
    hud.add(this.hudVR);
    this.hudClock = this.add.text(GAME_WIDTH - 16, 32, "18:00", {
      fontFamily: "monospace", fontSize: "14px", color: "#eaeaea",
    }).setOrigin(1, 0);
    hud.add(this.hudClock);

    this.hudHint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 18,
      "← → andar  •  ESPAÇO pular  •  SHIFT dash  •  J atacar  •  E interagir", {
        fontFamily: "monospace", fontSize: "11px", color: "#aaaaaa",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
  }

  private drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, value: number, max: number, color: number) {
    const w = 180; const h = 10;
    g.clear();
    g.fillStyle(0x222222, 0.9); g.fillRect(x, y, w, h);
    g.fillStyle(color, 1); g.fillRect(x, y, Math.max(0, (value / max) * w), h);
    g.lineStyle(1, 0x000000, 0.6); g.strokeRect(x, y, w, h);
  }

  update(time: number, delta: number) {
    this.player.update(time, delta);
    this.player.tickPassive(time);

    this.analistas.getChildren().forEach((c) => {
      const a = c as AnalistaJunior;
      if (a.swingActive && a.swingHitbox) {
        const pb = this.player.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(a.swingHitbox, pb)) {
          this.player.takeDamage(a.swingDamage, 6);
          a.swingActive = false; a.swingHitbox = null;
        }
      }
    });

    this.drawBar(this.hudEnergy, 88, 8, this.player.energy, 100, COLORS.energyBar);
    this.drawBar(this.hudSanity, 88, 30, this.player.sanity, 100, COLORS.sanityBar);
    this.hudVR.setText(`VR: ${this.player.vr}`);

    const minutes = Math.floor((time - this.startTimeMs) / 1000);
    const hh = 18 + Math.floor(minutes / 60);
    const mm = minutes % 60;
    this.hudClock.setText(`${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`);

    this.fx.update(time, this.player.sanity);

    const nearDoor = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.doorCopa.x, this.doorCopa.y) < 40;
    if (nearDoor) this.hudHint.setText("E: entrar na Copa");
    else this.hudHint.setText("← → andar  •  ESPAÇO pular  •  SHIFT dash  •  J atacar  •  E interagir");
  }
}
