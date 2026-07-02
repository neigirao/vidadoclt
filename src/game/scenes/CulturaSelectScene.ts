import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { getRun } from "../systems/PlayerState";
import { CulturaId, CULTURAS } from "../systems/CulturaSystem";
import { Sfx } from "../systems/AudioSystem";

export class CulturaSelectScene extends Phaser.Scene {
  constructor() {
    super("CulturaSelectScene");
  }

  create(data: { caller: string; options: CulturaId[] }) {
    const run = getRun(this);

    // Dark overlay
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
      .setScrollFactor(0)
      .setDepth(1000);

    // Panel
    const panelW = 540;
    const panelH = 290;
    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2;

    this.add
      .rectangle(panelX, panelY, panelW, panelH, 0x1a1a2e, 1)
      .setScrollFactor(0)
      .setDepth(1001);
    this.add
      .rectangle(panelX, panelY, panelW, panelH, 0x4a3f6b, 0)
      .setScrollFactor(0)
      .setDepth(1001)
      .setStrokeStyle(2, 0x8866cc);

    // Title
    this.add
      .text(panelX, panelY - panelH / 2 + 22, "CULTURA CORPORATIVA", {
        fontFamily: "monospace",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#f2c14e",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1002);

    // Subtitle
    this.add
      .text(panelX, panelY - panelH / 2 + 44, "Escolha um beneficio para esta run:", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#aaaacc",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1002);

    // Cards
    const cardW = 152;
    const cardH = 160;
    const cardSpacing = 168;
    const cardStartX = panelX - cardSpacing;
    const cardY = panelY + 20;

    const keyLabels = ["[1]", "[2]", "[3]"];

    data.options.forEach((id, i) => {
      const def = CULTURAS[id];
      const cx = cardStartX + i * cardSpacing;

      // Key label above card
      this.add
        .text(cx, cardY - cardH / 2 - 16, keyLabels[i], {
          fontFamily: "monospace",
          fontSize: "11px",
          fontStyle: "bold",
          color: "#88ccff",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1002);

      // Card background
      const card = this.add
        .rectangle(cx, cardY, cardW, cardH, 0x0d0d1a, 1)
        .setScrollFactor(0)
        .setDepth(1001)
        .setStrokeStyle(1, 0x5544aa);

      // Hover interaction
      card.setInteractive();
      card.on("pointerover", () => card.setStrokeStyle(2, 0xaabb88));
      card.on("pointerout", () => card.setStrokeStyle(1, 0x5544aa));
      card.on("pointerdown", () => select(id));

      // Icon (2-char text substitute)
      this.add
        .text(cx, cardY - 50, def.icon, {
          fontFamily: "monospace",
          fontSize: "24px",
          fontStyle: "bold",
          color: "#f2c14e",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1003);

      // Name
      this.add
        .text(cx, cardY - 18, def.name, {
          fontFamily: "monospace",
          fontSize: "10px",
          fontStyle: "bold",
          color: "#eaeaea",
          wordWrap: { width: cardW - 10 },
          align: "center",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1003);

      // Description
      this.add
        .text(cx, cardY + 30, def.description, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#9999bb",
          wordWrap: { width: cardW - 12 },
          align: "center",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1003);
    });

    const select = (id: CulturaId) => {
      Sfx.culturaSelect();
      run.culturas = [...(run.culturas ?? []), id];
      // Apply banco_horas immediately on selection (not via reapplyAllCulturas)
      if (id === "banco_horas") {
        run.extraLives = (run.extraLives ?? 0) + 1;
      }
      this.scene.stop();
      this.scene.resume(data.caller);
    };

    // Key bindings
    const kb = this.input.keyboard!;
    kb.once("keydown-ONE", () => select(data.options[0]));
    kb.once("keydown-TWO", () => select(data.options[1]));
    kb.once("keydown-THREE", () => select(data.options[2]));
  }
}
