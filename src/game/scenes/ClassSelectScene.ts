import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { CLASSES, ClassId, WEAPONS } from "../systems/WeaponSystem";
import { getRun } from "../systems/PlayerState";

const CLASS_IDS: ClassId[] = ["estagiario", "analista", "terceirizado"];
const CARD_W = 240;
const CARD_H = 340;

export class ClassSelectScene extends Phaser.Scene {
  private selectedIndex = 1;
  private cards: Phaser.GameObjects.Container[] = [];
  private cardY = 0;
  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;
  private prevLeft = false;
  private prevRight = false;

  constructor() {
    super("ClassSelectScene");
  }

  create() {
    this.cards = [];

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0d0f14);

    // Scanlines overlay
    const scan = this.add.graphics();
    scan.lineStyle(1, 0x000000, 0.12);
    for (let y = 0; y < GAME_HEIGHT; y += 4) scan.lineBetween(0, y, GAME_WIDTH, y);

    this.add.text(GAME_WIDTH / 2, 26, "ESCOLHA SUA FUNCAO", {
      fontFamily: "monospace", fontSize: "22px", fontStyle: "bold",
      color: "#f2a800", stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 54, "←  →  navegar     ENTER  confirmar", {
      fontFamily: "monospace", fontSize: "10px", color: "#555555",
    }).setOrigin(0.5);

    this.cardY = Math.floor(GAME_HEIGHT / 2) + 28;
    const totalW = CLASS_IDS.length * CARD_W + (CLASS_IDS.length - 1) * 30;
    const startX = Math.floor((GAME_WIDTH - totalW) / 2);

    CLASS_IDS.forEach((cid, i) => {
      const cx = startX + i * (CARD_W + 30) + CARD_W / 2;
      const container = this.buildCard(cid, cx, this.cardY);
      this.cards.push(container);

      const hit = this.add.rectangle(cx, this.cardY, CARD_W, CARD_H, 0, 0)
        .setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => { this.selectedIndex = i; this.refreshCards(); this.confirm(); });
      hit.on("pointerover", () => { this.selectedIndex = i; this.refreshCards(); });
    });

