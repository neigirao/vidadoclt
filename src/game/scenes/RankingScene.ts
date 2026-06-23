import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { getTopScores, ScoreEntry } from "../systems/Ranking";

const ACCENT = "#f2a800";
const DIM    = "#555555";
const LIGHT  = "#eaeaea";
const BG     = 0x12151a;

export class RankingScene extends Phaser.Scene {
  constructor() {
    super("RankingScene");
  }

  async create() {
    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, BG);

    // Top bar
    const bar = this.add.graphics();
    bar.fillStyle(0x000000, 0.7);
    bar.fillRect(0, 0, GAME_WIDTH, 44);
    bar.lineStyle(1, 0x333333, 1);
    bar.lineBetween(0, 44, GAME_WIDTH, 44);

    this.add.text(GAME_WIDTH / 2, 14, "RANKING — TOP FUNCIONÁRIOS", {
      fontFamily: "monospace", fontSize: "16px", fontStyle: "bold", color: ACCENT,
    }).setOrigin(0.5);

    // Back button
    const back = this.add.text(18, 14, "← VOLTAR", {
      fontFamily: "monospace", fontSize: "12px", color: DIM,
    }).setInteractive({ useHandCursor: true });
    back.on("pointerover", () => back.setColor(LIGHT));
    back.on("pointerout",  () => back.setColor(DIM));
    back.on("pointerdown", () => this.scene.start("MenuScene"));
    this.input.keyboard?.once("keydown-ESC",   () => this.scene.start("MenuScene"));
    this.input.keyboard?.once("keydown-ENTER", () => this.scene.start("MenuScene"));

    // Loading indicator
    const loading = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "Carregando...", {
      fontFamily: "monospace", fontSize: "14px", color: DIM,
    }).setOrigin(0.5);

    const entries = await getTopScores(15);
    loading.destroy();

    if (entries.length === 0) {
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "Nenhum registro ainda.\nSeja o primeiro a escapar!", {
        fontFamily: "monospace", fontSize: "14px", color: DIM, align: "center",
      }).setOrigin(0.5);
      return;
    }

    this.drawTable(entries);
  }

  private drawTable(entries: ScoreEntry[]) {
    const startY = 64;
    const rowH   = 26;
    const cols   = { rank: 16, apelido: 48, recnh: 280, fase: 420, seed: 530, loops: 680 };

    // Header
    const hdr = [
      [cols.rank,   "#"],
      [cols.apelido,"FUNCIONÁRIO"],
      [cols.recnh,  "RECONHECIMENTO"],
      [cols.fase,   "FASE"],
      [cols.seed,   "SEED"],
      [cols.loops,  "LOOPS"],
    ];
    for (const [x, label] of hdr) {
      this.add.text(x as number, startY, label as string, {
        fontFamily: "monospace", fontSize: "9px", color: ACCENT,
      });
    }

    // Divider
    const g = this.add.graphics();
    g.lineStyle(1, 0x333333, 0.8);
    g.lineBetween(12, startY + 14, GAME_WIDTH - 12, startY + 14);

    entries.forEach((e, i) => {
      const y    = startY + 20 + i * rowH;
      const isMe = i < 3;
      const col  = isMe ? (i === 0 ? "#f2c14e" : i === 1 ? "#aaaaaa" : "#cd7f32") : LIGHT;

      if (i < 3) {
        const rowBg = this.add.graphics();
        rowBg.fillStyle(0xffffff, 0.03);
        rowBg.fillRect(12, y - 2, GAME_WIDTH - 24, rowH - 2);
      }

      this.add.text(cols.rank,   y, `${i + 1}.`,  { fontFamily: "monospace", fontSize: "11px", color: col });
      this.add.text(cols.apelido,y, e.apelido.slice(0, 16), { fontFamily: "monospace", fontSize: "11px", color: col });
      this.add.text(cols.recnh,  y, e.reconhecimento.toLocaleString("pt-BR"), { fontFamily: "monospace", fontSize: "11px", color: col });
      this.add.text(cols.fase,   y, e.reached_phase, { fontFamily: "monospace", fontSize: "10px", color: DIM });
      this.add.text(cols.seed,   y, e.seed || "-",   { fontFamily: "monospace", fontSize: "10px", color: DIM });
      this.add.text(cols.loops,  y, `${e.loop_count}x`, { fontFamily: "monospace", fontSize: "10px", color: DIM });
    });
  }
}
