import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";

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
    this.add.graphics()
      .fillStyle(0x000000, 0.72)
      .fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Panel
    const panW = 420;
    const panH = 60 + CONTROLS.length * 30 + 52;
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

    this.add.text(px + panW / 2, py + 14, "⏸  PAUSADO", {
      fontFamily: F, fontSize: "18px", fontStyle: "bold", color: "#f2a800",
    }).setOrigin(0.5, 0);

    this.add.text(px + panW / 2, py + 36, "C O N T R O L E S", {
      fontFamily: F, fontSize: "9px", color: "#555566", letterSpacing: 2,
    }).setOrigin(0.5, 0);

    // Controls rows
    const tableY = py + 54;
    const rowH = 30;
    CONTROLS.forEach(([key, action], i) => {
      const ry = tableY + i * rowH;
      if (i % 2 === 0) {
        this.add.graphics()
          .fillStyle(0x181e28, 1)
          .fillRect(px + 10, ry, panW - 20, rowH - 2);
      }
      this.add.text(px + 22, ry + 8, key, {
        fontFamily: F, fontSize: "12px", fontStyle: "bold", color: "#eaeaea",
      });
      this.add.text(px + panW - 22, ry + 8, action, {
        fontFamily: F, fontSize: "11px", color: "#8899bb",
      }).setOrigin(1, 0);
    });

    // Resume button
    const btnY = py + panH - 42;
    const btnG = this.add.graphics()
      .fillStyle(0x1e2530, 1)
      .fillRect(px + 60, btnY, panW - 120, 32);
    btnG.lineStyle(1, 0x4455aa, 1);
    btnG.strokeRect(px + 60, btnY, panW - 120, 32);

    const resumeT = this.add.text(px + panW / 2, btnY + 16, "[ESC]  Retomar jogo", {
      fontFamily: F, fontSize: "12px", color: "#aabbdd",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // Pulse animation on resume hint
    this.tweens.add({
      targets: resumeT,
      alpha: 0.5,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    resumeT.on("pointerdown", resume);
    resumeT.on("pointerover", () => resumeT.setColor("#ffffff").setAlpha(1));
    resumeT.on("pointerout", () => resumeT.setColor("#aabbdd"));

    // ESC key
    const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.once("down", resume);
  }
}
