import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { getRun, resetRun } from "../systems/PlayerState";

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOverScene");
  }

  create(data: { vr?: number; cause?: "burnout" | "energy" }) {
    const vr = data?.vr ?? 0;
    const cause = data?.cause ?? "energy";
    const reconhecimento = Math.floor(vr * 0.25);
    const run = getRun(this);
    run.reconhecimento += reconhecimento;

    this.cameras.main.setBackgroundColor(cause === "burnout" ? "#1d0f15" : "#15171b");

    this.add.text(GAME_WIDTH / 2, 110,
      cause === "burnout" ? "BURNOUT" : "RESCISÃO DA TENTATIVA",
      { fontFamily: "monospace", fontSize: "28px", color: cause === "burnout" ? "#8a2a55" : "#d14545" })
      .setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 160,
      cause === "burnout"
        ? "Você não voltou da copa.\nO RH manda 'sentimos muito'."
        : "Demissão por justa causa.",
      { fontFamily: "monospace", fontSize: "14px", color: "#cccccc", align: "center" })
      .setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 230,
      `Vale Refeição coletado: ${vr}\nConvertido em Reconhecimento: +${reconhecimento}\nReconhecimento total: ${run.reconhecimento}`,
      { fontFamily: "monospace", fontSize: "14px", color: "#eaeaea", align: "center" })
      .setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 330, "O despertador toca.\nÉ quarta-feira de novo.", {
      fontFamily: "monospace", fontSize: "14px", color: "#888888", align: "center",
    }).setOrigin(0.5);

    const btn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 110, "[ BATER O PONTO — ENTER ]", {
      fontFamily: "monospace", fontSize: "18px", color: "#f2c14e",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const restart = () => {
      const keep = run.reconhecimento;
      const fresh = resetRun(this);
      fresh.reconhecimento = keep;
      this.scene.start("OpenSpaceScene");
    };
    btn.on("pointerdown", restart);
    this.input.keyboard?.once("keydown-ENTER", restart);
    this.input.keyboard?.once("keydown-SPACE", restart);
  }
}
