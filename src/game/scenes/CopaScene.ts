import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { HUD_BOT_Y } from "../systems/Hud";
import { Player } from "../entities/Player";
import { Faxineiro } from "../entities/Faxineiro";
import { getRun, savePersisted } from "../systems/PlayerState";
import { SanityFx } from "../systems/SanityFx";
import { ShopUI } from "../systems/Shop";
import { Hud } from "../systems/Hud";

const LEVEL_WIDTH = 1280;
const FLOOR_Y = HUD_BOT_Y - 32;

export class CopaScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private faxineiros!: Phaser.Physics.Arcade.Group;
  private drops!: Phaser.Physics.Arcade.Group;
  private fx!: SanityFx;
  private hud!: Hud;
  private shop!: ShopUI;
  private ponto!: Phaser.GameObjects.Image;
  private coffee!: Phaser.GameObjects.Image;
  private coffeeReadyAt = 0;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private hintText!: Phaser.GameObjects.Text;
  private startTimeMs = 0;
  private lastHealAt = 0;

  constructor() {
    super("CopaScene");
  }

  create() {
    const run = getRun(this);
    this.startTimeMs = this.time.now;

    // FGTS: +10 when player reaches Copa from OpenSpace for the first time this run
    if (run.cameFrom === "openspace" && !run.fgts) {
      run.fgts += 10;
      savePersisted(run.reconhecimento, run.fgts, run.loopCount);
    } else if (run.cameFrom === "openspace") {
      run.fgts += 10;
      savePersisted(run.reconhecimento, run.fgts, run.loopCount);
    }

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.copaBg);

    // Tile backdrop
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
    ([
      [320, FLOOR_Y - 90, 4],
      [720, FLOOR_Y - 90, 4],
      [1000, FLOOR_Y - 140, 3],
    ] as [number, number, number][]).forEach(([x, y, t]) => {
      const w = t * 32;
      const plat = this.add.rectangle(x + w / 2, y, w, 14, COLORS.copaAccent);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // Coffee machine
    this.coffee = this.add.image(180, FLOOR_Y - 20, "tex-coffee");
    this.add.text(180, FLOOR_Y - 56, "CAFE", {
      fontFamily: "monospace", fontSize: "10px", color: "#eac08a",
    }).setOrigin(0.5);

    // Ponto eletrônico
    this.ponto = this.add.image(LEVEL_WIDTH - 140, FLOOR_Y - 20, "tex-ponto");
    this.add.text(LEVEL_WIDTH - 140, FLOOR_Y - 56, "PONTO", {
      fontFamily: "monospace", fontSize: "10px", color: "#f2c14e",
    }).setOrigin(0.5);

    // Door back to OpenSpace
    const doorBack = this.add.image(40, FLOOR_Y - 30, "tex-door");
    this.add.text(40, FLOOR_Y - 70, "VOLTAR", {
      fontFamily: "monospace", fontSize: "9px", color: "#c9a36a",
    }).setOrigin(0.5);
    doorBack.setData("door", "back");

    // Player
    this.player = new Player(this, 80, FLOOR_Y - 60);
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

    // Faxineiros
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

    // FX + HUD + Shop
    this.fx = new SanityFx(this);
    this.hud = new Hud(this, LEVEL_WIDTH);
    this.hud.setObjective("Descanse, compre no Ponto e volte ao escritorio");

    this.shop = new ShopUI(this);
    this.shop.setPlayer(this.player);
    this.shop.onWeaponChange = (id) => {
      const r = getRun(this);
      r.weaponId = id;
    };
    this.shop.onAdvance = () => {
      this.persist();
      const r = getRun(this);
      r.reconhecimento += Math.floor(r.vr * 0.5);
      r.vr = 0;
      const dest = r.nextScene ?? "OpenSpaceScene";
      r.cameFrom = "next";
      r.nextScene = undefined;
      this.scene.start(dest);
    };

    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.hintText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 18,
        "E para interagir  •  Cafe restaura Energia  •  Ponto abre a loja",
        { fontFamily: "monospace", fontSize: "11px", color: "#aaaaaa" })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1000);

    // Door back trigger — returns to the phase the player came from
    const phaseBackMap: Record<string, string> = {
      openspace: "OpenSpaceScene",
      phase2:    "Phase2Scene",
      phase3:    "Phase3Scene",
      phase4:    "Phase4Scene",
      phase5:    "Phase5Scene",
    };
    const doorBackZone = this.add.zone(40, FLOOR_Y - 30, 40, 60);
    this.physics.add.existing(doorBackZone, true);
    this.physics.add.overlap(this.player, doorBackZone, () => {
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.persist();
        const r = getRun(this);
        const dest = phaseBackMap[r.cameFrom ?? "openspace"] ?? "OpenSpaceScene";
        r.cameFrom = "copa";
        this.scene.start(dest);
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
        if (f.hit(damage, knockback)) {
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

  update(time: number, delta: number) {
    this.player.update(time, delta);
    this.player.tickPassive(time);

    // Faxineiro swings check
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

    // Faxineiro proximity healing (+5 Sanidade a cada 2s quando perto e em paz)
    if (time - this.lastHealAt > 2000) {
      this.faxineiros.getChildren().forEach((c) => {
        const f = c as Faxineiro;
        if (!f.active || f.swingActive) return;
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, f.x, f.y);
        if (dist < 90) {
          this.lastHealAt = time;
          this.player.sanity = Math.min(100, this.player.sanity + 5);
          const fx = this.add.text(f.x, f.y - 40, "+5 SANIDADE", {
            fontFamily: "monospace", fontSize: "11px", color: "#44ffaa",
          }).setOrigin(0.5).setDepth(500);
          this.tweens.add({ targets: fx, y: fx.y - 28, alpha: 0, duration: 750, onComplete: () => fx.destroy() });
        }
      });
    }

    // Interact: coffee and ponto
    const nearCoffee = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.coffee.x, this.coffee.y) < 40;
    const nearPonto = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.ponto.x, this.ponto.y) < 40;

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      if (nearCoffee && time >= this.coffeeReadyAt && this.player.vr >= 2) {
        this.player.vr -= 2;
        this.player.energy = Math.min(100, this.player.energy + 25);
        this.player.sanity = Math.max(0, this.player.sanity - 5);
        this.coffeeReadyAt = time + 3000;
        const fxt = this.add.text(this.coffee.x, this.coffee.y - 50, "+25 ENERGIA  -5 SANIDADE", {
          fontFamily: "monospace", fontSize: "11px", color: "#eac08a",
        }).setOrigin(0.5);
        this.tweens.add({ targets: fxt, y: fxt.y - 24, alpha: 0, duration: 700, onComplete: () => fxt.destroy() });
      } else if (nearPonto) {
        this.persist();
        this.shop.toggle();
      }
    }
    this.shop.update();

    this.fx.update(time, this.player.sanity);

    const run = getRun(this);
    this.hud.update({
      energy: Math.ceil(this.player.energy),
      maxEnergy: 100,
      sanity: Math.ceil(this.player.sanity),
      maxSanity: 100,
      vr: this.player.vr,
      reconhecimento: run.reconhecimento,
      time,
      startTime: this.startTimeMs,
      playerX: this.player.x,
      interactHint: nearCoffee
        ? (time < this.coffeeReadyAt ? "Cafeteira recarregando..." : "[ E ]  Cafe Triplo (2 VR)")
        : nearPonto ? "[ E ]  Ponto Eletronico (loja)"
        : undefined,
    });

    this.hintText.setText(
      nearCoffee
        ? (time < this.coffeeReadyAt ? "Cafeteira recarregando..." : "E: Cafe Triplo (2 VR  +25 Energia  -5 Sanidade)")
        : nearPonto ? "E: abrir Ponto Eletronico (loja)"
        : "E para interagir  •  <- voltar pelo escritorio",
    );
  }
}
