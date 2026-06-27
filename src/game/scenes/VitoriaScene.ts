import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { getRun, savePersisted } from "../systems/PlayerState";
import { Sfx } from "../systems/AudioSystem";

export class VitoriaScene extends Phaser.Scene {
  constructor() {
    super("VitoriaScene");
  }

  create(data: { vr?: number; reconhecimento?: number; loopCount?: number }) {
    const run = getRun(this);
    const reconhecimento = data.reconhecimento ?? run.reconhecimento;
    const loopCount = data.loopCount ?? run.loopCount ?? 1;

    Sfx.victory();
    this.cameras.main.setBackgroundColor("#0a0c10");

    // Gold shimmer
    const shimmer = this.add.graphics();
    for (let i = 0; i < 40; i++) {
      shimmer.fillStyle(0xf2c14e, Phaser.Math.Between(1, 4) * 0.07);
      const cx = Phaser.Math.Between(0, GAME_WIDTH);
      const cy = Phaser.Math.Between(0, GAME_HEIGHT);
      shimmer.fillCircle(cx, cy, Phaser.Math.Between(2, 8));
    }

    // Title
    const title = this.add.text(GAME_WIDTH / 2, 80, "VOCÊ ESCAPOU!", {
      fontFamily: "monospace", fontSize: "32px", fontStyle: "bold",
      color: "#f2c14e", stroke: "#000000", strokeThickness: 5,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: title, alpha: 1, duration: 1200, delay: 200 });

    const subtitle = this.add.text(GAME_WIDTH / 2, 130, "O relógio marcou 18:00 — e você viu a saída.", {
      fontFamily: "monospace", fontSize: "13px", color: "#cccccc",
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: subtitle, alpha: 1, duration: 800, delay: 1000 });

    // Stats
    const statsY = 200;
    const lines = [
      `Reconhecimento total:  ${reconhecimento}`,
      `Loops completos:       ${loopCount}`,
      `VR acumulado:          ${data.vr ?? run.vr}`,
    ];

    lines.forEach((line, i) => {
      const t = this.add.text(GAME_WIDTH / 2, statsY + i * 36, line, {
        fontFamily: "monospace", fontSize: "15px", color: "#eaeaea",
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 700, delay: 1600 + i * 300 });
    });

    // Flavor
    const flavor = this.add.text(GAME_WIDTH / 2, 370,
      "\"Amanhã é segunda-feira. O ciclo recomeça.\nMas hoje — hoje você foi livre.\"",
      {
        fontFamily: "monospace", fontSize: "12px", color: "#888888",
        align: "center",
      }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: flavor, alpha: 1, duration: 900, delay: 2800 });

    // Loop counter bonus note
    if (loopCount > 1) {
      const bonus = this.add.text(GAME_WIDTH / 2, 430,
        `Bônus de Reconhecimento por ${loopCount} loops: +${(loopCount - 1) * 50}`,
        { fontFamily: "monospace", fontSize: "11px", color: "#44cc88" }
      ).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: bonus, alpha: 1, duration: 700, delay: 3200 });

      const r = getRun(this);
      r.reconhecimento += (loopCount - 1) * 50;
      savePersisted(r.reconhecimento, r.fgts, r.loopCount);
    }

    // Buttons
    const btnY = 480;

    const btnAgain = this.add.text(GAME_WIDTH / 2 - 120, btnY, "[ R ]  Novo loop", {
      fontFamily: "monospace", fontSize: "14px", color: "#f2c14e",
      backgroundColor: "#1a1c22", padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0);

    const btnMenu = this.add.text(GAME_WIDTH / 2 + 120, btnY, "[ M ]  Menu principal", {
      fontFamily: "monospace", fontSize: "14px", color: "#aaaaaa",
      backgroundColor: "#1a1c22", padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0);

    this.tweens.add({ targets: [btnAgain, btnMenu], alpha: 1, duration: 700, delay: 3500 });

    btnAgain.on("pointerover", () => btnAgain.setColor("#ffffff"));
    btnAgain.on("pointerout",  () => btnAgain.setColor("#f2c14e"));
    btnAgain.on("pointerdown", () => this.startNewLoop());

    btnMenu.on("pointerover", () => btnMenu.setColor("#ffffff"));
    btnMenu.on("pointerout",  () => btnMenu.setColor("#aaaaaa"));
    btnMenu.on("pointerdown", () => this.scene.start("MenuScene"));

    // Keyboard
    const rKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    const mKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);

    this.time.delayedCall(3500, () => {
      rKey.on("down", () => this.startNewLoop());
      mKey.on("down", () => this.scene.start("MenuScene"));
    });
  }

  private startNewLoop() {
    const run = getRun(this);
    // Keep reconhecimento + fgts, reset run state
    const reconhecimento = run.reconhecimento;
    const fgts = run.fgts;
    const loopCount = (run.loopCount ?? 1) + 1;

    // Reset run via registry
    this.registry.set("run", undefined);
    const freshRun = getRun(this); // reinitializes
    freshRun.reconhecimento = reconhecimento;
    freshRun.fgts = fgts;
    freshRun.loopCount = loopCount;
    savePersisted(reconhecimento, fgts, loopCount);

    this.scene.start("ClassSelectScene");
  }
}
