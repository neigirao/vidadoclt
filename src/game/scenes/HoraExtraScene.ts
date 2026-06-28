/**
 * HoraExtraScene — Heat System
 *
 * Acessada via menu ou automaticamente após N loops.
 * Mostra o "calor" acumulado da run, que aumenta a dificuldade em troca de
 * bônus de VR e Reconhecimento.
 */
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { getRun, savePersisted } from "../systems/PlayerState";

const F = "monospace";
const ACCENT = 0xf2a800;
const TEXT_ACCENT = "#f2a800";
const TEXT_LIGHT = "#eaeaea";
const TEXT_DIM = "#666666";

/** Heat levels — index = heatLevel (0–5) */
export const HEAT_LEVELS = [
  { label: "Normal",          hpMult: 1.0, vrMult: 1.0,  recoBonus: 0   },
  { label: "Morno",           hpMult: 1.15, vrMult: 1.1, recoBonus: 50  },
  { label: "Aquecido",        hpMult: 1.3,  vrMult: 1.2, recoBonus: 120 },
  { label: "Hora Extra",      hpMult: 1.5,  vrMult: 1.35, recoBonus: 250 },
  { label: "Burnout Ativo",   hpMult: 1.8,  vrMult: 1.5,  recoBonus: 500 },
  { label: "Deadline Final",  hpMult: 2.2,  vrMult: 2.0,  recoBonus: 1200 },
];

export class HoraExtraScene extends Phaser.Scene {
  private selectedHeat = 0;

  constructor() {
    super("HoraExtraScene");
  }

  create() {
    const run = getRun(this);
    this.selectedHeat = run.heatLevel ?? 0;

    this.cameras.main.setBackgroundColor("#0a0c10");
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Title
    this.add.text(GAME_WIDTH / 2, 28, "HORA EXTRA — MODO CALOR", {
      fontFamily: F, fontSize: "18px", fontStyle: "bold", color: TEXT_ACCENT,
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 54, "Aumentar o calor dificulta o jogo mas multiplica as recompensas.", {
      fontFamily: F, fontSize: "9px", color: TEXT_DIM,
    }).setOrigin(0.5);

    // Loop count info
    this.add.text(GAME_WIDTH / 2, 72, `Loop atual: ${run.loopCount ?? 0}   Reconhecimento: ${run.reconhecimento.toLocaleString("pt-BR")}`, {
      fontFamily: F, fontSize: "9px", color: "#888888",
    }).setOrigin(0.5);

    this.buildHeatList();
    this.buildLegend();
    this.buildConfirmButton(run);

    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("MenuScene"));
    this.input.keyboard?.on("keydown-UP",   () => this.adjustHeat(-1));
    this.input.keyboard?.on("keydown-DOWN", () => this.adjustHeat(1));
    this.input.keyboard?.on("keydown-ENTER", () => this.confirmHeat(run));
    this.input.keyboard?.on("keydown-SPACE", () => this.confirmHeat(run));
  }

  private heatCards: Phaser.GameObjects.Container[] = [];
  private confirmBtn?: Phaser.GameObjects.Text;

  private buildHeatList() {
    this.heatCards = [];
    const startY = 100;
    const rowH = 54;

    HEAT_LEVELS.forEach((level, i) => {
      const y = startY + i * rowH;
      const cx = GAME_WIDTH / 2;

      const card = this.add.container(cx, y);

      const bg = this.add.graphics();
      bg.fillStyle(i === this.selectedHeat ? 0x1a1200 : 0x0d0f14, 1);
      bg.fillRect(-360, 0, 720, rowH - 4);
      bg.lineStyle(2, i === this.selectedHeat ? ACCENT : 0x2a2e38, 1);
      bg.strokeRect(-360, 0, 720, rowH - 4);
      card.add(bg);

      const heatColor = this.heatColor(i);

      // Heat indicator bars
      for (let b = 0; b < 5; b++) {
        const barG = this.add.graphics();
        barG.fillStyle(b < i ? heatColor : 0x1a1a22, 1);
        barG.fillRect(-350 + b * 18, 8, 14, rowH - 20);
        card.add(barG);
      }

      // Level label
      card.add(this.add.text(-260, 8, `[${i}] ${level.label.toUpperCase()}`, {
        fontFamily: F, fontSize: "13px", fontStyle: i === this.selectedHeat ? "bold" : "normal",
        color: i === this.selectedHeat ? TEXT_ACCENT : TEXT_LIGHT,
      }));

      // Stats
      card.add(this.add.text(-260, 26, `HP ×${level.hpMult.toFixed(2)}   VR ×${level.vrMult.toFixed(2)}   +${level.recoBonus} Reco/run`, {
        fontFamily: F, fontSize: "8px",
        color: i === this.selectedHeat ? "#ddcc88" : "#555566",
      }));

      // Click to select
      const hit = this.add.rectangle(0, rowH / 2 - 2, 720, rowH - 4, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => { this.selectedHeat = i; this.rebuildHeatList(); });
      hit.on("pointerover", () => { if (i !== this.selectedHeat) bg.setAlpha(0.7); });
      hit.on("pointerout",  () => bg.setAlpha(1));
      card.add(hit);

      this.heatCards.push(card);
    });
  }

  private rebuildHeatList() {
    this.heatCards.forEach(c => c.destroy());
    this.buildHeatList();
    this.confirmBtn?.setText(`CONFIRMAR: ${HEAT_LEVELS[this.selectedHeat].label.toUpperCase()}  [ENTER]`);
  }

  private adjustHeat(delta: number) {
    this.selectedHeat = Phaser.Math.Clamp(this.selectedHeat + delta, 0, HEAT_LEVELS.length - 1);
    this.rebuildHeatList();
  }

  private buildLegend() {
    const ly = GAME_HEIGHT - 90;
    this.add.text(GAME_WIDTH / 2, ly, "CALOR AFETA: HP dos inimigos · VR dropado · Bônus de Reconhecimento ao fim da run", {
      fontFamily: F, fontSize: "8px", color: TEXT_DIM, align: "center",
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, ly + 16, "↑↓ Selecionar   ENTER Confirmar   ESC Voltar", {
      fontFamily: F, fontSize: "8px", color: "#333344",
    }).setOrigin(0.5);
  }

  private buildConfirmButton(run: import("../systems/PlayerState").RunState) {
    this.confirmBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50,
      `CONFIRMAR: ${HEAT_LEVELS[this.selectedHeat].label.toUpperCase()}  [ENTER]`, {
        fontFamily: F, fontSize: "13px", fontStyle: "bold",
        color: TEXT_ACCENT, stroke: "#000000", strokeThickness: 2,
        backgroundColor: "#1a1200", padding: { x: 18, y: 8 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.confirmBtn.on("pointerdown", () => this.confirmHeat(run));
    this.confirmBtn.on("pointerover", () => this.confirmBtn?.setColor("#ffffff"));
    this.confirmBtn.on("pointerout",  () => this.confirmBtn?.setColor(TEXT_ACCENT));
  }

  private confirmHeat(run: import("../systems/PlayerState").RunState) {
    run.heatLevel = this.selectedHeat;
    savePersisted(run.reconhecimento, run.fgts, run.loopCount);
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("MenuScene");
    });
  }

  private heatColor(level: number): number {
    const colors = [0x444444, 0xffcc44, 0xff8800, 0xff4400, 0xff2222, 0xff00ff];
    return colors[level] ?? 0xff00ff;
  }
}
