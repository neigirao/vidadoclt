import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../constants";
import { getRun, isNgPlusUnlocked } from "../systems/PlayerState";
import { Music } from "../systems/MusicSystem";
import {
  loadSettings,
  setVolume,
  toggleMuted,
  toggleReduceSanityFx,
  toggleAssistMode,
} from "../systems/Settings";
import { applyAudioSettings } from "../systems/applyAudio";
import { Telemetry } from "../systems/Telemetry";
import { WEAPONS, CLASSES, ClassId } from "../systems/WeaponSystem";
import { PERKS } from "../systems/PerkSystem";

// FERRAMENTA DE TESTE (temporária): pular direto pra uma fase criada, p/ os
// testadores validarem uma fase específica sem jogar desde o começo. Boota a
// cena com os mesmos dados do smoke (fromRoute p/ Fases 2–5). Remover depois.
const TEST_PHASES: { label: string; scene: string; data: object }[] = [
  { label: "Fase 1 — Open Space", scene: "OpenSpaceV2Scene", data: {} },
  { label: "Fase 2 — Atendimento", scene: "Phase2Scene", data: { fromRoute: true } },
  { label: "Fase 3 — Comercial", scene: "Phase3Scene", data: { fromRoute: true } },
  { label: "Fase 4 — Tecnologia", scene: "Phase4Scene", data: { fromRoute: true } },
  { label: "Fase 5 — Diretoria", scene: "Phase5Scene", data: { fromRoute: true } },
  { label: "CEO — Cobertura", scene: "CeoScene", data: {} },
];

const ACCENT = 0xf2a800;
const ACCENT_DIM = 0xb87a00;
const TEXT_LIGHT = "#eaeaea";
const TEXT_DIM = "#888888";
const TEXT_ACCENT = "#f2a800";
const BG_PANEL = 0x12151a;
const BG_MENU = 0x1a1d23;

type MenuItem = { label: string; icon: string; firstRun?: boolean };

