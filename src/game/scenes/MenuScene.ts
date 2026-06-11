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
    // Layout constants — all positioned to make the room feel like an indoor space
    // Right panel: x=320–960, y=44–540
    // Ceiling: y=44–128 (84px dark ceiling above window)
    // Window opening: x=530–855, y=128–358 (325×230 px framed view of city)
    // Glass partition (boss): x=855–960, y=128–395
    // Wall below window: y=358–395 (37px wall strip)
    // Floor: y=395–540
    const WIN_X = 530, WIN_Y = 128, WIN_W = 325, WIN_H = 230;
    const FLOOR_Y = 395;
    const GP_X = 855; // glass partition x

    const g = this.add.graphics();

    // ── BASE: DARK ROOM ───────────────────────────────────────────
    g.fillStyle(0x10121a, 1);
    g.fillRect(320, 44, GAME_WIDTH - 320, GAME_HEIGHT - 44);

    // ── CITY WINDOW — framed opening in the wall ──────────────────
    // Sky gradient inside the window rectangle only
    g.fillStyle(0xcc4418, 1); g.fillRect(WIN_X, WIN_Y,                    WIN_W, Math.floor(WIN_H * 0.20));
    g.fillStyle(0xee6a22, 1); g.fillRect(WIN_X, WIN_Y + WIN_H * 0.20,     WIN_W, Math.floor(WIN_H * 0.15));
    g.fillStyle(0xd04a1a, 1); g.fillRect(WIN_X, WIN_Y + WIN_H * 0.35,     WIN_W, Math.floor(WIN_H * 0.15));
    g.fillStyle(0x6a1e44, 1); g.fillRect(WIN_X, WIN_Y + WIN_H * 0.50,     WIN_W, Math.floor(WIN_H * 0.22));
    g.fillStyle(0x28083a, 1); g.fillRect(WIN_X, WIN_Y + WIN_H * 0.72,     WIN_W, Math.floor(WIN_H * 0.28));

    // City buildings silhouette — clamped inside window bounds
    const buildings: number[][] = [
      [534, 186, 30, 172], [568, 202, 24, 156], [596, 170, 40, 188],
      [640, 194, 28, 164], [672, 162, 46, 196], [722, 188, 26, 170],
      [752, 154, 48, 204], [804, 178, 30, 180], [534, 224, 18, 134],
      [684, 210, 20, 148], [798, 196, 22, 162],
    ];
    g.fillStyle(0x0a0c10, 1);
    for (const [bx, by, bw, bh] of buildings) {
      const cx = Math.max(WIN_X, bx);
      const cr = Math.min(WIN_X + WIN_W, bx + bw);
      if (cr <= cx) continue;
      g.fillRect(cx, Math.max(WIN_Y, by), cr - cx, bh);
      g.fillStyle(0xf0c04a, 0.5);
      for (let wx = cx + 4; wx < cr - 4; wx += 9) {
        for (let wy = Math.max(WIN_Y + 8, by + 8); wy < Math.min(WIN_Y + WIN_H - 4, by + bh - 4); wy += 13) {
          if (Math.random() > 0.38) g.fillRect(wx, wy, 4, 5);
        }
      }
      g.fillStyle(0x0a0c10, 1);
    }

    // Window frame (drawn on top of sky/buildings)
    g.fillStyle(0x22202a, 1);
    g.fillRect(WIN_X - 6, WIN_Y - 6, WIN_W + 12, 6);   // top border
    g.fillRect(WIN_X - 6, WIN_Y + WIN_H, WIN_W + 12, 8); // bottom sill
    g.fillRect(WIN_X - 6, WIN_Y, 6, WIN_H);              // left border
    g.fillRect(WIN_X + WIN_W, WIN_Y, 6, WIN_H);          // right border
    // cross bars
    g.fillStyle(0x1c1a24, 1);
    g.fillRect(WIN_X + WIN_W / 2 - 2, WIN_Y, 4, WIN_H);
    g.fillRect(WIN_X, WIN_Y + WIN_H / 2 - 2, WIN_W, 4);

    // ── WALL OVERLAY — covers areas outside window opening ────────
    // This ensures dark walls are clearly visible around the window
    // Left wall (no sky bleeds here)
    g.fillStyle(0x13141c, 1);
    g.fillRect(320, 44, WIN_X - 320, GAME_HEIGHT - 44);
    // Ceiling strip above window
    g.fillRect(WIN_X - 6, 44, WIN_W + 12, WIN_Y - 44);
    // Wall below window to floor
    g.fillRect(320, WIN_Y + WIN_H + 8, GP_X - 320, FLOOR_Y - (WIN_Y + WIN_H + 8));
    // Floor
    g.fillRect(320, FLOOR_Y, GAME_WIDTH - 320, GAME_HEIGHT - FLOOR_Y);

    // Floor surface line
    g.lineStyle(2, 0x242630, 1);
    g.lineBetween(320, FLOOR_Y, GAME_WIDTH, FLOOR_Y);
    // floor planks
    g.lineStyle(1, 0x1c1e26, 0.5);
    for (let fx = 344; fx < GAME_WIDTH; fx += 52) {
      g.lineBetween(fx, FLOOR_Y, fx, GAME_HEIGHT);
    }

    // Subtle wall texture lines
    g.lineStyle(1, 0x181a22, 0.4);
    g.lineBetween(320, 44, 320, GAME_HEIGHT);   // room left edge

    // ── CEILING LAMP ─────────────────────────────────────────────
    const lampX = 490;
    g.fillStyle(0x383840, 1);
    g.fillRect(lampX - 2, 44, 4, 34);           // cord
    g.fillStyle(0xd4a02a, 1);
    g.fillRect(lampX - 22, 78, 44, 14);         // shade outer
    g.fillStyle(0x8a6418, 1);
    g.fillRect(lampX - 16, 90, 32, 7);          // shade bottom
    g.fillStyle(0xffeeaa, 0.6);
    g.fillRect(lampX - 8, 85, 16, 6);           // bulb glow
    // soft light cone
    for (let li = 0; li < 12; li++) {
      g.fillStyle(0xf0a820, 0.018 - li * 0.001);
      g.fillRect(lampX - 6 - li * 10, 97 + li * 20, 12 + li * 20, 14);
    }

    // ── GLASS PARTITION + BOSS OFFICE ────────────────────────────
    const gpW = GAME_WIDTH - GP_X;
    g.fillStyle(0x182030, 0.22);
    g.fillRect(GP_X, WIN_Y, gpW, WIN_H + FLOOR_Y - WIN_Y - WIN_H);
    g.lineStyle(3, 0x385870, 0.65);
    g.strokeRect(GP_X, WIN_Y, gpW, FLOOR_Y - WIN_Y);
    g.lineStyle(1, 0x385870, 0.2);
    g.lineBetween(GP_X + gpW / 3, WIN_Y, GP_X + gpW / 3, FLOOR_Y);
    g.lineBetween(GP_X + gpW * 2 / 3, WIN_Y, GP_X + gpW * 2 / 3, FLOOR_Y);
    // Boss
    const bX = GP_X + 12, bY = 228;
    g.fillStyle(0x12122a, 1);
    g.fillRect(bX + 10, bY - 36, 32, 36);   // head
    g.fillStyle(0x1e2038, 1);
    g.fillRect(bX, bY, 52, 78);              // body/suit
    g.fillStyle(0x2c2e44, 1);
    g.fillRect(bX + 3, bY, 11, 48);         // L lapel
    g.fillRect(bX + 38, bY, 11, 48);        // R lapel
    g.fillStyle(0xddd4c4, 1);
    g.fillRect(bX + 14, bY + 4, 24, 10);    // shirt
    g.fillStyle(0x9a1818, 1);
    g.fillRect(bX + 22, bY + 8, 8, 32);     // tie
    g.fillRect(bX + 20, bY + 28, 12, 8);    // tie wide
    g.fillStyle(0x0e0e1e, 1);
    g.fillRect(bX + 13, bY - 22, 8, 5);     // glasses L
    g.fillRect(bX + 23, bY - 22, 8, 5);     // glasses R
    this.add.text(GP_X + gpW / 2, bY - 52, "CEO", {
      fontFamily: "monospace", fontSize: "11px", color: "#cc2222",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5);

    // ── MOTIVATIONAL POSTER (left wall, ceiling area) ─────────────
    g.fillStyle(0x1c1710, 1);
    g.fillRect(334, 66, 82, 54);
    g.lineStyle(1, 0x3a2e1e, 1);
    g.strokeRect(334, 66, 82, 54);
    this.add.text(375, 93, "FOCO\nDISCIPLINA\nEXECUÇÃO", {
      fontFamily: "monospace", fontSize: "8px", color: "#5a4433", align: "center",
    }).setOrigin(0.5);

    // ── EXIT SIGN (ceiling strip, right of center) ────────────────
    const exitX = 800, exitY = 96;
    g.fillStyle(0x003a00, 0.3);
    g.fillRect(exitX - 5, exitY - 5, 66, 28);
    g.fillStyle(0x112811, 1);
    g.fillRect(exitX, exitY, 56, 20);
    g.lineStyle(2, 0x44cc44, 1);
    g.strokeRect(exitX, exitY, 56, 20);
    g.fillStyle(0x44cc44, 1);
    g.fillRect(exitX + 5, exitY + 6, 6, 9);
    g.fillRect(exitX + 7, exitY + 3, 4, 4);
    g.fillRect(exitX + 4, exitY + 14, 3, 5);
    g.fillRect(exitX + 9, exitY + 14, 3, 5);
    this.add.text(exitX + 40, exitY + 10, "SAÍDA ►", {
      fontFamily: "monospace", fontSize: "8px", color: "#44cc44", fontStyle: "bold",
    }).setOrigin(0.5);

    // ── NOTIFICATION POPUP (inside window, floats above buildings) ─
    const nX = 624, nY = WIN_Y + 16;
    g.fillStyle(0x000000, 0.45);
    g.fillRect(nX + 4, nY + 4, 150, 64);
    g.fillStyle(0x0c1c0c, 0.97);
    g.fillRect(nX, nY, 150, 64);
    g.lineStyle(2, 0x44aa44, 0.9);
    g.strokeRect(nX, nY, 150, 64);
    g.fillStyle(0xcc1111, 1);
    g.fillCircle(nX + 150 - 11, nY + 11, 11);
    this.add.text(nX + 139, nY + 11, "999", {
      fontFamily: "monospace", fontSize: "7px", color: "#ffffff",
    }).setOrigin(0.5);
    this.add.text(nX + 75, nY + 34, "+999 NOVOS E-MAILS\nREUNIÃO EM 5 MIN\nIMPORTANTE!!!!", {
      fontFamily: "monospace", fontSize: "9px", color: "#88cc88", align: "center",
    }).setOrigin(0.5);

    // ── DESK ─────────────────────────────────────────────────────
    const dX = 430, dY = WIN_Y + WIN_H;  // desk top sits at window bottom
    // desk top surface
    g.fillStyle(0x4a3828, 1);
    g.fillRect(dX, dY, 320, 20);
    g.fillStyle(0x5c4a38, 1);
    g.fillRect(dX + 2, dY + 2, 316, 5);
    // desk front face
    g.fillStyle(0x3a2a1c, 1);
    g.fillRect(dX + 8, dY + 20, 304, 34);
    g.fillStyle(0x2c1e14, 1);
    // desk legs
    g.fillRect(dX + 8,  dY + 52, 18, FLOOR_Y - (dY + 52));
    g.fillRect(dX + 294, dY + 52, 18, FLOOR_Y - (dY + 52));

    // ── DESK LAMP ────────────────────────────────────────────────
    // warm glow on desk
    g.fillStyle(0xd89018, 0.09);
    g.fillRect(dX + 20, dY - 95, 180, 100);
    // pole (rises from desk surface)
    g.fillStyle(0x484848, 1);
    g.fillRect(dX + 38, dY - 82, 5, 84);
    // arm pointing right
    g.fillRect(dX + 38, dY - 82, 34, 5);
    // shade
    g.fillStyle(0xcc9918, 1);
    g.fillRect(dX + 62, dY - 96, 38, 14);
    g.fillStyle(0x886010, 1);
    g.fillRect(dX + 67, dY - 84, 28, 7);
    g.fillStyle(0xffeeaa, 0.5);
    g.fillRect(dX + 74, dY - 80, 12, 4);

    // ── MONITOR ──────────────────────────────────────────────────
    g.fillStyle(0x1c1c1c, 1);
    g.fillRect(dX + 130, dY - 92, 118, 80);
    g.fillStyle(0x0e1e0e, 1);
    g.fillRect(dX + 134, dY - 88, 110, 66);
    // header bar
    g.fillStyle(0x22aa22, 1);
    g.fillRect(dX + 135, dY - 87, 108, 14);
    this.add.text(dX + 189, dY - 80, "ENTRADA", {
      fontFamily: "monospace", fontSize: "7px", color: "#000000",
    }).setOrigin(0.5);
    // terminal lines
    g.fillStyle(0x44cc44, 0.8);
    for (let li = 0; li < 5; li++) {
      g.fillRect(dX + 136, dY - 71 + li * 9, 50 + li * 12 * (li % 2 === 0 ? 1 : -0.4), 4);
    }
    g.fillStyle(0x44cc44, 1); g.fillRect(dX + 136, dY - 26, 6, 8); // cursor
    // stand
    g.fillStyle(0x282828, 1);
    g.fillRect(dX + 181, dY - 14, 18, 16);
    g.fillRect(dX + 171, dY, 38, 6);

    // ── KEYBOARD ─────────────────────────────────────────────────
    g.fillStyle(0x242424, 1);
    g.fillRect(dX + 118, dY + 4, 136, 16);
    g.fillStyle(0x343434, 1);
    for (let ki = 0; ki < 12; ki++) {
      for (let kj = 0; kj < 3; kj++) {
        g.fillRect(dX + 121 + ki * 10, dY + 6 + kj * 4, 8, 3);
      }
    }

    // ── COFFEE MUG ───────────────────────────────────────────────
    g.fillStyle(0x382618, 1);
    g.fillRect(dX + 80, dY - 26, 22, 28);
    g.fillStyle(0x281408, 1);
    g.fillRect(dX + 100, dY - 18, 7, 14);     // handle
    g.fillStyle(0x583018, 1);
    g.fillRect(dX + 82, dY - 22, 18, 10);     // liquid

    // ── PAPER STACKS on desk ─────────────────────────────────────
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0xd8c89e - i * 0x060500, 1);
      g.fillRect(dX + 280 - i, dY - 12 + i * 2, 64, 4);
    }

    // ── PLANT (left of desk, against wall) ───────────────────────
    const pLX = dX - 24;
    // pot
    g.fillStyle(0x5a3826, 1);
    g.fillRect(pLX, dY - 8, 26, 26);
    g.fillStyle(0x462c1c, 1);
    g.fillRect(pLX + 2, dY + 10, 22, 6);
    g.fillStyle(0x281608, 1);
    g.fillRect(pLX + 2, dY - 4, 22, 6);        // soil
    // stem + leaves
    g.fillStyle(0x186010, 1);
    g.fillRect(pLX + 10, dY - 46, 6, 40);
    g.fillStyle(0x287820, 1);
    g.fillRect(pLX - 12, dY - 70, 14, 36);
    g.fillRect(pLX + 8, dY - 76, 12, 34);
    g.fillRect(pLX + 20, dY - 60, 14, 28);
    g.fillStyle(0x3a9a2a, 1);
    g.fillRect(pLX - 18, dY - 54, 10, 18);
    g.fillRect(pLX + 26, dY - 44, 10, 16);
    g.fillStyle(0x50cc3a, 0.35);
    g.fillRect(pLX - 8, dY - 64, 4, 12);
    g.fillRect(pLX + 12, dY - 70, 4, 14);

    // ── PAPERS ON FLOOR ──────────────────────────────────────────
    g.fillStyle(0xc4b690, 0.72);
    g.fillRect(dX - 60, FLOOR_Y + 2, 50, 3);
    g.fillRect(dX - 72, FLOOR_Y + 5, 36, 2);
    g.fillRect(dX - 52, FLOOR_Y + 7, 28, 2);
    g.fillStyle(0xb4a47e, 0.55);
    g.fillRect(dX + 348, FLOOR_Y + 2, 44, 3);
    g.fillRect(dX + 360, FLOOR_Y + 5, 28, 2);
    g.fillRect(dX + 338, FLOOR_Y + 5, 18, 2);

    // ── PLAYER CHARACTER ─────────────────────────────────────────
    const pX = 484, pY = FLOOR_Y;
    // shadow
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(pX, pY + 3, 55, 9);
    // sprite (tex-player-idle at 2× — 64×96 px)
    this.add.image(pX, pY, "tex-player-idle").setScale(2).setOrigin(0.5, 1);
    // briefcase beside player
    const g2 = this.add.graphics();
    g2.fillStyle(0x583618, 1);
    g2.fillRect(pX + 34, pY - 38, 22, 17);
    g2.fillStyle(0x7a5630, 1);
    g2.fillRect(pX + 37, pY - 43, 16, 6);
    g2.lineStyle(1, 0x381e08, 0.8);
    g2.strokeRect(pX + 34, pY - 38, 22, 17);
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
