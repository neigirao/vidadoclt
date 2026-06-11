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
const WINDOW_SKY1 = 0xcc4418;
const WINDOW_SKY2 = 0x28083a;

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

    // ── ROOM WALLS ────────────────────────────────────────────────
    // Right panel base (dark room)
    g.fillStyle(0x12131a, 1);
    g.fillRect(320, 44, GAME_WIDTH - 320, GAME_HEIGHT - 44);

    // ── CITY WINDOW (large, right side) ───────────────────────────
    const winX = 560, winY = 52, winW = 360, winH = 310;
    // Sunset sky layers
    g.fillStyle(0xcc4418, 1); g.fillRect(winX, winY,               winW, Math.floor(winH * 0.18));
    g.fillStyle(0xee6622, 1); g.fillRect(winX, winY + winH * 0.18, winW, Math.floor(winH * 0.16));
    g.fillStyle(0xd04a1a, 1); g.fillRect(winX, winY + winH * 0.34, winW, Math.floor(winH * 0.14));
    g.fillStyle(0x6a1e44, 1); g.fillRect(winX, winY + winH * 0.48, winW, Math.floor(winH * 0.22));
    g.fillStyle(0x28083a, 1); g.fillRect(winX, winY + winH * 0.70, winW, Math.floor(winH * 0.30));

    // Buildings silhouette
    const buildings: number[][] = [
      [570, 165, 32, 200], [608, 185, 26, 180], [640, 148, 44, 220],
      [692, 178, 30, 192], [728, 145, 50, 225], [786, 175, 28, 195],
      [820, 138, 52, 234], [880, 165, 36, 210], [570, 210, 20, 160],
      [728, 216, 22, 150], [882, 200, 20, 170],
    ];
    g.fillStyle(0x0a0c10, 1);
    for (const [bx, by, bw, bh] of buildings) {
      g.fillRect(bx, by, bw, bh);
      g.fillStyle(0xf0c04a, 0.55);
      for (let wx = bx + 4; wx < bx + bw - 4; wx += 9) {
        for (let wy = by + 8; wy < by + bh - 4; wy += 13) {
          if (Math.random() > 0.38) g.fillRect(wx, wy, 4, 6);
        }
      }
      g.fillStyle(0x0a0c10, 1);
    }
    // Window frame
    g.lineStyle(4, 0x1e1e28, 1);
    g.strokeRect(winX, winY, winW, winH);
    // window cross bars
    g.lineStyle(3, 0x1e1e28, 1);
    g.lineBetween(winX + winW / 2, winY, winX + winW / 2, winY + winH);
    g.lineBetween(winX, winY + winH * 0.5, winX + winW, winY + winH * 0.5);
    // window sill
    g.fillStyle(0x2a2830, 1);
    g.fillRect(winX - 6, winY + winH, winW + 12, 10);

    // ── FLOOR ─────────────────────────────────────────────────────
    g.fillStyle(0x16181e, 1);
    g.fillRect(320, 390, GAME_WIDTH - 320, GAME_HEIGHT - 390);
    g.lineStyle(2, 0x252830, 1);
    g.lineBetween(320, 390, GAME_WIDTH, 390);
    // floor planks hint
    g.lineStyle(1, 0x1c1e24, 0.6);
    for (let fx = 320; fx < GAME_WIDTH; fx += 48) {
      g.lineBetween(fx, 390, fx, GAME_HEIGHT);
    }

    // ── CEILING LIGHT ─────────────────────────────────────────────
    g.fillStyle(0x303038, 1);
    g.fillRect(470, 44, 6, 32);
    g.fillStyle(0xd4a830, 1);
    g.fillRect(452, 76, 42, 14);
    g.fillStyle(0x8a6820, 1);
    g.fillRect(458, 88, 30, 6);
    // Light cone
    for (let li = 0; li < 14; li++) {
      g.fillStyle(0xf0b830, 0.025 - li * 0.001);
      g.fillRect(473 - li * 9, 94 + li * 18, 6 + li * 18, 12);
    }

    // ── GLASS PARTITION + BOSS OFFICE (top right) ─────────────────
    const gpX = 870, gpY = 52, gpW = GAME_WIDTH - gpX, gpH = 340;
    g.fillStyle(0x1e3448, 0.18);
    g.fillRect(gpX, gpY, gpW, gpH);
    g.lineStyle(3, 0x3a6080, 0.6);
    g.strokeRect(gpX, gpY, gpW, gpH);
    g.lineStyle(1, 0x3a6080, 0.25);
    g.lineBetween(gpX + gpW / 3, gpY, gpX + gpW / 3, gpY + gpH);
    g.lineBetween(gpX + gpW * 2 / 3, gpY, gpX + gpW * 2 / 3, gpY + gpH);
    // Boss silhouette
    const bX = 884, bY = 178;
    g.fillStyle(0x14142a, 1);
    g.fillRect(bX + 11, bY - 38, 34, 38); // head
    g.fillStyle(0x1e1e34, 1);
    g.fillRect(bX, bY, 56, 80);            // body/suit
    g.fillStyle(0x2e2e44, 1);
    g.fillRect(bX + 4, bY, 12, 50);        // L lapel
    g.fillRect(bX + 40, bY, 12, 50);       // R lapel
    g.fillStyle(0xddd8cc, 1);
    g.fillRect(bX + 16, bY + 4, 24, 10);   // shirt collar
    g.fillStyle(0x9a1a1a, 1);
    g.fillRect(bX + 24, bY + 8, 8, 36);    // tie
    g.fillRect(bX + 22, bY + 30, 12, 8);   // tie wide part
    g.fillStyle(0x111120, 1);
    g.fillRect(bX + 14, bY - 24, 8, 5);    // glasses L
    g.fillRect(bX + 25, bY - 24, 8, 5);    // glasses R
    this.add.text(bX + 28, bY - 55, "CEO", {
      fontFamily: "monospace", fontSize: "12px", color: "#cc2222",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5);
    // "RESULTADOS\nNÃO DESCULPAS" poster in boss room
    this.add.text(bX + 28, bY + 100, "RESULTADOS\nNÃO DESCULPAS", {
      fontFamily: "monospace", fontSize: "7px", color: "#443322", align: "center",
    }).setOrigin(0.5);

    // ── MOTIVATIONAL POSTER ───────────────────────────────────────
    g.fillStyle(0x201a14, 1);
    g.fillRect(336, 72, 86, 56);
    g.lineStyle(1, 0x403020, 1);
    g.strokeRect(336, 72, 86, 56);
    this.add.text(379, 100, "FOCO\nDISCIPLINA\nEXECUÇÃO", {
      fontFamily: "monospace", fontSize: "8px", color: "#665544", align: "center",
    }).setOrigin(0.5);

    // ── EXIT SIGN ─────────────────────────────────────────────────
    const exitX = 778, exitY = 98;
    g.fillStyle(0x00aa00, 0.12);
    g.fillRect(exitX - 4, exitY - 4, 68, 30);
    g.fillStyle(0x123a12, 1);
    g.fillRect(exitX, exitY, 60, 22);
    g.lineStyle(2, 0x44cc44, 1);
    g.strokeRect(exitX, exitY, 60, 22);
    // person icon
    g.fillStyle(0x44cc44, 1);
    g.fillRect(exitX + 5, exitY + 7, 7, 10);
    g.fillRect(exitX + 7, exitY + 3, 5, 5);
    g.fillRect(exitX + 4, exitY + 15, 3, 5);
    g.fillRect(exitX + 9, exitY + 15, 3, 5);
    this.add.text(exitX + 42, exitY + 11, "SAÍDA ►", {
      fontFamily: "monospace", fontSize: "8px", color: "#44cc44", fontStyle: "bold",
    }).setOrigin(0.5);

    // ── NOTIFICATION POPUP ────────────────────────────────────────
    const nX = 628, nY = 88;
    g.fillStyle(0x000000, 0.5);
    g.fillRect(nX + 4, nY + 4, 148, 64);
    g.fillStyle(0x0e1e0e, 0.96);
    g.fillRect(nX, nY, 148, 64);
    g.lineStyle(2, 0x44aa44, 0.9);
    g.strokeRect(nX, nY, 148, 64);
    g.fillStyle(0xcc1111, 1);
    g.fillCircle(nX + 148 - 11, nY + 11, 11);
    this.add.text(nX + 137, nY + 11, "999", {
      fontFamily: "monospace", fontSize: "7px", color: "#ffffff",
    }).setOrigin(0.5);
    this.add.text(nX + 74, nY + 34, "+999 NOVOS E-MAILS\nREUNIÃO EM 5 MIN\nIMPORTANTE!!!!", {
      fontFamily: "monospace", fontSize: "9px", color: "#88cc88", align: "center",
    }).setOrigin(0.5);

    // ── DESK ──────────────────────────────────────────────────────
    const dX = 440, dY = 358;
    // desk top surface
    g.fillStyle(0x4a3828, 1);
    g.fillRect(dX, dY, 310, 22);
    g.fillStyle(0x5c4a38, 1);
    g.fillRect(dX + 2, dY + 2, 306, 5);
    // desk front
    g.fillStyle(0x3a2a1c, 1);
    g.fillRect(dX + 10, dY + 22, 290, 32);
    // desk legs
    g.fillStyle(0x2c1e14, 1);
    g.fillRect(dX + 10, dY + 52, 18, 22);
    g.fillRect(dX + 282, dY + 52, 18, 22);

    // ── DESK LAMP ─────────────────────────────────────────────────
    // lamp glow on desk surface
    g.fillStyle(0xe8a820, 0.10);
    g.fillRect(dX - 10, dY - 100, 200, 120);
    // pole
    g.fillStyle(0x4a4a4a, 1);
    g.fillRect(dX + 32, dY - 88, 5, 90);
    // arm
    g.fillRect(dX + 32, dY - 88, 38, 5);
    // shade
    g.fillStyle(0xcc9920, 1);
    g.fillRect(dX + 60, dY - 100, 40, 14);
    g.fillStyle(0x886410, 1);
    g.fillRect(dX + 65, dY - 88, 30, 8);
    // bulb glow
    g.fillStyle(0xffffaa, 0.4);
    g.fillRect(dX + 74, dY - 84, 12, 5);

    // ── MONITOR ───────────────────────────────────────────────────
    g.fillStyle(0x1e1e1e, 1);
    g.fillRect(dX + 125, dY - 88, 115, 78);
    g.fillStyle(0x102010, 1);
    g.fillRect(dX + 129, dY - 84, 107, 64);
    // screen content (green terminal)
    g.fillStyle(0x22aa22, 1);
    g.fillRect(dX + 130, dY - 83, 105, 14);
    this.add.text(dX + 183, dY - 76, "ENTRADA", {
      fontFamily: "monospace", fontSize: "7px", color: "#000000",
    }).setOrigin(0.5);
    g.fillStyle(0x44cc44, 0.8);
    g.fillRect(dX + 131, dY - 67, 70, 4);
    g.fillRect(dX + 131, dY - 60, 90, 4);
    g.fillRect(dX + 131, dY - 53, 55, 4);
    g.fillRect(dX + 131, dY - 46, 80, 4);
    g.fillRect(dX + 131, dY - 39, 44, 4);
    // cursor blink
    g.fillStyle(0x44cc44, 1);
    g.fillRect(dX + 131, dY - 32, 6, 8);
    // monitor stand
    g.fillStyle(0x2a2a2a, 1);
    g.fillRect(dX + 174, dY - 12, 18, 14);
    g.fillRect(dX + 164, dY, 38, 6);

    // ── KEYBOARD ──────────────────────────────────────────────────
    g.fillStyle(0x252525, 1);
    g.fillRect(dX + 115, dY + 4, 130, 16);
    g.fillStyle(0x353535, 1);
    for (let ki = 0; ki < 12; ki++) {
      for (let kj = 0; kj < 3; kj++) {
        g.fillRect(dX + 117 + ki * 10, dY + 6 + kj * 4, 7, 3);
      }
    }

    // ── COFFEE MUG ────────────────────────────────────────────────
    g.fillStyle(0x3a2818, 1);
    g.fillRect(dX + 76, dY - 26, 24, 28);
    g.fillStyle(0x2a1808, 1);
    g.fillRect(dX + 98, dY - 18, 7, 14);
    g.fillStyle(0x5a3018, 1);
    g.fillRect(dX + 78, dY - 22, 20, 10);

    // ── PAPER STACKS on desk ──────────────────────────────────────
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0xd8caa0 - i * 0x060502, 1);
      g.fillRect(dX + 272 - i, dY - 14 + i * 2, 64, 4);
    }

    // ── PLANT ─────────────────────────────────────────────────────
    // pot
    g.fillStyle(0x5a3828, 1);
    g.fillRect(dX - 28, dY - 12, 24, 24);
    g.fillStyle(0x482e20, 1);
    g.fillRect(dX - 26, dY + 6, 20, 6);
    // soil
    g.fillStyle(0x2a1a0e, 1);
    g.fillRect(dX - 26, dY - 8, 20, 6);
    // leaves
    g.fillStyle(0x1a5c10, 1);
    g.fillRect(dX - 20, dY - 38, 6, 28);
    g.fillStyle(0x2a7a1a, 1);
    g.fillRect(dX - 36, dY - 58, 12, 34);
    g.fillRect(dX - 14, dY - 62, 10, 32);
    g.fillRect(dX - 4,  dY - 48, 12, 26);
    g.fillStyle(0x3a9a28, 1);
    g.fillRect(dX - 44, dY - 46, 10, 18);
    g.fillRect(dX + 4,  dY - 36, 10, 14);
    // highlight
    g.fillStyle(0x50cc38, 0.4);
    g.fillRect(dX - 32, dY - 52, 4, 10);
    g.fillRect(dX - 10, dY - 56, 3, 12);

    // ── PAPERS ON FLOOR ───────────────────────────────────────────
    g.fillStyle(0xc8ba94, 0.75);
    g.fillRect(dX - 55, 391, 48, 3);
    g.fillRect(dX - 70, 393, 35, 2);
    g.fillRect(dX - 48, 395, 28, 2);
    g.fillStyle(0xb8a880, 0.55);
    g.fillRect(dX + 330, 391, 42, 3);
    g.fillRect(dX + 348, 394, 28, 2);
    g.fillRect(dX + 322, 394, 18, 2);

    // ── PLAYER CHARACTER (uses generated sprite texture) ──────────
    const pX = 480, pY = 390;
    // Shadow under player
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(pX, pY + 3, 58, 9);
    // Player sprite (tex-player-idle scaled 2×)
    this.add.image(pX, pY, "tex-player-idle").setScale(2).setOrigin(0.5, 1);
    // Briefcase (drawn after image so it appears in front via new graphics)
    const g2 = this.add.graphics();
    g2.fillStyle(0x5a3818, 1);
    g2.fillRect(pX + 36, pY - 40, 22, 16);
    g2.fillStyle(0x7a5830, 1);
    g2.fillRect(pX + 39, pY - 44, 16, 5);
    g2.lineStyle(1, 0x3a2210, 0.8);
    g2.strokeRect(pX + 36, pY - 40, 22, 16);
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
        this.scene.start("ClassSelectScene");
      });
    }
    // Outros itens: no-op por enquanto (ranking, arsenal, conquistas, config)
  }
}
