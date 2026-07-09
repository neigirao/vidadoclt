import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { loadSettings, toggleReduceSanityFx } from "../systems/Settings";
import { Telemetry } from "../systems/Telemetry";

const F = "monospace";

const CONTROLS: [string, string][] = [
  ["← →  /  A D", "Andar"],
  ["Espaço / W", "Pular"],
  ["Shift", "Dash (invulnerável)"],
  ["J", "Atacar / Combo"],
  ["K", "Ataque Especial"],
  ["E", "Interagir (porta / loja)"],
  ["ESC", "Pausar / Retomar"],
];

export class PauseScene extends Phaser.Scene {
  constructor() {
    super("PauseScene");
  }

  create(data: { caller?: string }) {
    const caller = data?.caller ?? "";

    const resume = () => {
      this.scene.stop();
      if (caller) this.scene.resume(caller);
    };

    // Full-screen dim overlay
    this.add.graphics().fillStyle(0x000000, 0.72).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Panel
    const panW = 420;
    const panH = 60 + CONTROLS.length * 30 + 52 + 40;
    const px = Math.round((GAME_WIDTH - panW) / 2);
    const py = Math.round((GAME_HEIGHT - panH) / 2);

    const panel = this.add.graphics();
    panel.fillStyle(0x0d1018, 0.98);
    panel.fillRect(px, py, panW, panH);
    panel.lineStyle(2, 0xf2a800, 0.85);
    panel.strokeRect(px, py, panW, panH);
    // Accent top bar
    panel.fillStyle(0xf2a800, 1);
    panel.fillRect(px, py, panW, 4);

    this.add
      .text(px + panW / 2, py + 14, "⏸  PAUSADO", {
        fontFamily: F,
        fontSize: "18px",
        fontStyle: "bold",
        color: "#f2a800",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(px + panW / 2, py + 36, "C O N T R O L E S", {
        fontFamily: F,
        fontSize: "9px",
        color: "#555566",
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0);

    // Controls rows
    const tableY = py + 54;
    const rowH = 30;
    CONTROLS.forEach(([key, action], i) => {
      const ry = tableY + i * rowH;
      if (i % 2 === 0) {
        this.add
          .graphics()
          .fillStyle(0x181e28, 1)
          .fillRect(px + 10, ry, panW - 20, rowH - 2);
      }
      this.add.text(px + 22, ry + 8, key, {
        fontFamily: F,
        fontSize: "12px",
        fontStyle: "bold",
        color: "#eaeaea",
      });
      this.add
        .text(px + panW - 22, ry + 8, action, {
          fontFamily: F,
          fontSize: "11px",
          color: "#8899bb",
        })
        .setOrigin(1, 0);
    });

    // ── Acessibilidade: toggle "Reduzir efeitos de Sanidade" ──────────────────
    const accY = py + panH - 42 - 40;
    const accLabel = this.add
      .text(px + 22, accY + 4, "[O]  Reduzir efeitos de Sanidade", {
        fontFamily: F,
        fontSize: "11px",
        color: "#8899bb",
      })
      .setInteractive({ useHandCursor: true });
    const stateT = this.add
      .text(px + panW - 22, accY + 4, "", { fontFamily: F, fontSize: "11px", fontStyle: "bold" })
      .setOrigin(1, 0);
    const renderState = () => {
      const on = loadSettings().reduceSanityFx;
      stateT.setText(on ? "LIGADO" : "desligado").setColor(on ? "#44ddaa" : "#667088");
    };
    renderState();
    const flip = () => {
      toggleReduceSanityFx();
      renderState();
      // A SanityFx relê o setting a cada 500ms → aplica ao vivo ao retomar.
    };
    accLabel.on("pointerdown", flip);
    accLabel.on("pointerover", () => accLabel.setColor("#ffffff"));
    accLabel.on("pointerout", () => accLabel.setColor("#8899bb"));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.O).on("down", flip);

    // ── Botões: Retomar (esq) + Sair para o menu (dir) ────────────────────────
    const quit = () => {
      Telemetry.markQuitIfActive();
      if (caller) this.scene.stop(caller);
      this.scene.start("MenuScene");
    };

    const btnY = py + panH - 42;
    const gap = 8;
    const halfW = (panW - 60 - gap) / 2;
    const resumeX = px + 30;
    const quitX = resumeX + halfW + gap;

    const resumeG = this.add.graphics().fillStyle(0x1e2530, 1).fillRect(resumeX, btnY, halfW, 32);
    resumeG.lineStyle(1, 0x4455aa, 1);
    resumeG.strokeRect(resumeX, btnY, halfW, 32);
    const resumeT = this.add
      .text(resumeX + halfW / 2, btnY + 16, "[ESC] Retomar", {
        fontFamily: F,
        fontSize: "12px",
        color: "#aabbdd",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: resumeT, alpha: 0.5, duration: 700, yoyo: true, repeat: -1 });
    resumeT.on("pointerdown", resume);
    resumeT.on("pointerover", () => resumeT.setColor("#ffffff").setAlpha(1));
    resumeT.on("pointerout", () => resumeT.setColor("#aabbdd"));

    const quitG = this.add.graphics().fillStyle(0x2a1a1e, 1).fillRect(quitX, btnY, halfW, 32);
    quitG.lineStyle(1, 0xaa4455, 1);
    quitG.strokeRect(quitX, btnY, halfW, 32);
    const quitT = this.add
      .text(quitX + halfW / 2, btnY + 16, "[M] Sair p/ o menu", {
        fontFamily: F,
        fontSize: "12px",
        color: "#dd8899",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    quitT.on("pointerdown", quit);
    quitT.on("pointerover", () => quitT.setColor("#ffffff"));
    quitT.on("pointerout", () => quitT.setColor("#dd8899"));

    // Teclas
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).once("down", resume);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).once("down", quit);
  }
}
