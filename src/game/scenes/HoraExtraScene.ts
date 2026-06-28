import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { getRun } from "../systems/PlayerState";

const BG = 0x0d0a00;
const ACCENT = 0xff6600;
const TEXT_LIGHT = "#eaeaea";
const TEXT_DIM = "#888888";
const TEXT_ACCENT = "#ff6600";
const TEXT_RED = "#ff4444";

export type HeatModifierId = "boss_hp" | "sanity_drain" | "no_consumibles" | "fast_clock" | "enemy_speed";

interface HeatMod {
  id: HeatModifierId;
  icon: string;
  name: string;
  desc: string;
  penalty: string;
}

const HEAT_MODS: HeatMod[] = [
  {
    id: "boss_hp",
    icon: "💀",
    name: "CHEFE IMPLACÁVEL",
    desc: "Gerentes e CEO com +50% de HP.",
    penalty: "Chefes duram muito mais.",
  },
  {
    id: "sanity_drain",
    icon: "🧠",
    name: "PRESSÃO EXTREMA",
    desc: "Sanidade drena 2× mais rápido.",
    penalty: "Burnout chega mais cedo.",
  },
  {
    id: "no_consumibles",
    icon: "🚫",
    name: "CORTE DE BENEFÍCIOS",
    desc: "Consumíveis (Café, itens) não aparecem.",
    penalty: "Sem restauração de sanidade/energia.",
  },
  {
    id: "fast_clock",
    icon: "⏰",
    name: "RELÓGIO ACELERADO",
    desc: "O relógio do escritório corre 2× mais rápido, drenando sanidade passivamente.",
    penalty: "Tempo contra você o tempo todo.",
  },
  {
    id: "enemy_speed",
    icon: "⚡",
    name: "TURNO DE SPRINT",
    desc: "Todos os inimigos se movem 25% mais rápido.",
    penalty: "Menos margem de reação.",
  },
];

export class HoraExtraScene extends Phaser.Scene {
  private activeModifiers = new Set<HeatModifierId>();

  constructor() {
    super("HoraExtraScene");
  }

  create() {
    const run = getRun(this);

    // Restore previously active modifiers from run state
    const saved = (run as Record<string, unknown>).heatMods as HeatModifierId[] | undefined;
    this.activeModifiers = new Set(saved ?? []);

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, BG);

    // Flame scanlines
    const g = this.add.graphics();
    g.lineStyle(1, 0xff4400, 0.04);
    for (let y = 0; y < GAME_HEIGHT; y += 3) g.lineBetween(0, y, GAME_WIDTH, y);

    // Header
    const hdrG = this.add.graphics();
    hdrG.fillStyle(0x1a0800, 1);
    hdrG.fillRect(0, 0, GAME_WIDTH, 52);
    hdrG.lineStyle(2, ACCENT, 0.8);
    hdrG.lineBetween(0, 52, GAME_WIDTH, 52);

    this.add.text(GAME_WIDTH / 2, 10, "⏰ MODO HORA EXTRA", {
      fontFamily: "monospace", fontSize: "18px", fontStyle: "bold",
      color: TEXT_ACCENT, stroke: "#000", strokeThickness: 3,
    }).setOrigin(0.5, 0);

    this.add.text(GAME_WIDTH / 2, 34, "Ative modificadores para aumentar a dificuldade — e o Reconhecimento.", {
      fontFamily: "monospace", fontSize: "9px", color: TEXT_DIM,
    }).setOrigin(0.5, 0);

    // Modifier cards
    const cardW = 420;
    const cardH = 68;
    const startX = (GAME_WIDTH - cardW) / 2;
    const startY = 68;
    const gap = 8;

    HEAT_MODS.forEach((mod, i) => {
      const cy = startY + i * (cardH + gap);
      this.buildModCard(mod, startX, cy, cardW, cardH);
    });

    // Heat level indicator
    const heatY = startY + HEAT_MODS.length * (cardH + gap) + 8;
    const heatLbl = this.add.text(GAME_WIDTH / 2, heatY, "", {
      fontFamily: "monospace", fontSize: "13px", color: TEXT_ACCENT,
    }).setOrigin(0.5, 0);

    const bonusLbl = this.add.text(GAME_WIDTH / 2, heatY + 22, "", {
      fontFamily: "monospace", fontSize: "10px", color: "#88ff88",
    }).setOrigin(0.5, 0);

    const refreshLabels = () => {
      const n = this.activeModifiers.size;
      heatLbl.setText(`Nível de Hora Extra: ${n} / ${HEAT_MODS.length}  ${"🔥".repeat(n)}`);
      const bonus = n * 25;
      bonusLbl.setText(n > 0 ? `+${bonus}% Reconhecimento ao vencer a run` : "Nenhum modificador ativo — sem bônus.");
    };
    refreshLabels();

