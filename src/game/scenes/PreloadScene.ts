import Phaser from "phaser";
import {
  makeFurnitureTextures,
  makeOfficeBackgrounds,
  makeUiTextures,
  makeObjectTextures,
  applyBackgroundFilters,
} from "../systems/TextureFactory";
import { initSpriteLibrary } from "../systems/SpriteLibrary";

// ─── Palette (AMI BIOS style) ────────────────────────────────────────────────
const C_BG = 0x000000; // black background
const C_WHITE = "#ffffff";
const C_GRAY = "#aaaaaa";
const C_YELLOW = "#ffff55";
const C_CYAN = "#55ffff";
const C_RED_BG = 0xaa0000; // red logo box
const C_BLUE_BG = 0x0000aa; // blue info box (status bar)

const FONT = "Courier New, monospace";

export class PreloadScene extends Phaser.Scene {
  private loadProgress = 0;
  private assetsReady = false;
  private animDone = false;
  private textY = 0;
  private leftX = 0;

  constructor() {
    super("PreloadScene");
  }

  // ─── Asset loading ────────────────────────────────────────────────────────
  preload() {
    // Only what's needed before the menu — gameplay backgrounds load per-scene
    this.load.image("bg-menu", "/assets/bg-menu.png");
    this.load.image("bg-openspace", "/assets/bg-openspace.png");
    this.load.image("tex-floor", "/assets/sprites/tile-floor.png");
    this.load.image("tex-vr", "/assets/sprites/item-vr-coin.png");
    this.load.image("tex-inkproj", "/assets/sprites/item-inkproj.png");
    this.load.image("tex-coffee", "/assets/sprites/item-coffee-cup.png");
    this.load.image("tex-door", "/assets/sprites/obj-door.png");
    this.load.image("tex-ponto", "/assets/sprites/obj-ponto.png");
    this.load.atlas("sprites", "/assets/atlas.png", "/assets/atlas.json");

    this.load.on("progress", (v: number) => {
      this.loadProgress = v;
    });
    this.load.on("complete", () => {
      this.assetsReady = true;
    });
  }