    this.refreshCards();

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 16, "[ ENTER ] ou clique no card para comecar", {
      fontFamily: "monospace", fontSize: "9px", color: "#444444",
    }).setOrigin(0.5);

    const kb = this.input.keyboard!;
    this.leftKey  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.A).on("down", () => {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.refreshCards();
    });
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.D).on("down", () => {
      this.selectedIndex = Math.min(CLASS_IDS.length - 1, this.selectedIndex + 1);
      this.refreshCards();
    });
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on("down", () => this.confirm());
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on("down", () => this.confirm());

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private buildCard(classId: ClassId, cx: number, cy: number): Phaser.GameObjects.Container {
    const def = CLASSES[classId];
    const weapon = WEAPONS[def.startWeapon];
    const hw = CARD_W / 2;
    const hh = CARD_H / 2;
    const container = this.add.container(cx, cy);

    // [0] Background — redrawn in refreshCards
    container.add(this.add.graphics());

    // [1] Color header stripe
    const hdr = this.add.graphics();
    hdr.fillStyle(def.color, 1);
    hdr.fillRect(-hw, -hh, CARD_W, 36);
    container.add(hdr);

    // [2] Class label
    container.add(
      this.add.text(0, -hh + 18, def.label.toUpperCase(), {
        fontFamily: "monospace", fontSize: "13px", fontStyle: "bold",
        color: "#ffffff", stroke: "#000000", strokeThickness: 2,
      }).setOrigin(0.5),
    );

    // [3] Character sprite placeholder
    const spr = this.add.graphics();
    spr.fillStyle(def.color, 1);
    spr.fillRect(-14, -hh + 44, 28, 44);
    spr.fillStyle(0xffffff, 0.18);
    spr.fillRect(-14, -hh + 58, 28, 12);
    container.add(spr);

    // [4] Stat bars
    const barG = this.add.graphics();
    const barX = -hw + 14;
    const barW = CARD_W - 28;
    const barsTop = -hh + 110;
    const drawBar = (yOff: number, fill: number, color: number) => {
      barG.fillStyle(0x1a1a1a, 1);
      barG.fillRect(barX, barsTop + yOff, barW, 6);
      barG.fillStyle(color, 1);
      barG.fillRect(barX, barsTop + yOff, Math.max(4, Math.floor(barW * Math.min(fill, 1))), 6);
    };
    drawBar(0,  def.maxEnergy / 130,  0xdd4444);
    drawBar(18, def.maxSanity / 120,  0x44ddaa);
    drawBar(36, def.speedMult / 1.2,  0x4488ff);
    container.add(barG);

    // [5,6,7] Stat labels with values
    const lblStyle = (color: string) => ({
      fontFamily: "monospace", fontSize: "8px", color,
    });
    container.add(
      this.add.text(barX, barsTop - 10, `ENERGIA  ${def.maxEnergy}`, lblStyle("#dd6666")),
    );
    container.add(
      this.add.text(barX, barsTop + 8, `SANIDADE ${def.maxSanity}`, lblStyle("#44ddaa")),
    );
    container.add(
      this.add.text(barX, barsTop + 26, `VELOCIDADE ${def.speedMult >= 1 ? "+" : ""}${Math.round((def.speedMult - 1) * 100)}%`, lblStyle("#4488ff")),
    );

    // [8] Description
    container.add(
      this.add.text(0, -hh + 170, def.description, {
        fontFamily: "monospace", fontSize: "10px", color: "#aaaaaa",
        align: "center", wordWrap: { width: CARD_W - 20 },
      }).setOrigin(0.5, 0),
    );

    // [9] Weapon
    container.add(
      this.add.text(0, hh - 70, `Arma: ${weapon.name}`, {
        fontFamily: "monospace", fontSize: "11px", fontStyle: "bold", color: "#f2a800",
      }).setOrigin(0.5, 0),
    );

    // [10] Trait
    container.add(
      this.add.text(0, hh - 48, def.trait, {
        fontFamily: "monospace", fontSize: "10px", color: "#88ff88",
      }).setOrigin(0.5, 0),
    );

    // [11] Confirm hint
    container.add(
      this.add.text(0, hh - 22, "ENTER para jogar", {
        fontFamily: "monospace", fontSize: "9px", color: "#555555",
      }).setOrigin(0.5, 0),
    );

    return container;
  }

  private refreshCards() {
    const hw = CARD_W / 2;
    const hh = CARD_H / 2;
    this.cards.forEach((container, i) => {
      const bg = container.getAt(0) as Phaser.GameObjects.Graphics;
      const selected = i === this.selectedIndex;
      bg.clear();
      if (selected) {
        bg.fillStyle(0x1e2128, 1);
        bg.fillRect(-hw, -hh, CARD_W, CARD_H);
        bg.lineStyle(3, 0xf2a800, 1);
        bg.strokeRect(-hw, -hh, CARD_W, CARD_H);
        container.setAlpha(1);
        container.setY(this.cardY - 8);
      } else {
        bg.fillStyle(0x12151a, 1);
        bg.fillRect(-hw, -hh, CARD_W, CARD_H);
        bg.lineStyle(1, 0x2a2a2a, 1);
        bg.strokeRect(-hw, -hh, CARD_W, CARD_H);
        container.setAlpha(0.5);
        container.setY(this.cardY);
      }
    });
  }

  update() {
    const leftDown  = this.leftKey.isDown;
    const rightDown = this.rightKey.isDown;
    if (leftDown && !this.prevLeft) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.refreshCards();
    }
    if (rightDown && !this.prevRight) {
      this.selectedIndex = Math.min(CLASS_IDS.length - 1, this.selectedIndex + 1);
      this.refreshCards();
    }
    this.prevLeft  = leftDown;
    this.prevRight = rightDown;
  }

  private confirm() {
    const run = getRun(this);
    run.characterClass = CLASS_IDS[this.selectedIndex];
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("OpenSpaceScene");
    });
  }
}
