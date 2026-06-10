import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { Player } from "../entities/Player";
import { Faxineiro } from "../entities/Faxineiro";
import { getRun } from "../systems/PlayerState";
import { SanityFx } from "../systems/SanityFx";
import { ShopUI } from "../systems/Shop";

const LEVEL_WIDTH = 1280;
const FLOOR_Y = GAME_HEIGHT - 32;

export class CopaScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private faxineiros!: Phaser.Physics.Arcade.Group;
  private drops!: Phaser.Physics.Arcade.Group;
  private fx!: SanityFx;
  private shop!: ShopUI;
  private ponto!: Phaser.GameObjects.Image;
  private coffee!: Phaser.GameObjects.Image;
  private coffeeReadyAt = 0;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private hintText!: Phaser.GameObjects.Text;

  // HUD
  private hudEnergy!: Phaser.GameObjects.Graphics;
  private hudSanity!: Phaser.GameObjects.Graphics;
  private hudVR!: Phaser.GameObjects.Text;

  constructor() {
    super("CopaScene");
  }

  create() {
    const run = getRun(this);
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.copaBg);

    // Tile backdrop — kitchen tiles
    const bg = this.add.graphics();
    for (let x = 0; x < LEVEL_WIDTH; x += 48) {
      for (let y = 60; y < GAME_HEIGHT - 32; y += 48) {
        bg.fillStyle(((x + y) / 48) % 2 < 1 ? 0x2a3434 : 0x202828, 1);
        bg.fillRect(x, y, 48, 48);
      }
    }
    bg.setScrollFactor(0.6);

    this.platforms = this.physics.add.staticGroup();
    const floor = this.add.rectangle(LEVEL_WIDTH / 2, FLOOR_Y + 16, LEVEL_WIDTH, 32, COLORS.copaFloor);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);
    // Two small platforms (mesas)
    [
      [320, FLOOR_Y - 90, 4],
      [720, FLOOR_Y - 90, 4],
      [1000, FLOOR_Y - 140, 3],
    ].forEach(([x, y, t]) => {
      const w = (t as number) * 32;
      const plat = this.add.rectangle((x as number) + w / 2, y as number, w, 14, COLORS.copaAccent);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // Coffee machine
    this.coffee = this.add.image(180, FLOOR_Y - 20, "tex-coffee");
    this.add.text(180, FLOOR_Y - 56, "CAFÉ", { fontFamily: "monospace", fontSize: "10px", color: "#eac08a" }).setOrigin(0.5);

    // Ponto eletrônico
    this.ponto = this.add.image(LEVEL_WIDTH - 140, FLOOR_Y - 20, "tex-ponto");
    this.add.text(LEVEL_WIDTH - 140, FLOOR_Y - 56, "PONTO", { fontFamily: "monospace", fontSize: "10px", color: "#f2c14e" }).setOrigin(0.5);

    // Door back to OpenSpace (left)
    const doorBack = this.add.image(40, FLOOR_Y - 30, "tex-door");
    this.add.text(40, FLOOR_Y - 70, "VOLTAR", { fontFamily: "monospace", fontSize: "9px", color: "#c9a36a" }).setOrigin(0.5);
    doorBack.setData("door", "back");

    // Player
    const spawnX = run.cameFrom === "next" ? 80 : 80;
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

    // Faxineiros (2)
    this.faxineiros = this.physics.add.group({ classType: Faxineiro, runChildUpdate: false });
    [520, 880].forEach((x) => {
      const f = new Faxineiro(this, x, FLOOR_Y - 80);
      f.target = this.player;
      this.faxineiros.add(f);
    });
    this.physics.add.collider(this.faxineiros, this.platforms);

    this.drops = this.physics.add.group();
    this.physics.add.collider(this.drops, this.platforms);
    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      this.player.addVR(1);
      (dObj as Phaser.Physics.Arcade.Sprite).destroy();
    });

    // FX + Shop
    this.fx = new SanityFx(this);
    this.shop = new ShopUI(this);
    this.shop.onAdvance = () => {
      // Sprint 2 ends with "next area" hook — for now restart the loop one step further (placeholder).
      this.persist();
      const r = getRun(this);
      r.reconhecimento += Math.floor(r.vr * 0.5);
      r.vr = 0;
      r.cameFrom = "next";
      this.scene.start("OpenSpaceScene");
    };

    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.buildHud();

    this.hintText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 18,
        "E para interagir  •  Café restaura Energia  •  Ponto abre a loja",
        { fontFamily: "monospace", fontSize: "11px", color: "#aaaaaa" })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1000);

    // Door back trigger
    const doorBackZone = this.add.zone(40, FLOOR_Y - 30, 40, 60);
    this.physics.add.existing(doorBackZone, true);
    this.physics.add.overlap(this.player, doorBackZone, () => {
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.persist();
        const r = getRun(this);
        r.cameFrom = "copa";
        this.scene.start("OpenSpaceScene");
      }
    });

    const title = this.add
      .text(GAME_WIDTH / 2, 80, "COPA — 18:14\nLuz fluorescente piscando.", {
        fontFamily: "monospace", fontSize: "16px", color: "#eaeaea", align: "center",
      })
      .setOrigin(0.5).setScrollFactor(0);
    this.tweens.add({ targets: title, alpha: 0, duration: 800, delay: 2000, onComplete: () => title.destroy() });
  }

  private persist() {
    const r = getRun(this);
    r.energy = this.player.energy;
    r.sanity = this.player.sanity;
    r.vr = this.player.vr;
  }

  private resolveAttack(hb: Phaser.Geom.Rectangle, step: number) {
    const damage = step === 3 ? 15 : 10;
    const knockback = (step === 3 ? 320 : 120) * this.player.facing;
    const slash = this.add.rectangle(hb.x + hb.width / 2, hb.y + hb.height / 2, hb.width, hb.height, 0xffffff, 0.5);
    this.tweens.add({ targets: slash, alpha: 0, duration: 140, onComplete: () => slash.destroy() });

    this.faxineiros.getChildren().forEach((c) => {
      const f = c as Faxineiro;
      if (!f.active) return;
      if (Phaser.Geom.Intersects.RectangleToRectangle(hb, f.getBounds())) {
        const dead = f.hit(damage, knockback);
        if (dead) {
          this.dropVR(f.x, f.y, 5);
          f.destroy();
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

    // Faxineiro swings
    this.faxineiros.getChildren().forEach((c) => {
      const f = c as Faxineiro;
      if (f.swingActive && f.swingHitbox) {
        const pb = this.player.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(f.swingHitbox, pb)) {
          this.player.takeDamage(f.swingDamage, f.sanityDamage);
          f.swingActive = false; f.swingHitbox = null;
        }
      }
    });

    // Interact: coffee
    const nearCoffee = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.coffee.x, this.coffee.y) < 40;
    const nearPonto = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.ponto.x, this.ponto.y) < 40;
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      if (nearCoffee && time >= this.coffeeReadyAt && this.player.vr >= 2) {
        this.player.vr -= 2;
        this.player.energy = Math.min(100, this.player.energy + 25);
        this.player.sanity = Math.max(0, this.player.sanity - 5); // cafeína corrói
        this.coffeeReadyAt = time + 3000;
        const fx = this.add.text(this.coffee.x, this.coffee.y - 50, "+25 ENERGIA", {
          fontFamily: "monospace", fontSize: "11px", color: "#eac08a",
        }).setOrigin(0.5);
        this.tweens.add({ targets: fx, y: fx.y - 24, alpha: 0, duration: 700, onComplete: () => fx.destroy() });
      } else if (nearPonto) {
        this.persist();
        this.shop.toggle();
      }
    }
    this.shop.update();

    // HUD
    this.drawBar(this.hudEnergy, 88, 8, this.player.energy, 100, COLORS.energyBar);
    this.drawBar(this.hudSanity, 88, 30, this.player.sanity, 100, COLORS.sanityBar);
    this.hudVR.setText(`VR: ${this.player.vr}`);

    this.fx.update(time, this.player.sanity);

    // Contextual hint
    if (nearCoffee) this.hintText.setText(time < this.coffeeReadyAt ? "Cafeteira recarregando…" : "E: Café Triplo (2 VR · +25 Energia · -5 Sanidade)");
    else if (nearPonto) this.hintText.setText("E: abrir Ponto Eletrônico (loja)");
    else this.hintText.setText("E para interagir  •  ← voltar pelo escritório");
  }
}