  // ─── Boot sequence ────────────────────────────────────────────────────────
  create() {
    makeUiTextures(this);
    makeFurnitureTextures(this);
    makeObjectTextures(this);
    makeOfficeBackgrounds(this);
    applyBackgroundFilters(this);
    initSpriteLibrary(this);
    this.assetsReady = true;

    const W = this.scale.width;
    const H = this.scale.height;

    // Black background
    this.add.rectangle(W / 2, H / 2, W, H, C_BG).setDepth(0);

    // ── Top-right red logo box (AMI style) ──
    const LOGO_W = 210;
    const LOGO_H = 56;
    const LOGO_X = W - LOGO_W - 8;
    const LOGO_Y = 8;
    this.add
      .rectangle(LOGO_X + LOGO_W / 2, LOGO_Y + LOGO_H / 2, LOGO_W, LOGO_H, C_RED_BG)
      .setDepth(5);
    this.add
      .text(LOGO_X + LOGO_W / 2, LOGO_Y + 10, "RH SISTEMAS", {
        fontFamily: FONT,
        fontSize: "15px",
        fontStyle: "bold",
        color: C_WHITE,
      })
      .setOrigin(0.5, 0)
      .setDepth(6);
    this.add
      .text(LOGO_X + LOGO_W / 2, LOGO_Y + 28, "LTDA.", {
        fontFamily: FONT,
        fontSize: "11px",
        color: "#ffdddd",
      })
      .setOrigin(0.5, 0)
      .setDepth(6);
    this.add
      .text(LOGO_X + LOGO_W / 2, LOGO_Y + 40, "www.rh-sistemas.com.br", {
        fontFamily: FONT,
        fontSize: "9px",
        color: "#ffaaaa",
      })
      .setOrigin(0.5, 0)
      .setDepth(6);

    // ── Blue top-left version bar ──
    this.add
      .rectangle(LOGO_W / 2 + 4, LOGO_Y + LOGO_H / 2, LOGO_W + 8, LOGO_H, C_BLUE_BG)
      .setDepth(5);
    this.add
      .text(8, LOGO_Y + 6, "VIDA-CLT BIOS v3.1", {
        fontFamily: FONT,
        fontSize: "12px",
        fontStyle: "bold",
        color: C_WHITE,
      })
      .setDepth(6);
    this.add
      .text(8, LOGO_Y + 22, "Copyright (C) 1994-2026", {
        fontFamily: FONT,
        fontSize: "10px",
        color: C_GRAY,
      })
      .setDepth(6);
    this.add
      .text(8, LOGO_Y + 35, "Recursos Humanos LTDA.", {
        fontFamily: FONT,
        fontSize: "10px",
        color: C_GRAY,
      })
      .setDepth(6);

    // ── POST messages ──
    this.leftX = 8;
    this.textY = LOGO_Y + LOGO_H + 14;

    const delay = (ms: number, fn: () => void) => this.time.delayedCall(ms, fn);

    // Instant lines
    this.postLine("Press DEL to run Setup", C_GRAY, 10);
    this.postLine("Press F8 para BIOS BBS POPUP", C_GRAY, 10);
    this.postLine("Press TAB para ver horário de saída", C_GRAY, 10);
    this.blankLine();

    delay(300, () => {
      this.postLine("Inicializando controladores USB...", C_WHITE);
      this.postLine("BIOS: 03.1.0 Build-26 ACPI ok", C_WHITE);
    });

    delay(500, () => {
      this.postLine("CPU: Analista Pentium(R) 233 MHz", C_WHITE);
      this.postLine("Memória Convencional: 640 K", C_WHITE);
      this.postLine("Memória Estendida: 524288 K", C_WHITE);
    });

    delay(800, () => {
      this.blankLine();
      this.postLine("Versão BIOS:    03.10.0026", C_WHITE);
      this.postLine("ID do Processo: CLT-2026-SP-0001", C_WHITE);
      this.postLine("Velocidade CPU: 233 MHz", C_WHITE);
      this.postLine("Frequência RAM: 133 MHz", C_WHITE);
    });

    delay(1100, () => {
      this.blankLine();
      this.postLine("Auto-Detectando HDD primário...", C_CYAN);
    });

    delay(1600, () => {
      this.postLine("  VIDACLT-SETOR-A    20480 MB   [OK]", C_WHITE);
      this.postLine("Auto-Detectando HDD secundário...", C_CYAN);
    });

    delay(2000, () => {
      this.postLine("  PLANILHAS-BACKUP    4096 MB   [OK]", C_WHITE);
      this.blankLine();
      this.postLine("Auto-Detectando dispositivos USB...", C_CYAN);
    });

    delay(2500, () => {
      this.postLine("  USB 0: Crachá Eletrônico         [OK]", C_WHITE);
      this.postLine("  USB 1: Pendrive com currículo     [OK]", C_WHITE);
      this.postLine("  USB 2: Mouse sem fio (bateria baixa)", C_YELLOW);
    });

    delay(3000, () => {
      this.blankLine();
      this.postLine("Inicializando placa gráfica VESA...   [OK]", C_WHITE);
      this.postLine("Calibrando relógio ponto eletrônico...[OK]", C_WHITE);
      this.postLine("Carregando módulo anti-sindicato...   [OK]", C_WHITE);
      this.blankLine();
    });

    delay(3500, () => {
      this.postLine("Iniciando VIDA-CLT OS 6.22...", C_YELLOW);
      this.animDone = true;
      this.startBarLoop();
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private postLine(text: string, color = C_WHITE, extraDelay = 0) {
    const y = this.textY;
    this.textY += 16;

    const t = this.add
      .text(this.leftX, y, text, {
        fontFamily: FONT,
        fontSize: "12px",
        color,
      })
      .setDepth(10)
      .setAlpha(0);

    if (extraDelay > 0) {
      this.time.delayedCall(extraDelay, () => t.setAlpha(1));
    } else {
      t.setAlpha(1);
    }
    return t;
  }

  private blankLine() {
    this.textY += 8;
  }

  // ─── Progress bar at bottom ───────────────────────────────────────────────

  private startBarLoop() {
    const W = this.scale.width;
    const H = this.scale.height;
    const barY = H - 32;

    // Bottom blue status bar
    const statusBg = this.add.rectangle(W / 2, barY + 8, W, 28, C_BLUE_BG).setDepth(9);

    const barText = this.add
      .text(8, barY, "", {
        fontFamily: FONT,
        fontSize: "12px",
        color: C_WHITE,
      })
      .setDepth(10);

    const BAR = 34;
    let displayed = 0;

    const tick = this.time.addEvent({
      delay: 80,
      loop: true,
      callback: () => {
        const target = this.assetsReady ? 1 : this.loadProgress;
        displayed = Math.min(displayed + 0.035, target);

        const filled = Math.round(displayed * BAR);
        const bar = "█".repeat(filled) + "░".repeat(BAR - filled);
        const pct = Math.round(displayed * 100);
        barText.setText(`Carregando sistema...  [${bar}]  ${pct}%`);

        if (displayed >= 0.99 && this.assetsReady && this.animDone) {
          tick.remove();
          barText.setText(`Sistema pronto.  [${"█".repeat(BAR)}]  100%  — Boa sorte, CLT.`);
          this.time.delayedCall(1200, () => this.fadeToMenu());
        }
      },
    });
  }

  // ─── Fade to menu ─────────────────────────────────────────────────────────

  private fadeToMenu() {
    const W = this.scale.width;
    const H = this.scale.height;
    const overlay = this.add
      .rectangle(W / 2, H / 2, W, H, 0x000000)
      .setAlpha(0)
      .setDepth(50);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 700,
      ease: "Power2",
      onComplete: () => this.scene.start("MenuScene"),
    });
  }
}
