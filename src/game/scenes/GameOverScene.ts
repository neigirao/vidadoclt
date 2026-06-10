import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOverScene");
  }

  create(data: { vr?: number }) {
    const vr = data?.vr ?? 0;
    const reconhecimento = Math.floor(vr * 0.25);

    this.cameras.main.setBackgroundColor("#15171b");

    this.add.text(GAME_WIDTH / 2, 120, "RESCISÃO DA TENTATIVA", {
      fontFamily: "monospace",
      fontSize: "28px",
      color: "#d14545",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 170, "Demissão por justa causa.", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#cccccc",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 230,
      `Vale Refeição coletado: ${vr}\nConvertido em Reconhecimento: ${reconhecimento}`,
      { fontFamily: "monospace", fontSize: "14px", color: "#eaeaea", align: "center" })
      .setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 320, "O despertador toca.\nÉ quarta-feira de novo.", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#888888",
      align: "center",
    }).setOrigin(0.5);

    const btn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 110, "[ BATER O PONTO — ENTER ]", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#f2c14e",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const restart = () => this.scene.start("OpenSpaceScene");
    btn.on("pointerdown", restart);
    this.input.keyboard?.once("keydown-ENTER", restart);
    this.input.keyboard?.once("keydown-SPACE", restart);
  }
}
