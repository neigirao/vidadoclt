import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { getRun, resetRun, savePersisted } from "../systems/PlayerState";
import { submitScore, phaseLabel } from "../systems/Ranking";
import { Sfx } from "../systems/AudioSystem";
import { PERKS, SYNERGIES, PerkId, SynergyId } from "../systems/PerkSystem";
import { CULTURAS, CulturaId } from "../systems/CulturaSystem";

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
    this.cameras.main.setBackgroundColor(isBurnout ? "#0e080d" : "#0c0e11");
    this.cameras.main.fadeIn(600, 0, 0, 0);

    // ── Ilustração procedural ─────────────────────────────────────────────────
    const art = this.add.graphics();

    // Desk (escritório vazio — pós-demissão)
    const deskX = GAME_WIDTH / 2 - 110;
    const deskY = 195;
    art.fillStyle(0x3a2010, 1);
    art.fillRect(deskX, deskY, 220, 18); // tampo
    art.fillStyle(0x2a1808, 1);
    art.fillRect(deskX + 6, deskY + 18, 14, 38); // perna esq
    art.fillRect(deskX + 200, deskY + 18, 14, 38); // perna dir
    // Monitor apagado
    art.fillStyle(0x1a1a1a, 1);
    art.fillRect(deskX + 78, deskY - 50, 64, 44); // tela
    art.fillStyle(0x111111, 1);
    art.fillRect(deskX + 78, deskY - 50, 64, 44);
    art.fillStyle(0x0a0a0a, 1);
    art.fillRect(deskX + 82, deskY - 46, 56, 36); // inner tela
    art.fillStyle(0x1a1a1a, 1);
    art.fillRect(deskX + 104, deskY - 7, 12, 8); // pescoço
    // Caixinha de pertences (demitido leva as coisas)
    art.fillStyle(0x8b5a20, 1);
    art.fillRect(deskX + 148, deskY - 42, 40, 36);
    art.fillStyle(0x7a4e18, 1);
    art.strokeRect(deskX + 148, deskY - 42, 40, 36);
    art.fillStyle(0x6a3e0e, 1);
    art.fillRect(deskX + 152, deskY - 20, 8, 14); // item na caixa
    art.fillRect(deskX + 164, deskY - 26, 6, 20);
    art.fillRect(deskX + 174, deskY - 22, 8, 16);
    // Relógio de parede — 18:00
    const clockX = GAME_WIDTH / 2 + 80;
    const clockY = 100;
    art.fillStyle(0x222222, 1);
    art.fillCircle(clockX, clockY, 28);
    art.lineStyle(2, 0x888888, 1);
    art.strokeCircle(clockX, clockY, 28);
    // Ponteiros em 18:00 (6h = ponteiro grande pra baixo, pequeno pra cima)
    art.lineStyle(2, 0xdddddd, 1);
    art.lineBetween(clockX, clockY, clockX, clockY + 20); // min = 12
    art.lineBetween(clockX, clockY, clockX, clockY - 14); // hora = 6
    // Marcas do relógio
    art.lineStyle(1, 0x555555, 1);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r1 = 22;
      const r2 = 26;
      art.lineBetween(
        clockX + Math.cos(a) * r1,
        clockY + Math.sin(a) * r1,
        clockX + Math.cos(a) * r2,
        clockY + Math.sin(a) * r2,
      );
    }
    // Carimbo DEMISSÃO / BURNOUT
    const stampG = this.add.graphics();
    stampG.lineStyle(3, isBurnout ? 0x8a2a55 : 0xd14545, 0.85);
    stampG.strokeRect(deskX + 10, deskY - 68, 120, 32);
    const stampInner = isBurnout ? "BURNOUT" : "RESCISAO";
    this.add
      .text(deskX + 70, deskY - 52, stampInner, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: isBurnout ? "#8a2a55" : "#d14545",
      })
      .setOrigin(0.5)
      .setAngle(-8);
    // Sombra do personagem — silhueta no chão (simplificada)
    art.fillStyle(0x000000, 0.25);
    art.fillEllipse(GAME_WIDTH / 2 - 60, deskY + 58, 60, 10);

    // ── Narrador contextual ───────────────────────────────────────────────────
    const NARRATORS: Record<string, string[]> = {
      burnout: [
        "Você saiu pelo mesmo corredor.\nMas desta vez não chegou à saída.",
        "O RH manda 'sentimos muito'.\nNa segunda-feira, já tem alguém na sua cadeira.",
        "Burnout não é fraqueza.\nMas no sistema deles, conta como falha.",
      ],
      energy: [
        "Demissão por justa causa.\nSeu crachá foi desativado às 18h02.",
        "O gerente não era pessoal.\nEra só o sistema funcionando como projetado.",
        "Você tentou sair cedo uma vez.\nNão vai acontecer de novo — não deste jeito.",
      ],
    };
    const msgs = NARRATORS[cause];
    const narratorMsg = msgs[run.loopCount % msgs.length];
    this.add
      .text(GAME_WIDTH / 2, 274, narratorMsg, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#555555",
        align: "center",
        lineSpacing: 4,
      })
      .setOrigin(0.5);

    // ── Stats ─────────────────────────────────────────────────────────────────
    this.add
      .text(
        GAME_WIDTH / 2,
        336,
        [
          `VR coletado:          ${vr}`,
          `Reconhecimento:   +${earned}  (total ${run.reconhecimento})`,
          `FGTS acumulado:    ${run.fgts} pts   •   Loop #${run.loopCount}`,
        ].join("\n"),
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#888888",
          lineSpacing: 5,
          align: "center",
        },
      )
      .setOrigin(0.5);

    // ── Build summary — a "história" desta run (perks + culturas + sinergias) ──
    this.drawBuildSummary(run, 372);

    // FGTS sacar option (only when there's enough)
    if (run.fgts >= 10) {
      const bonus = Math.floor(run.fgts * 1.5);
      const fgtsBtn = this.add
        .text(
          GAME_WIDTH / 2,
          GAME_HEIGHT - 152,
          `[ SACAR FGTS: ${run.fgts} pts  ->  +${bonus} Reconhecimento ]`,
          { fontFamily: "monospace", fontSize: "13px", color: "#44ff88" },
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
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
    this.drawRankingInput(
      run.reconhecimento,
      run.loopCount,
      run.seed,
      reachedScene,
      run.characterClass,
    );

    // Seed display
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 108, `SEED: ${run.seed}`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#2a4a2a",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 93, "O despertador toca.\nE quarta-feira de novo.", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#444444",
        align: "center",
      })
      .setOrigin(0.5);

    const btn = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 54, "[ BATER O PONTO  —  ENTER ]", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#f2c14e",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

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
    this.add
      .text(GAME_WIDTH / 2, y, "SALVAR NO RANKING", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#f2a800",
      })
      .setOrigin(0.5);

    // HTML input overlay for nickname
    const inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.maxLength = 16;
    inputEl.placeholder = "seu apelido";
    inputEl.value = "";
    Object.assign(inputEl.style, {
      position: "absolute",
      fontFamily: "monospace",
      fontSize: "13px",
      background: "#1a1d23",
      color: "#eaeaea",
      border: "1px solid #f2a800",
      padding: "4px 8px",
      outline: "none",
      textAlign: "center",
      width: "180px",
      left: "50%",
      transform: "translateX(-50%)",
    });
    // Position below "SALVAR NO RANKING" label — will be removed on destroy
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleY = rect.height / (this.game.config.height as number);
    inputEl.style.top = `${rect.top + (y + 14) * scaleY}px`;
    document.body.appendChild(inputEl);
    this.events.once("shutdown", () => inputEl.remove());
    this.events.once("destroy", () => inputEl.remove());

    const saveBtn = this.add
      .text(GAME_WIDTH / 2, y + 38, "[ ENVIAR ]", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#44ff88",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

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
    saveBtn.on("pointerout", () => saveBtn.setColor("#44ff88"));
    saveBtn.on("pointerdown", doSave);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSave();
    });
  }

  /** Item 7 — retrospectiva da build: linha de ícones de perks, culturas e sinergias. */
  private drawBuildSummary(run: ReturnType<typeof getRun>, y: number) {
    const perks = (run.perks ?? []) as PerkId[];
    const culturas = (run.culturas ?? []) as CulturaId[];
    const synergies = (run.activeSynergies ?? []) as SynergyId[];
    if (!perks.length && !culturas.length && !synergies.length) return;

    const chips: { icon: string; color: string }[] = [
      ...perks.map((p) => ({ icon: PERKS[p]?.icon ?? "?", color: "#88bbff" })),
      ...culturas.map((c) => ({ icon: CULTURAS[c]?.icon ?? "?", color: "#ffcc66" })),
      ...synergies.map((s) => ({ icon: SYNERGIES[s]?.icon ?? "★", color: "#ff88dd" })),
    ];

    this.add
      .text(GAME_WIDTH / 2, y, "SUA BUILD NESTA TENTATIVA", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#666666",
      })
      .setOrigin(0.5);

    const spacing = 26;
    const totalW = chips.length * spacing;
    const startX = GAME_WIDTH / 2 - totalW / 2 + spacing / 2;
    chips.forEach((chip, i) => {
      const cx = startX + i * spacing;
      this.add.rectangle(cx, y + 22, 22, 22, 0x1a1d23).setStrokeStyle(1, 0x333344);
      this.add
        .text(cx, y + 22, chip.icon, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: chip.color,
        })
        .setOrigin(0.5);
    });
    if (synergies.length) {
      this.add
        .text(GAME_WIDTH / 2, y + 40, `${synergies.length} sinergia(s) ativada(s)!`, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#ff88dd",
        })
        .setOrigin(0.5);
    }
  }

  private doRestart() {
    // Clean up any lingering input element
    document.querySelectorAll("input[placeholder='seu apelido']").forEach((el) => el.remove());
    const run = getRun(this);
    const keep = { reconhecimento: run.reconhecimento, fgts: run.fgts, loopCount: run.loopCount };
    const fresh = resetRun(this);
    Object.assign(fresh, keep);
    this.scene.start("ReconhecimentoScene");
  }
}