    // Listen for card toggle events
    this.events.on("heatToggle", refreshLabels);

    // Buttons
    const btnY = heatY + 52;

    const startBtn = this.add.text(GAME_WIDTH / 2 + 60, btnY, "[ INICIAR RUN ]", {
      fontFamily: "monospace", fontSize: "14px", fontStyle: "bold",
      color: "#00ff88",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    startBtn.on("pointerover", () => startBtn.setColor("#ffffff"));
    startBtn.on("pointerout", () => startBtn.setColor("#00ff88"));
    startBtn.on("pointerdown", () => this.startRun());

    const backBtn = this.add.text(GAME_WIDTH / 2 - 100, btnY, "← VOLTAR", {
      fontFamily: "monospace", fontSize: "13px", color: TEXT_DIM,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on("pointerover", () => backBtn.setColor(TEXT_LIGHT));
    backBtn.on("pointerout", () => backBtn.setColor(TEXT_DIM));
    backBtn.on("pointerdown", () => this.goBack());

    this.input.keyboard?.on("keydown-ESC", () => this.goBack());
    this.input.keyboard?.on("keydown-ENTER", () => this.startRun());

    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private buildModCard(mod: HeatMod, x: number, y: number, w: number, h: number) {
    const isActive = () => this.activeModifiers.has(mod.id);

    const bg = this.add.graphics();
    const iconT = this.add.text(x + 16, y + h / 2, mod.icon, {
      fontSize: "22px",
    }).setOrigin(0, 0.5);
    const nameT = this.add.text(x + 52, y + 10, mod.name, {
      fontFamily: "monospace", fontSize: "11px", fontStyle: "bold", color: TEXT_LIGHT,
    });
    const descT = this.add.text(x + 52, y + 26, mod.desc, {
      fontFamily: "monospace", fontSize: "8px", color: TEXT_DIM,
      wordWrap: { width: w - 110 },
    });
    const penaltyT = this.add.text(x + 52, y + 46, mod.penalty, {
      fontFamily: "monospace", fontSize: "8px", color: TEXT_RED,
    });
    const toggleT = this.add.text(x + w - 8, y + h / 2, "", {
      fontFamily: "monospace", fontSize: "11px",
    }).setOrigin(1, 0.5);

    const redraw = () => {
      const active = isActive();
      bg.clear();
      bg.fillStyle(active ? 0x2a1500 : 0x0f1018, 1);
      bg.fillRect(x, y, w, h);
      bg.lineStyle(2, active ? ACCENT : 0x333344, 1);
      bg.strokeRect(x, y, w, h);
      if (active) {
        bg.lineStyle(1, ACCENT, 0.3);
        bg.lineBetween(x, y + h - 1, x + w, y + h - 1);
      }
      toggleT.setText(active ? "[ ATIVO ✓ ]" : "[ INATIVO ]");
      toggleT.setColor(active ? "#ff8800" : "#444444");
      nameT.setColor(active ? TEXT_ACCENT : TEXT_LIGHT);
    };
    redraw();

    const hit = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => {
      if (this.activeModifiers.has(mod.id)) {
        this.activeModifiers.delete(mod.id);
      } else {
        this.activeModifiers.add(mod.id);
      }
      redraw();
      this.events.emit("heatToggle");
    });
    hit.on("pointerover", () => {
      bg.lineStyle(2, 0xffa500, 1);
      bg.strokeRect(x, y, w, h);
    });
    hit.on("pointerout", () => redraw());

    void iconT; void nameT; void descT; void penaltyT; void toggleT;
  }

  private startRun() {
    const run = getRun(this);
    const mods = Array.from(this.activeModifiers);
    (run as Record<string, unknown>).heatMods = mods;
    (run as Record<string, unknown>).heatBossHpMult = mods.includes("boss_hp") ? 1.5 : 1.0;
    (run as Record<string, unknown>).heatSanityDrainMult = mods.includes("sanity_drain") ? 2.0 : 1.0;
    (run as Record<string, unknown>).heatNoConsumibles = mods.includes("no_consumibles");
    (run as Record<string, unknown>).heatFastClock = mods.includes("fast_clock");
    (run as Record<string, unknown>).heatEnemySpeedMult = mods.includes("enemy_speed") ? 1.25 : 1.0;
    (run as Record<string, unknown>).heatBonus = mods.length * 0.25;

    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("ClassSelectScene");
    });
  }

  private goBack() {
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("MenuScene"));
  }
}
