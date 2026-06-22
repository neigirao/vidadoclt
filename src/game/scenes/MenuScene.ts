import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../constants";
import { getRun } from "../systems/PlayerState";

const ACCENT = 0xf2a800;
const ACCENT_DIM = 0xb87a00;
const TEXT_LIGHT = "#eaeaea";
const TEXT_DIM = "#888888";
const TEXT_ACCENT = "#f2a800";
const BG_PANEL = 0x12151a;
const BG_MENU = 0x1a1d23;

const MENU_ITEMS = [
  { label: "JOGAR", icon: "▶" },
  { label: "JOGAR V2", icon: "▶" },
  { label: "RANKING", icon: "🏆" },
  { label: "ARSENAL", icon: "🎒" },
  { label: "CONQUISTAS", icon: "★" },
  { label: "CONFIGURAÇÕES", icon: "⚙" },
];

export class MenuScene extends Phaser.Scene {
  private selectedIndex = 0;
  private menuButtons: Phaser.GameObjects.Container[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private prevUpDown = false;
  private prevDownDown = false;
  private prevEnterDown = false;

  constructor() {
    super("MenuScene");
  }

  create() {
    // Full-screen reference art background (loaded from assets)
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "bg-menu")
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.drawBackground();
    this.drawTitle();
    this.drawMenuItems();
    this.drawTopBar();
    this.drawBottomBar();
    this.drawStats();

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.enterKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on("down", () => this.confirm());

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  private drawBackground() {
    const g = this.add.graphics();

    // Left panel — fully opaque to hide any UI baked into the background image
    g.fillStyle(BG_PANEL, 1);
    g.fillRect(0, 0, 320, GAME_HEIGHT);

    // Subtle scanline on left panel only
    g.lineStyle(1, 0x000000, 0.12);
    for (let y = 0; y < GAME_HEIGHT; y += 4) {
      g.lineBetween(0, y, 320, y);
    }

    // Top bar dark strip (covers the reference's icon row)
    g.fillStyle(0x000000, 0.6);
    g.fillRect(320, 0, GAME_WIDTH - 320, 44);

    // Bottom bar dark strip
    g.fillStyle(0x000000, 0.55);
    g.fillRect(320, GAME_HEIGHT - 48, GAME_WIDTH - 320, 48);

    // Left panel bottom gradient
    g.fillStyle(0x000000, 0.3);
    g.fillRect(0, GAME_HEIGHT - 80, 320, 80);
  }

  private drawTitle() {
    // Title background strip
    const g = this.add.graphics();
    g.fillStyle(ACCENT, 0.08);
    g.fillRect(12, 55, 296, 72);
    g.lineStyle(1, ACCENT, 0.2);
    g.strokeRect(12, 55, 296, 72);

    // Game title
    this.add.text(20, 65, "VIDA DO CLT", {
      fontFamily: "monospace",
      fontSize: "36px",
      fontStyle: "bold",
      color: TEXT_ACCENT,
      stroke: "#000000",
      strokeThickness: 4,
    });

    // Tagline
    this.add.text(20, 108, "— SOBREVIVA. PRODUZA. ESCAPE. —", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: TEXT_DIM,
      letterSpacing: 1,
    });
  }

  private drawMenuItems() {
    const startY = 170;
    const itemH = 44;

    this.menuButtons = [];

    MENU_ITEMS.forEach((item, i) => {
      const y = startY + i * itemH;
      const container = this.add.container(14, y);

      const bg = this.add.graphics();
      const label = this.add.text(42, 13, item.label, {
        fontFamily: "monospace",
        fontSize: "15px",
        fontStyle: "bold",
        color: TEXT_LIGHT,
      });
      const icon = this.add.text(14, 13, item.icon, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: TEXT_ACCENT,
      });

      container.add([bg, icon, label]);
      this.menuButtons.push(container);

      // Click handler
      const hitArea = this.add.rectangle(14 + 148, y + 18, 296, 38, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hitArea.on("pointerdown", () => {
        this.selectedIndex = i;
        this.refreshMenu();
        this.confirm();
      });
      hitArea.on("pointerover", () => {
        this.selectedIndex = i;
        this.refreshMenu();
      });
    });

    this.refreshMenu();
  }

  private refreshMenu() {
    const itemH = 44;
    MENU_ITEMS.forEach((_, i) => {
      const container = this.menuButtons[i];
      const bg = container.getAt(0) as Phaser.GameObjects.Graphics;
      const icon = container.getAt(1) as Phaser.GameObjects.Text;
      const label = container.getAt(2) as Phaser.GameObjects.Text;
      const selected = i === this.selectedIndex;

      bg.clear();
      if (selected) {
        bg.fillStyle(ACCENT, 1);
        bg.fillRect(0, 0, 296, itemH - 4);
        bg.lineStyle(2, 0xffffff, 0.2);
        bg.strokeRect(0, 0, 296, itemH - 4);
        label.setColor("#000000");
        label.setFontStyle("bold");
        icon.setColor("#000000");
      } else {
        bg.fillStyle(0x000000, 0.3);
        bg.fillRect(0, 0, 296, itemH - 4);
        bg.lineStyle(1, 0x444444, 0.5);
        bg.strokeRect(0, 0, 296, itemH - 4);
        label.setColor(TEXT_LIGHT);
        label.setFontStyle("normal");
        icon.setColor(TEXT_ACCENT);
      }
    });
  }

