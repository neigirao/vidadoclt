import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../constants";
import { getRun } from "../systems/PlayerState";
import { Music } from "../systems/MusicSystem";
import { WEAPONS } from "../systems/WeaponSystem";
import { PERKS } from "../systems/PerkSystem";

const ACCENT = 0xf2a800;
const ACCENT_DIM = 0xb87a00;
const TEXT_LIGHT = "#eaeaea";
const TEXT_DIM = "#888888";
const TEXT_ACCENT = "#f2a800";
const BG_PANEL = 0x12151a;
const BG_MENU = 0x1a1d23;

const MENU_ITEMS = [
  { label: "JOGAR", icon: "▶" },
  { label: "EVOLUÇÃO", icon: "⭐" },
  { label: "RANKING", icon: "🏆" },
  { label: "BESTIARIO", icon: "👾" },
  { label: "ARSENAL", icon: "🎒" },
  { label: "CONQUISTAS", icon: "★" },
  { label: "CONFIGURAÇÕES", icon: "⚙" },
];

export class MenuScene extends Phaser.Scene {
  private selectedIndex = 0;
  private menuButtons: Phaser.GameObjects.Container[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;
  private prevUpDown = false;
  private prevDownDown = false;
  private prevEnterDown = false;
  private overlay?: Phaser.GameObjects.Container;

  constructor() {
    super("MenuScene");
  }

  create() {
    Music.start("office");
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
    this.escKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
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
    const escDown = this.escKey.isDown;

    if (this.overlay) {
      // Overlay open — ESC closes it
      if (escDown) this.hideOverlay();
      this.prevUpDown = upDown;
      this.prevDownDown = downDown;
      this.prevEnterDown = enterDown;
      return;
    }

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
    } else if (item.label === "EVOLUÇÃO") {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("ReconhecimentoScene");
      });
    } else if (item.label === "RANKING") {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("RankingScene");
      });
    } else if (item.label === "BESTIARIO") {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("BestiaryScene");
      });
    } else if (item.label === "ARSENAL") {
      this.showOverlay("arsenal");
    } else if (item.label === "CONQUISTAS") {
      this.showOverlay("conquistas");
    } else if (item.label === "CONFIGURAÇÕES") {
      this.showOverlay("config");
    }
  }

  private hideOverlay() {
    this.overlay?.destroy();
    this.overlay = undefined;
  }

  private showOverlay(type: string) {
    this.hideOverlay();

    const OX = 328, OY = 52;
    const OW = GAME_WIDTH - OX - 8, OH = GAME_HEIGHT - OY - 56;

    this.overlay = this.add.container(OX, OY);

    // Background panel
    const bg = this.add.graphics();
    bg.fillStyle(0x0d1018, 0.97);
    bg.fillRect(0, 0, OW, OH);
    bg.lineStyle(2, ACCENT, 0.7);
    bg.strokeRect(0, 0, OW, OH);
    this.overlay.add(bg);

    if (type === "arsenal") {
      this.buildArsenalOverlay(OW, OH);
    } else if (type === "conquistas") {
      this.buildConquistasOverlay(OW, OH);
    } else {
      this.buildConfigOverlay(OW, OH);
    }

    // Close hint
    const closeT = this.add.text(OW / 2, OH - 20, "[ESC] Fechar", {
      fontFamily: "monospace", fontSize: "10px", color: TEXT_DIM,
    }).setOrigin(0.5, 1);
    this.overlay.add(closeT);

    // Click outside to close
    const blocker = this.add.rectangle(OX + OW / 2, OY + OH / 2, OW, OH, 0x000000, 0)
      .setInteractive();
    blocker.on("pointerdown", (_p: Phaser.Input.Pointer, _lx: number, _ly: number, evt: Phaser.Types.Input.EventData) => {
      evt.stopPropagation();
    });
    this.overlay.add(blocker);

    const closeBtnBg = this.add.graphics();
    closeBtnBg.fillStyle(0x220000, 1);
    closeBtnBg.fillRect(OW - 28, 4, 24, 20);
    closeBtnBg.lineStyle(1, 0x882222, 1);
    closeBtnBg.strokeRect(OW - 28, 4, 24, 20);
    this.overlay.add(closeBtnBg);

    const closeBtn = this.add.text(OW - 16, 14, "✕", {
      fontFamily: "monospace", fontSize: "12px", color: "#cc4444",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.hideOverlay());
    closeBtn.on("pointerover", () => closeBtn.setColor("#ff6666"));
    closeBtn.on("pointerout", () => closeBtn.setColor("#cc4444"));
    this.overlay.add(closeBtn);
  }

  private buildArsenalOverlay(OW: number, OH: number) {
    if (!this.overlay) return;

    this.overlay.add(
      this.add.text(OW / 2, 14, "🎒 ARSENAL", {
        fontFamily: "monospace", fontSize: "16px", fontStyle: "bold", color: TEXT_ACCENT,
      }).setOrigin(0.5, 0)
    );
    this.overlay.add(
      this.add.text(OW / 2, 34, "Armas disponíveis na run atual", {
        fontFamily: "monospace", fontSize: "8px", color: TEXT_DIM,
      }).setOrigin(0.5, 0)
    );

    const rarityColor: Record<string, string> = {
      comum: "#aaaaaa", raro: "#5588ff", epico: "#cc44ee", lendario: "#ffaa00",
    };
    const weapons = Object.values(WEAPONS);
    const colW = (OW - 24) / 2;
    const rowH = 42;
    const startY = 54;

    weapons.forEach((w, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const wx = 12 + col * colW;
      const wy = startY + row * rowH;
      if (wy + rowH > OH - 30) return;

      const card = this.add.graphics();
      card.fillStyle(0x141820, 1);
      card.fillRect(wx, wy, colW - 8, rowH - 4);
      card.lineStyle(1, col === 0 ? 0x2a3040 : 0x2a3040, 1);
      card.strokeRect(wx, wy, colW - 8, rowH - 4);
      this.overlay!.add(card);

      const rColor = rarityColor[w.rarity] ?? "#aaaaaa";
      const rarBar = this.add.graphics();
      rarBar.fillStyle(parseInt(rColor.slice(1), 16), 0.6);
      rarBar.fillRect(wx, wy, 3, rowH - 4);
      this.overlay!.add(rarBar);

      this.overlay!.add(
        this.add.text(wx + 8, wy + 5, w.name, {
          fontFamily: "monospace", fontSize: "10px", fontStyle: "bold", color: TEXT_LIGHT,
        })
      );
      this.overlay!.add(
        this.add.text(wx + 8, wy + 18, `${w.type === "melee" ? "Corpo a corpo" : "À distância"} · ${w.rarity.toUpperCase()}`, {
          fontFamily: "monospace", fontSize: "7px", color: rColor,
        })
      );
      this.overlay!.add(
        this.add.text(wx + 8, wy + 28, `Esp: ${w.specialName}`, {
          fontFamily: "monospace", fontSize: "7px", color: "#778899",
        })
      );
      if (w.shopCost > 0) {
        this.overlay!.add(
          this.add.text(wx + colW - 14, wy + 5, `R$${w.shopCost}`, {
            fontFamily: "monospace", fontSize: "8px", color: "#f2c14e",
          }).setOrigin(1, 0)
        );
      }
    });
  }

  private buildConquistasOverlay(OW: number, OH: number) {
    if (!this.overlay) return;
    const run = getRun(this);

    this.overlay.add(
      this.add.text(OW / 2, 14, "★ CONQUISTAS", {
        fontFamily: "monospace", fontSize: "16px", fontStyle: "bold", color: TEXT_ACCENT,
      }).setOrigin(0.5, 0)
    );
    this.overlay.add(
      this.add.text(OW / 2, 34, "Progresso do funcionário", {
        fontFamily: "monospace", fontSize: "8px", color: TEXT_DIM,
      }).setOrigin(0.5, 0)
    );

    const stats = [
      { label: "Reconhecimento acumulado", value: run.reconhecimento.toLocaleString("pt-BR"), color: "#f2c14e" },
      { label: "FGTS acumulado", value: `${run.fgts} pts`, color: "#88cc88" },
      { label: "Loops temporais", value: String(run.loopCount), color: "#8888ff" },
      { label: "Perks desbloqueados", value: `${(run.perks ?? []).length} / ${Object.keys(PERKS).length}`, color: "#cc88ff" },
    ];

    const rowH = 54;
    const startY = 58;
    stats.forEach((stat, i) => {
      const sy = startY + i * rowH;
      const card = this.add.graphics();
      card.fillStyle(0x111520, 1);
      card.fillRect(16, sy, OW - 32, rowH - 6);
      card.lineStyle(1, 0x2a3040, 1);
      card.strokeRect(16, sy, OW - 32, rowH - 6);
      this.overlay!.add(card);
      this.overlay!.add(
        this.add.text(28, sy + 8, stat.label, {
          fontFamily: "monospace", fontSize: "9px", color: TEXT_DIM,
        })
      );
      this.overlay!.add(
        this.add.text(28, sy + 22, stat.value, {
          fontFamily: "monospace", fontSize: "22px", fontStyle: "bold", color: stat.color,
        })
      );
    });

    // Perk list if any
    const perks = run.perks ?? [];
    if (perks.length > 0) {
      const perkY = startY + stats.length * rowH + 8;
      this.overlay!.add(
        this.add.text(16, perkY, "PERKS ATIVOS:", {
          fontFamily: "monospace", fontSize: "8px", color: TEXT_DIM,
        })
      );
      perks.forEach((pid, i) => {
        const pd = PERKS[pid as keyof typeof PERKS];
        if (!pd) return;
        this.overlay!.add(
          this.add.text(16 + (i % 3) * 180, perkY + 14 + Math.floor(i / 3) * 18,
            `${pd.icon} ${pd.name}`, {
              fontFamily: "monospace", fontSize: "9px", color: TEXT_LIGHT,
            })
        );
      });
    }
  }

  private buildConfigOverlay(OW: number, OH: number) {
    if (!this.overlay) return;

    this.overlay.add(
      this.add.text(OW / 2, 14, "⚙ CONFIGURAÇÕES", {
        fontFamily: "monospace", fontSize: "16px", fontStyle: "bold", color: TEXT_ACCENT,
      }).setOrigin(0.5, 0)
    );

    const items = [
      "Controles: Teclado (fixo)",
      "Resolução: 960 × 540",
      "Pixel Art: Ativado",
      "Áudio: Em breve",
      "Idioma: Português (BR)",
    ];

    items.forEach((txt, i) => {
      const iy = 60 + i * 36;
      const rowG = this.add.graphics();
      rowG.fillStyle(i % 2 === 0 ? 0x141820 : 0x0f1218, 1);
      rowG.fillRect(16, iy, OW - 32, 30);
      this.overlay!.add(rowG);
      this.overlay!.add(
        this.add.text(28, iy + 9, txt, {
          fontFamily: "monospace", fontSize: "11px", color: TEXT_LIGHT,
        })
      );
    });

    this.overlay!.add(
      this.add.text(OW / 2, OH - 60, "Configurações completas\nchegarão em uma atualização futura.", {
        fontFamily: "monospace", fontSize: "9px", color: TEXT_DIM, align: "center",
      }).setOrigin(0.5, 1)
    );
  }
}
