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
const WINDOW_SKY1 = 0x8b3a1a;
const WINDOW_SKY2 = 0x3a1a3a;

const MENU_ITEMS = [
  { label: "JOGAR", icon: "▶" },
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
    this.drawBackground();
    this.drawOfficeScene();
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

    // Base dark background
    g.fillStyle(BG_PANEL, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Left panel (menu area)
    g.fillStyle(BG_MENU, 0.95);
    g.fillRect(0, 0, 320, GAME_HEIGHT);

    // Subtle scanline overlay
    g.lineStyle(1, 0x000000, 0.15);
    for (let y = 0; y < GAME_HEIGHT; y += 4) {
      g.lineBetween(0, y, GAME_WIDTH, y);
    }

    // Left panel bottom gradient hint
    g.fillStyle(0x000000, 0.3);
    g.fillRect(0, GAME_HEIGHT - 80, 320, 80);
  }

  private drawOfficeScene() {
    const g = this.add.graphics();

    // Main window behind the scene (city/sunset)
    const winX = 390, winY = 50, winW = 500, winH = 350;
    // Sky gradient (simulate with rects)
    g.fillStyle(WINDOW_SKY1, 1);
    g.fillRect(winX, winY, winW, winH * 0.55);
    g.fillStyle(WINDOW_SKY2, 1);
    g.fillRect(winX, winY + winH * 0.55, winW, winH * 0.45);

    // City buildings silhouette
    const buildings = [
      [400, 180, 40, 220], [450, 200, 30, 200], [490, 160, 50, 240],
      [550, 190, 35, 210], [595, 170, 45, 230], [650, 200, 30, 200],
      [690, 155, 55, 245], [755, 185, 40, 215], [805, 175, 35, 225],
      [850, 200, 40, 200], [700, 220, 25, 180], [600, 210, 20, 190],
    ];
    g.fillStyle(0x0d0f14, 1);
    for (const [bx, by, bw, bh] of buildings) {
      g.fillRect(bx, by, bw, bh);
      // window lights
      g.fillStyle(0xf2c14e, 0.5);
      for (let wx = bx + 5; wx < bx + bw - 5; wx += 10) {
        for (let wy = by + 10; wy < by + bh - 5; wy += 14) {
          if (Math.random() > 0.4) g.fillRect(wx, wy, 4, 6);
        }
      }
      g.fillStyle(0x0d0f14, 1);
    }

    // Floor of office scene
    g.fillStyle(0x1a1d23, 1);
    g.fillRect(320, 400, GAME_WIDTH - 320, GAME_HEIGHT - 400);

    // Desk
    g.fillStyle(0x3a2e20, 1);
    g.fillRect(480, 370, 220, 18);
    g.fillStyle(0x2e2418, 1);
    g.fillRect(490, 388, 200, 80);

    // Monitor on desk
    g.fillStyle(0x111418, 1);
    g.fillRect(540, 310, 110, 70);
    g.fillStyle(0x1a2a1a, 1);
    g.fillRect(545, 315, 100, 58);
    // Screen content (email notification)
    g.fillStyle(0x22aa22, 1);
    g.fillRect(547, 317, 96, 14);
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(547, 333, 60, 6);
    g.fillRect(547, 341, 80, 6);
    g.fillRect(547, 349, 40, 6);
    // Monitor stand
    g.fillStyle(0x222222, 1);
    g.fillRect(587, 380, 16, 10);

    // Stacks of papers on desk
    for (let i = 0; i < 5; i++) {
      g.fillStyle(0xddd0b0 - i * 0x050402, 1);
      g.fillRect(680 - i, 355 + i * 2, 60, 4);
    }

    // Coffee mug
    g.fillStyle(0x4a3020, 1);
    g.fillRect(510, 356, 22, 20);
    g.fillStyle(0x6b3a1a, 1);
    g.fillRect(512, 358, 18, 8);

    // Boss figure (top right, through glass partition)
    const bossX = 820, bossY = 160;
    // Glass partition
    g.fillStyle(0x3a5a7a, 0.25);
    g.fillRect(780, 60, 120, 320);
    g.lineStyle(2, 0x5a8aaa, 0.5);
    g.strokeRect(780, 60, 120, 320);
    // Boss silhouette
    g.fillStyle(0x1a1a2a, 1);
    g.fillRect(bossX, bossY, 50, 65);         // body
    g.fillRect(bossX + 10, bossY - 28, 30, 30); // head
    // Tie
    g.fillStyle(0x8a1a1a, 1);
    g.fillRect(bossX + 20, bossY + 5, 10, 30);
    // "CEO" label above
    this.add.text(bossX + 25, bossY - 45, "CEO", {
      fontFamily: "monospace", fontSize: "10px", color: "#cc3333",
    }).setOrigin(0.5);

    // "SAÍDA" exit sign
    const exitX = 730, exitY = 95;
    g.fillStyle(0x1a4a1a, 1);
    g.fillRect(exitX, exitY, 58, 24);
    g.lineStyle(1, 0x44aa44, 1);
    g.strokeRect(exitX, exitY, 58, 24);
    this.add.text(exitX + 29, exitY + 12, "SAÍDA  ►", {
      fontFamily: "monospace", fontSize: "10px", color: "#44cc44",
    }).setOrigin(0.5);

    // Notification popup on wall
    const notifX = 620, notifY = 90;
    g.fillStyle(0x1a2a1a, 0.9);
    g.fillRect(notifX, notifY, 150, 60);
    g.lineStyle(1, 0x44aa44, 0.8);
    g.strokeRect(notifX, notifY, 150, 60);
    // Badge
    g.fillStyle(0xcc2222, 1);
    g.fillCircle(notifX + 150 - 10, notifY + 10, 10);
    this.add.text(notifX + 140, notifY + 10, "999", {
      fontFamily: "monospace", fontSize: "8px", color: "#ffffff",
    }).setOrigin(0.5);
    this.add.text(notifX + 75, notifY + 22, "+999 NOVOS E-MAILS\nREUNIÃO EM 5 MIN\nIMPORTANTE!!!!", {
      fontFamily: "monospace", fontSize: "9px", color: "#88cc88", align: "center",
    }).setOrigin(0.5);

    // Motivational poster
    g.fillStyle(0x2a2020, 1);
    g.fillRect(340, 70, 90, 60);
    g.lineStyle(1, 0x4a3a3a, 1);
    g.strokeRect(340, 70, 90, 60);
    this.add.text(385, 100, "FOCO\nDISCIPLINA\nEXECUÇÃO", {
      fontFamily: "monospace", fontSize: "8px", color: "#886666", align: "center",
    }).setOrigin(0.5);

    // Player character silhouette (briefcase guy)
    const pX = 450, pY = 390;
    g.fillStyle(0xc8c0b0, 1);
    g.fillRect(pX, pY - 70, 28, 38);          // body (shirt)
    g.fillStyle(0x2a2a3a, 1);
    g.fillRect(pX + 2, pY - 32, 24, 32);       // pants
    g.fillStyle(0xe8d8c0, 1);
    g.fillRect(pX + 6, pY - 96, 16, 18);       // head
    g.fillStyle(0x1a1a2a, 1);
    g.fillRect(pX - 4, pY - 20, 10, 20);       // left leg
    g.fillRect(pX + 22, pY - 20, 10, 20);      // right leg
    // Briefcase
    g.fillStyle(0x5a3a1a, 1);
    g.fillRect(pX + 28, pY - 40, 18, 14);
    g.fillStyle(0x7a5a3a, 1);
    g.fillRect(pX + 31, pY - 43, 12, 4);
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
    if (item.label === "JOGAR") {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("OpenSpaceScene");
      });
    }
    // Outros itens: no-op por enquanto (ranking, arsenal, conquistas, config)
  }
}
