import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { getRun, resetRun, savePersisted } from "../systems/PlayerState";
import { submitScore, phaseLabel } from "../systems/Ranking";
import { Sfx } from "../systems/AudioSystem";

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOverScene");
  }

  create(data: { vr?: number; cause?: "burnout" | "energy"; reachedScene?: string }) {
    const vr = data?.vr ?? 0;
    const cause = data?.cause ?? "energy";
    const reachedScene = data?.reachedScene ?? "OpenSpaceV2Scene";
    const earned = Math.floor(vr * 0.25);
    const run = getRun(this);
    run.reconhecimento += earned;
    run.loopCount += 1;
    savePersisted(run.reconhecimento, run.fgts, run.loopCount);
    Sfx.gameOver();

    run.lastDeathCause = cause;
    const isBurnout = cause === "burnout";
    this.cameras.main.setBackgroundColor(isBurnout ? "#1d0f15" : "#15171b");

    this.add.text(GAME_WIDTH / 2, 76,
      isBurnout ? "BURNOUT" : "RESCISAO DA TENTATIVA",
      { fontFamily: "monospace", fontSize: "26px", color: isBurnout ? "#8a2a55" : "#d14545" })
      .setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 122,
      isBurnout
        ? "Voce nao voltou da copa.\nO RH manda 'sentimos muito'."
        : "Demissao por justa causa.",
      { fontFamily: "monospace", fontSize: "13px", color: "#666666", align: "center" })
      .setOrigin(0.5);

    // Stats
    this.add.text(GAME_WIDTH / 2, 210,
      [
        `Vale Refeicao coletado:     ${vr}`,
        `Reconhecimento ganho:   +${earned}`,
        `Reconhecimento total:    ${run.reconhecimento}`,
        ``,
        `FGTS acumulado:          ${run.fgts} pts`,
        `Loop #${run.loopCount}`,
      ].join("\n"),
      { fontFamily: "monospace", fontSize: "14px", color: "#eaeaea", lineSpacing: 5 })
      .setOrigin(0.5);

    // FGTS sacar option (only when there's enough)
    if (run.fgts >= 10) {
      const bonus = Math.floor(run.fgts * 1.5);
      const fgtsBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 152,
        `[ SACAR FGTS: ${run.fgts} pts  ->  +${bonus} Reconhecimento ]`,
        { fontFamily: "monospace", fontSize: "13px", color: "#44ff88" })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      fgtsBtn.on("pointerover", () => fgtsBtn.setColor("#88ffbb"));
      fgtsBtn.on("pointerout", () => fgtsBtn.setColor("#44ff88"));
      fgtsBtn.on("pointerdown", () => {
        run.reconhecimento += bonus;
        run.fgts = 0;
        savePersisted(run.reconhecimento, run.fgts, run.loopCount);
        this.doRestart();
      });
    }

    // ── Ranking submission ──────────────────────────────────────────────────
    this.drawRankingInput(run.reconhecimento, run.loopCount, run.seed, reachedScene, run.characterClass);

    // Seed display
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 108,
      `SEED: ${run.seed}`,
      { fontFamily: "monospace", fontSize: "11px", color: "#2a4a2a" })
      .setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 93,
      "O despertador toca.\nE quarta-feira de novo.",
      { fontFamily: "monospace", fontSize: "13px", color: "#444444", align: "center" })
      .setOrigin(0.5);

    const btn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 54,
      "[ BATER O PONTO  —  ENTER ]",
      { fontFamily: "monospace", fontSize: "18px", color: "#f2c14e" })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on("pointerover", () => btn.setColor("#ffe080"));
    btn.on("pointerout", () => btn.setColor("#f2c14e"));
    btn.on("pointerdown", () => this.doRestart());
    this.input.keyboard?.once("keydown-ENTER", () => this.doRestart());
    this.input.keyboard?.once("keydown-SPACE", () => this.doRestart());
  }

  private drawRankingInput(
    reconhecimento: number,
    loopCount: number,
    seed: string,
    reachedScene: string,
    characterClass?: string,
  ) {
    const y = 310;
    this.add.text(GAME_WIDTH / 2, y, "SALVAR NO RANKING", {
      fontFamily: "monospace", fontSize: "9px", color: "#f2a800",
    }).setOrigin(0.5);

    // HTML input overlay for nickname
    const inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.maxLength = 16;
    inputEl.placeholder = "seu apelido";
    inputEl.value = "";
    Object.assign(inputEl.style, {
      position: "absolute", fontFamily: "monospace", fontSize: "13px",
      background: "#1a1d23", color: "#eaeaea", border: "1px solid #f2a800",
      padding: "4px 8px", outline: "none", textAlign: "center",
      width: "180px", left: "50%", transform: "translateX(-50%)",
    });
    // Position below "SALVAR NO RANKING" label — will be removed on destroy
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleY = rect.height / (this.game.config.height as number);
    inputEl.style.top = `${rect.top + (y + 14) * scaleY}px`;
    document.body.appendChild(inputEl);
    this.events.once("shutdown", () => inputEl.remove());
    this.events.once("destroy",  () => inputEl.remove());

    const saveBtn = this.add.text(GAME_WIDTH / 2, y + 38, "[ ENVIAR ]", {
      fontFamily: "monospace", fontSize: "13px", color: "#44ff88",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const doSave = async () => {
      const apelido = inputEl.value.trim() || "Anonimo";
      inputEl.remove();
      saveBtn.setText("SALVO ✓").setColor("#88ffbb").disableInteractive();
      await submitScore({
        apelido,
        reconhecimento,
        loop_count: loopCount,
        reached_phase: phaseLabel(reachedScene),
        seed,
        character_class: characterClass ?? null,
      });
    };

    saveBtn.on("pointerover", () => saveBtn.setColor("#88ffbb"));
    saveBtn.on("pointerout",  () => saveBtn.setColor("#44ff88"));
    saveBtn.on("pointerdown", doSave);
    inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") doSave(); });
  }

  private doRestart() {
    // Clean up any lingering input element
    document.querySelectorAll("input[placeholder='seu apelido']").forEach(el => el.remove());
    const run = getRun(this);
    const keep = { reconhecimento: run.reconhecimento, fgts: run.fgts, loopCount: run.loopCount };
    const fresh = resetRun(this);
    Object.assign(fresh, keep);
    this.scene.start("ClassSelectScene");
  }
}