  private drawTopBar() {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.6);
    g.fillRect(0, 0, GAME_WIDTH, 44);
    g.lineStyle(1, 0x333333, 1);
    g.lineBetween(0, 44, GAME_WIDTH, 44);

    // Right side icon buttons
    const icons = ["💬", "📊", "🏆", "⚙"];
    icons.forEach((ic, i) => {
      const x = GAME_WIDTH - 40 - i * 36;
      const btn = this.add.text(x, 8, ic, {
        fontFamily: "monospace", fontSize: "18px",
      }).setInteractive({ useHandCursor: true });
      btn.on("pointerover", () => btn.setAlpha(0.7));
      btn.on("pointerout", () => btn.setAlpha(1));
    });
  }

  private drawBottomBar() {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.7);
    g.fillRect(0, GAME_HEIGHT - 48, GAME_WIDTH, 48);
    g.lineStyle(1, 0x333333, 1);
    g.lineBetween(0, GAME_HEIGHT - 48, GAME_WIDTH, GAME_HEIGHT - 48);

    // Left: Corporate News section
    const newsX = 8;
    g.fillStyle(0x222222, 1);
    g.fillRect(newsX, GAME_HEIGHT - 44, 300, 40);
    g.lineStyle(1, 0x444444, 1);
    g.strokeRect(newsX, GAME_HEIGHT - 44, 300, 40);

    // NPC icon placeholder
    g.fillStyle(0x3b8c5a, 1);
    g.fillRect(newsX + 4, GAME_HEIGHT - 41, 28, 34);
    g.fillStyle(0xe8d8c0, 1);
    g.fillRect(newsX + 9, GAME_HEIGHT - 41, 18, 16);

    this.add.text(newsX + 38, GAME_HEIGHT - 42, "CORPORATE NEWS", {
      fontFamily: "monospace", fontSize: "8px", color: TEXT_ACCENT,
    });
    this.add.text(newsX + 38, GAME_HEIGHT - 31, "Nova rota definida!\nProduzir mais. Reclamar menos.", {
      fontFamily: "monospace", fontSize: "8px", color: TEXT_DIM,
    });

    // Arrow
    this.add.text(newsX + 285, GAME_HEIGHT - 26, "►", {
      fontFamily: "monospace", fontSize: "10px", color: TEXT_ACCENT,
    }).setInteractive({ useHandCursor: true });

    // Right: Social + copyright
    this.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 44, "© 2025 Vida do CLT Inc. / Todos os direitos explorados.", {
      fontFamily: "monospace", fontSize: "8px", color: TEXT_DIM,
    }).setOrigin(1, 0);

    const socials = ["𝕏", "TK", "▶", "in"];
    socials.forEach((s, i) => {
      this.add.text(GAME_WIDTH - 180 + i * 30, GAME_HEIGHT - 25, s, {
        fontFamily: "monospace", fontSize: "12px", color: TEXT_DIM,
      }).setInteractive({ useHandCursor: true })
        .on("pointerover", (obj: Phaser.GameObjects.Text) => obj.setColor(TEXT_ACCENT))
        .on("pointerout", (obj: Phaser.GameObjects.Text) => obj.setColor(TEXT_DIM));
    });

    this.add.text(GAME_WIDTH - 195, GAME_HEIGHT - 42, "Siga-nos:", {
      fontFamily: "monospace", fontSize: "8px", color: TEXT_DIM,
    });
  }

  update(_time: number, _delta: number) {
    const upDown = this.cursors.up.isDown;
    const downDown = this.cursors.down.isDown;
    const enterDown = this.enterKey.isDown;

    if (upDown && !this.prevUpDown) {
      this.selectedIndex = (this.selectedIndex - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
      this.refreshMenu();
    }
    if (downDown && !this.prevDownDown) {
      this.selectedIndex = (this.selectedIndex + 1) % MENU_ITEMS.length;
      this.refreshMenu();
    }
    if (enterDown && !this.prevEnterDown) {
      this.confirm();
    }

    this.prevUpDown = upDown;
    this.prevDownDown = downDown;
    this.prevEnterDown = enterDown;
  }

  private drawStats() {
    const run = getRun(this);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.4);
    g.fillRect(12, 430, 296, 52);
    g.lineStyle(1, 0x333333, 0.7);
    g.strokeRect(12, 430, 296, 52);

    if (run.reconhecimento > 0 || run.loopCount > 0) {
      this.add.text(20, 437, "FICHA DO FUNCIONARIO", {
        fontFamily: "monospace", fontSize: "9px", color: TEXT_ACCENT,
      });
      this.add.text(20, 450, `Reconhecimento:  ${run.reconhecimento.toLocaleString("pt-BR")}`, {
        fontFamily: "monospace", fontSize: "11px", color: TEXT_LIGHT,
      });
      this.add.text(20, 464, `FGTS: ${run.fgts} pts   Loops: ${run.loopCount}`, {
        fontFamily: "monospace", fontSize: "10px", color: TEXT_DIM,
      });
    } else {
      this.add.text(154, 456, "Primeiro dia de trabalho.", {
        fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM,
      }).setOrigin(0.5);
    }
  }

  private confirm() {
    const item = MENU_ITEMS[this.selectedIndex];
    if (item.label === "JOGAR" || item.label === "JOGAR V2") {
      const run = getRun(this);
      run.v2Mode = item.label === "JOGAR V2";
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("ClassSelectScene");
      });
    }
    // Outros itens: no-op por enquanto (ranking, arsenal, conquistas, config)
  }
}