// `firstRun: true` = visível na primeira run (antes de qualquer morte/vitória).
// Itens sem a flag só aparecem a partir do 2º loop — reduz paralysis analysis
// no primeiro contato com o jogo.
const ALL_MENU_ITEMS: MenuItem[] = [
  { label: "JOGAR", icon: "▶", firstRun: true },
  { label: "TESTAR FASE", icon: "🧪", firstRun: true },
  { label: "HORA EXTRA", icon: "🔥" },
  { label: "EVOLUÇÃO", icon: "⭐" },
  { label: "RANKING", icon: "🏆" },
  { label: "BESTIARIO", icon: "👾" },
  { label: "LAB SPRITES", icon: "🔬", firstRun: true }, // ferramenta de teste — visível já na 1ª run (remover depois)
  { label: "ARSENAL", icon: "🎒" },
  { label: "CONQUISTAS", icon: "★" },
  { label: "CONFIGURAÇÕES", icon: "⚙", firstRun: true },
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
  private MENU_ITEMS: MenuItem[] = ALL_MENU_ITEMS;
  private itemH = 44; // altura de linha (adaptativa ao nº de itens)

  constructor() {
    super("MenuScene");
  }

  create() {
    Music.start("office");
    // Primeira run (nunca morreu/venceu): menu enxuto para eliminar
    // paralysis by analysis. Sub-telas destravam a partir do 2º loop.
    const run = getRun(this);
    this.MENU_ITEMS =
      run.loopCount === 0 ? ALL_MENU_ITEMS.filter((it) => it.firstRun) : [...ALL_MENU_ITEMS];
    // New Game+ "Quinta-feira": só aparece depois da 1ª vitória.
    if (isNgPlusUnlocked() && run.loopCount > 0) {
      this.MENU_ITEMS.splice(1, 0, { label: "QUINTA-FEIRA", icon: "🌩" });
    }
    // Full-screen reference art background (loaded from assets)
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "bg-menu")
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
    const startY = 148;
    // Altura adaptativa: todos os itens (2 na 1ª run, até 10 com NG+) precisam
    // caber ACIMA do painel de stats (y=430) — senão CONFIGURAÇÕES saía da tela.
    const bottomLimit = 424;
    const itemH = Math.max(
      28,
      Math.min(44, Math.floor((bottomLimit - startY) / this.MENU_ITEMS.length)),
    );
    this.itemH = itemH;

    this.menuButtons = [];

    this.MENU_ITEMS.forEach((item, i) => {
      const y = startY + i * itemH;
      const container = this.add.container(14, y);

      const bg = this.add.graphics();
      const ty = Math.round((itemH - 4) / 2) - 9; // centraliza o texto na linha
      const label = this.add.text(42, ty, item.label, {
        fontFamily: "monospace",
        fontSize: "15px",
        fontStyle: "bold",
        color: TEXT_LIGHT,
      });
      const icon = this.add.text(14, ty, item.icon, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: TEXT_ACCENT,
      });

      container.add([bg, icon, label]);
      this.menuButtons.push(container);

      // Click handler
      const hitArea = this.add
        .rectangle(14 + 148, y + itemH / 2, 296, itemH - 6, 0x000000, 0)
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
    const itemH = this.itemH;
    this.MENU_ITEMS.forEach((_, i) => {
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

    // Right side icon buttons — atalhos REAIS (antes eram botões mortos: tinham
    // cursor/hover mas nenhum pointerdown → prometiam clique e não faziam nada).
    const icons: { ic: string; action: () => void }[] = [
      { ic: "⚙", action: () => this.showOverlay("config") },
      { ic: "🏆", action: () => this.scene.start("RankingScene") },
      { ic: "⭐", action: () => this.scene.start("ReconhecimentoScene") },
    ];
    icons.forEach(({ ic, action }, i) => {
      const x = GAME_WIDTH - 40 - i * 36;
      const btn = this.add
        .text(x, 8, ic, {
          fontFamily: "monospace",
          fontSize: "18px",
        })
        .setInteractive({ useHandCursor: true });
      btn.on("pointerover", () => btn.setAlpha(0.7));
      btn.on("pointerout", () => btn.setAlpha(1));
      btn.on("pointerdown", action);
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
      fontFamily: "monospace",
      fontSize: "8px",
      color: TEXT_ACCENT,
    });
    this.add.text(
      newsX + 38,
      GAME_HEIGHT - 31,
      "Nova rota definida!\nProduzir mais. Reclamar menos.",
      {
        fontFamily: "monospace",
        fontSize: "8px",
        color: TEXT_DIM,
      },
    );

    // Arrow
    this.add
      .text(newsX + 285, GAME_HEIGHT - 26, "►", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: TEXT_ACCENT,
      })
      .setInteractive({ useHandCursor: true });

    // Right: Social + copyright — empilhados p/ não sobrepor (o copyright é
    // largo e alinhado à direita; antes ficava em cima do "Siga-nos:").
    this.add.text(GAME_WIDTH - 195, GAME_HEIGHT - 52, "Siga-nos:", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: TEXT_DIM,
    });

    const socials = ["𝕏", "TK", "▶", "in"];
    socials.forEach((s, i) => {
      this.add
        .text(GAME_WIDTH - 180 + i * 30, GAME_HEIGHT - 40, s, {
          fontFamily: "monospace",
          fontSize: "12px",
          color: TEXT_DIM,
        })
        .setInteractive({ useHandCursor: true })
        .on("pointerover", (obj: Phaser.GameObjects.Text) => obj.setColor(TEXT_ACCENT))
        .on("pointerout", (obj: Phaser.GameObjects.Text) => obj.setColor(TEXT_DIM));
    });

    this.add
      .text(
        GAME_WIDTH - 20,
        GAME_HEIGHT - 16,
        "© 2025 Vida do CLT Inc. / Todos os direitos explorados.",
        {
          fontFamily: "monospace",
          fontSize: "8px",
          color: TEXT_DIM,
        },
      )
      .setOrigin(1, 0);
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
      this.selectedIndex =
        (this.selectedIndex - 1 + this.MENU_ITEMS.length) % this.MENU_ITEMS.length;
      this.refreshMenu();
    }
    if (downDown && !this.prevDownDown) {
      this.selectedIndex = (this.selectedIndex + 1) % this.MENU_ITEMS.length;
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
        fontFamily: "monospace",
        fontSize: "9px",
        color: TEXT_ACCENT,
      });
      this.add.text(20, 450, `Reconhecimento:  ${run.reconhecimento.toLocaleString("pt-BR")}`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: TEXT_LIGHT,
      });
      this.add.text(20, 464, `FGTS: ${run.fgts} pts   Loops: ${run.loopCount}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: TEXT_DIM,
      });
    } else {
      this.add
        .text(154, 456, "Primeiro dia de trabalho.", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: TEXT_DIM,
        })
        .setOrigin(0.5);
    }
  }

  private confirm() {
    const item = this.MENU_ITEMS[this.selectedIndex];
    if (item.label === "JOGAR" || item.label === "QUINTA-FEIRA") {
      const run = getRun(this);
      // Quinta-feira = New Game+: liga o modificador na run atual antes de começar.
      run.ngPlus = item.label === "QUINTA-FEIRA";
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        // 1ª run FIXA (onboarding): sem tela de Classe/Cultura — começa direto na
        // Fase 1 com o Analista (default equilibrado) e Cultura neutra. Evita o
        // "paralysis by analysis" do novato. A escolha de Classe/Cultura destrava
        // a partir da 2ª run (loopCount > 0). A Cultura já era pulada na 1ª run no
        // ClassSelect; aqui pulamos a tela de Classe também.
        if (run.loopCount === 0 && item.label === "JOGAR") {
          run.characterClass = "analista";
          run.culturas = ["padrao_clt"];
          this.scene.start("OpenSpaceV2Scene");
        } else {
          this.scene.start("ClassSelectScene");
        }
      });
    } else if (item.label === "HORA EXTRA") {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("HoraExtraScene");
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
    } else if (item.label === "LAB SPRITES") {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("SpriteLabScene");
      });
    } else if (item.label === "TESTAR FASE") {
      this.showOverlay("testfase");
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

    const OX = 328,
      OY = 52;
    const OW = GAME_WIDTH - OX - 8,
      OH = GAME_HEIGHT - OY - 56;

    this.overlay = this.add.container(OX, OY);

    // Background panel
    const bg = this.add.graphics();
    bg.fillStyle(0x0d1018, 0.97);
    bg.fillRect(0, 0, OW, OH);
    bg.lineStyle(2, ACCENT, 0.7);
    bg.strokeRect(0, 0, OW, OH);
    this.overlay.add(bg);

    // Blocker: absorve cliques que caem no fundo do painel (não fecha o menu
    // atrás). Adicionado ANTES do conteúdo p/ que os controles interativos da
    // tela de Configurações fiquem POR CIMA e recebam clique.
    const blocker = this.add
      .rectangle(OX + OW / 2, OY + OH / 2, OW, OH, 0x000000, 0)
      .setInteractive();
    blocker.on(
      "pointerdown",
      (_p: Phaser.Input.Pointer, _lx: number, _ly: number, evt: Phaser.Types.Input.EventData) =>
        evt.stopPropagation(),
    );
    this.overlay.add(blocker);

    if (type === "arsenal") {
      this.buildArsenalOverlay(OW, OH);
    } else if (type === "conquistas") {
      this.buildConquistasOverlay(OW, OH);
    } else if (type === "testfase") {
      this.buildTestFaseOverlay(OW, OH);
    } else {
      this.buildConfigOverlay(OW, OH);
    }

    // Close hint
    const closeT = this.add
      .text(OW / 2, OH - 20, "[ESC] Fechar", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: TEXT_DIM,
      })
      .setOrigin(0.5, 1);
    this.overlay.add(closeT);

    const closeBtnBg = this.add.graphics();
    closeBtnBg.fillStyle(0x220000, 1);
    closeBtnBg.fillRect(OW - 28, 4, 24, 20);
    closeBtnBg.lineStyle(1, 0x882222, 1);
    closeBtnBg.strokeRect(OW - 28, 4, 24, 20);
    this.overlay.add(closeBtnBg);

    const closeBtn = this.add
      .text(OW - 16, 14, "✕", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#cc4444",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.hideOverlay());
    closeBtn.on("pointerover", () => closeBtn.setColor("#ff6666"));
    closeBtn.on("pointerout", () => closeBtn.setColor("#cc4444"));
    this.overlay.add(closeBtn);
  }

  private buildArsenalOverlay(OW: number, OH: number) {
    if (!this.overlay) return;

    this.overlay.add(
      this.add
        .text(OW / 2, 14, "🎒 ARSENAL", {
          fontFamily: "monospace",
          fontSize: "16px",
          fontStyle: "bold",
          color: TEXT_ACCENT,
        })
        .setOrigin(0.5, 0),
    );
    this.overlay.add(
      this.add
        .text(OW / 2, 34, "Armas disponíveis na run atual", {
          fontFamily: "monospace",
          fontSize: "8px",
          color: TEXT_DIM,
        })
        .setOrigin(0.5, 0),
    );

    const rarityColor: Record<string, string> = {
      comum: "#aaaaaa",
      raro: "#5588ff",
      epico: "#cc44ee",
      lendario: "#ffaa00",
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
          fontFamily: "monospace",
          fontSize: "10px",
          fontStyle: "bold",
          color: TEXT_LIGHT,
        }),
      );
      this.overlay!.add(
        this.add.text(
          wx + 8,
          wy + 18,
          `${w.type === "melee" ? "Corpo a corpo" : "À distância"} · ${w.rarity.toUpperCase()}`,
          {
            fontFamily: "monospace",
            fontSize: "7px",
            color: rColor,
          },
        ),
      );
      this.overlay!.add(
        this.add.text(wx + 8, wy + 28, `Esp: ${w.specialName}`, {
          fontFamily: "monospace",
          fontSize: "7px",
          color: "#778899",
        }),
      );
      if (w.shopCost > 0) {
        this.overlay!.add(
          this.add
            .text(wx + colW - 14, wy + 5, `R$${w.shopCost}`, {
              fontFamily: "monospace",
              fontSize: "8px",
              color: "#f2c14e",
            })
            .setOrigin(1, 0),
        );
      }
    });
  }

  private buildConquistasOverlay(OW: number, OH: number) {
    if (!this.overlay) return;
    const run = getRun(this);

    this.overlay.add(
      this.add
        .text(OW / 2, 14, "★ CONQUISTAS", {
          fontFamily: "monospace",
          fontSize: "16px",
          fontStyle: "bold",
          color: TEXT_ACCENT,
        })
        .setOrigin(0.5, 0),
    );
    this.overlay.add(
      this.add
        .text(OW / 2, 34, "Progresso do funcionário", {
          fontFamily: "monospace",
          fontSize: "8px",
          color: TEXT_DIM,
        })
        .setOrigin(0.5, 0),
    );

    const stats = [
      {
        label: "Reconhecimento acumulado",
        value: run.reconhecimento.toLocaleString("pt-BR"),
        color: "#f2c14e",
      },
      { label: "FGTS acumulado", value: `${run.fgts} pts`, color: "#88cc88" },
      { label: "Loops temporais", value: String(run.loopCount), color: "#8888ff" },
      {
        label: "Perks desbloqueados",
        value: `${(run.perks ?? []).length} / ${Object.keys(PERKS).length}`,
        color: "#cc88ff",
      },
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
          fontFamily: "monospace",
          fontSize: "9px",
          color: TEXT_DIM,
        }),
      );
      this.overlay!.add(
        this.add.text(28, sy + 22, stat.value, {
          fontFamily: "monospace",
          fontSize: "22px",
          fontStyle: "bold",
          color: stat.color,
        }),
      );
    });

    // Perk list if any
    const perks = run.perks ?? [];
    if (perks.length > 0) {
      const perkY = startY + stats.length * rowH + 8;
      this.overlay!.add(
        this.add.text(16, perkY, "PERKS ATIVOS:", {
          fontFamily: "monospace",
          fontSize: "8px",
          color: TEXT_DIM,
        }),
      );
      perks.forEach((pid, i) => {
        const pd = PERKS[pid as keyof typeof PERKS];
        if (!pd) return;
        this.overlay!.add(
          this.add.text(
            16 + (i % 3) * 180,
            perkY + 14 + Math.floor(i / 3) * 18,
            `${pd.icon} ${pd.name}`,
            {
              fontFamily: "monospace",
              fontSize: "9px",
              color: TEXT_LIGHT,
            },
          ),
        );
      });
    }
  }

  // FERRAMENTA DE TESTE (temporária): lista de fases → pula direto pra ela.
  private buildTestFaseOverlay(OW: number, OH: number) {
    if (!this.overlay) return;
    const ov = this.overlay;
    ov.add(
      this.add
        .text(OW / 2, 14, "🧪 TESTAR FASE", {
          fontFamily: "monospace",
          fontSize: "16px",
          fontStyle: "bold",
          color: TEXT_ACCENT,
        })
        .setOrigin(0.5, 0),
    );
    ov.add(
      this.add
        .text(OW / 2, 34, "Pula direto pra uma fase (ferramenta de teste — temporária)", {
          fontFamily: "monospace",
          fontSize: "8px",
          color: TEXT_DIM,
        })
        .setOrigin(0.5, 0),
    );

    const rowH = 40;
    const startY = 58;
    TEST_PHASES.forEach((ph, i) => {
      const y = startY + i * rowH;
      const card = this.add.graphics();
      card.fillStyle(0x141820, 1);
      card.fillRect(16, y, OW - 32, rowH - 6);
      card.lineStyle(1, 0x2a3040, 1);
      card.strokeRect(16, y, OW - 32, rowH - 6);
      ov.add(card);
      ov.add(
        this.add.text(28, y + 6, `[${i + 1}]`, {
          fontFamily: "monospace",
          fontSize: "11px",
          fontStyle: "bold",
          color: "#88ccff",
        }),
      );
      ov.add(
        this.add.text(64, y + 6, ph.label, {
          fontFamily: "monospace",
          fontSize: "13px",
          fontStyle: "bold",
          color: TEXT_LIGHT,
        }),
      );
      ov.add(
        this.add.text(64, y + 22, `→ ${ph.scene}`, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: TEXT_DIM,
        }),
      );
      const hit = this.add
        .rectangle(16 + (OW - 32) / 2, y + (rowH - 6) / 2, OW - 32, rowH - 6, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hit.on("pointerover", () =>
        card
          .clear()
          .fillStyle(0x24304a, 1)
          .fillRect(16, y, OW - 32, rowH - 6)
          .lineStyle(2, ACCENT, 1)
          .strokeRect(16, y, OW - 32, rowH - 6),
      );
      hit.on("pointerout", () =>
        card
          .clear()
          .fillStyle(0x141820, 1)
          .fillRect(16, y, OW - 32, rowH - 6)
          .lineStyle(1, 0x2a3040, 1)
          .strokeRect(16, y, OW - 32, rowH - 6),
      );
      hit.on("pointerdown", () => this.startTestPhase(ph.scene, ph.data));
      ov.add(hit);
    });

    // Atalhos de teclado 1..N
    const kb = this.input.keyboard!;
    TEST_PHASES.forEach((ph, i) => {
      const code =
        Phaser.Input.Keyboard.KeyCodes[
          (["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX"] as const)[i]
        ];
      if (code != null) kb.addKey(code).once("down", () => this.startTestPhase(ph.scene, ph.data));
    });
  }

  // Prepara uma run mínima e válida (classe/arma padrão) e boota a fase.
  private startTestPhase(sceneKey: string, data: object) {
    const run = getRun(this);
    const cls = (run.characterClass ?? "analista") as ClassId;
    run.characterClass = cls;
    run.weaponId = run.weaponId ?? CLASSES[cls].startWeapon;
    run.culturas = run.culturas ?? [];
    run.perks = run.perks ?? [];
    this.hideOverlay();
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(sceneKey, data));
  }

  private buildConfigOverlay(OW: number, OH: number) {
    if (!this.overlay) return;

    this.overlay.add(
      this.add
        .text(OW / 2, 14, "⚙ CONFIGURAÇÕES", {
          fontFamily: "monospace",
          fontSize: "16px",
          fontStyle: "bold",
          color: TEXT_ACCENT,
        })
        .setOrigin(0.5, 0),
    );

    const ov = this.overlay;
    let iy = 56;
    const rowH = 34;

    const rowBg = (y: number, i: number) => {
      const g = this.add.graphics();
      g.fillStyle(i % 2 === 0 ? 0x141820 : 0x0f1218, 1);
      g.fillRect(16, y, OW - 32, rowH - 4);
      ov.add(g);
    };
    const clickable = (t: Phaser.GameObjects.Text, onClick: () => void) => {
      t.setInteractive({ useHandCursor: true })
        .on("pointerover", () => t.setColor(TEXT_ACCENT))
        .on("pointerout", () => t.setColor(TEXT_LIGHT))
        .on("pointerdown", onClick);
      ov.add(t);
      return t;
    };

    // Linha de volume: rótulo + ◄ [barra 0–100%] ►
    const volumeRow = (
      label: string,
      key: "masterVolume" | "musicVolume" | "sfxVolume",
      y: number,
      i: number,
    ) => {
      rowBg(y, i);
      ov.add(
        this.add.text(28, y + 10, label, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: TEXT_LIGHT,
        }),
      );
      const barX = OW - 200;
      const barW = 120;
      const draw = () => {
        const v = loadSettings()[key];
        pct.setText(`${Math.round(v * 100)}%`);
        bar.clear();
        bar.fillStyle(0x000000, 0.5);
        bar.fillRect(barX, y + 11, barW, 8);
        bar.fillStyle(ACCENT, 1);
        bar.fillRect(barX, y + 11, barW * v, 8);
      };
      const bar = this.add.graphics();
      ov.add(bar);
      const pct = this.add.text(OW - 60, y + 10, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: TEXT_ACCENT,
      });
      ov.add(pct);
      const step = (d: number) => {
        setVolume(key, loadSettings()[key] + d);
        applyAudioSettings();
        draw();
      };
      clickable(
        this.add.text(barX - 22, y + 8, "◄", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: TEXT_LIGHT,
        }),
        () => step(-0.1),
      );
      clickable(
        this.add.text(barX + barW + 8, y + 8, "►", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: TEXT_LIGHT,
        }),
        () => step(0.1),
      );
      draw();
    };

    // Linha toggle: rótulo + [ LIGADO / DESLIGADO ]
    const toggleRow = (
      label: string,
      get: () => boolean,
      toggle: () => void,
      y: number,
      i: number,
    ) => {
      rowBg(y, i);
      ov.add(
        this.add.text(28, y + 10, label, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: TEXT_LIGHT,
        }),
      );
      const state = this.add.text(OW - 120, y + 10, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: TEXT_ACCENT,
      });
      const draw = () => {
        const on = get();
        state.setText(on ? "[ LIGADO ]" : "[ DESLIGADO ]");
        state.setColor(on ? "#55dd77" : TEXT_DIM);
      };
      state.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        toggle();
        applyAudioSettings();
        draw();
      });
      ov.add(state);
      draw();
    };

    volumeRow("Volume Geral", "masterVolume", iy, 0);
    iy += rowH;
    volumeRow("Música", "musicVolume", iy, 1);
    iy += rowH;
    volumeRow("Efeitos (SFX)", "sfxVolume", iy, 2);
    iy += rowH;
    toggleRow("Mudo", () => loadSettings().muted, toggleMuted, iy, 3);
    iy += rowH;
    toggleRow(
      "Reduzir efeitos de Sanidade",
      () => loadSettings().reduceSanityFx,
      toggleReduceSanityFx,
      iy,
      4,
    );
    iy += rowH;
    toggleRow(
      "Modo assistido  (−30% dano · +1 vida/fase)",
      () => loadSettings().assistMode,
      toggleAssistMode,
      iy,
      5,
    );
    iy += rowH + 8;

    // Exportar telemetria — para playtesters mandarem os dados sem console.
    rowBg(iy, 0);
    ov.add(
      this.add.text(28, iy + 10, "Exportar dados de teste", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: TEXT_LIGHT,
      }),
    );
    const expState = this.add.text(OW - 150, iy + 10, "", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: TEXT_ACCENT,
    });
    const n = Telemetry.count();
    expState.setText(n > 0 ? `[ BAIXAR (${n}) ]` : "[ sem dados ]");
    expState.setColor(n > 0 ? "#55dd77" : TEXT_DIM);
    if (n > 0) {
      expState.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        const ok = Telemetry.download();
        expState.setText(ok ? "[ baixado ✓ ]" : "[ falhou ]");
      });
    }
    ov.add(expState);
    iy += rowH + 8;

    // Info estática (não ajustável) — mantida como referência.
    ["Controles: Teclado (fixo)", "Resolução: 960 × 540", "Idioma: Português (BR)"].forEach(
      (txt, k) => {
        ov.add(
          this.add.text(28, iy + k * 20, txt, {
            fontFamily: "monospace",
            fontSize: "10px",
            color: TEXT_DIM,
          }),
        );
      },
    );
  }
}
