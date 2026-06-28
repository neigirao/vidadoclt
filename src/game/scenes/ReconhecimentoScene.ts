import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { getRun, savePersisted } from "../systems/PlayerState";
import {
  UPGRADES, UpgradeId, loadUpgrades, saveUpgrades, getLevel, nextCost,
} from "../systems/ReconhecimentoSystem";
import { Sfx } from "../systems/AudioSystem";

const BG = 0x12151a;
const CARD_BG = 0x1a1d23;
const ACCENT = 0xf2a800;
const TEXT_LIGHT = "#eaeaea";
const TEXT_DIM = "#888888";
const TEXT_ACCENT = "#f2a800";

const UPGRADE_ORDER: UpgradeId[] = [
  "cafe", "sindicalismo", "hora_extra",
  "plr", "resiliencia", "networking", "autonomia_base",
];

export class ReconhecimentoScene extends Phaser.Scene {
  constructor() { super("ReconhecimentoScene"); }

  create() {
    const run = getRun(this);
    const levels = loadUpgrades();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, BG);

    // Title
    this.add.text(GAME_WIDTH / 2, 28, "RECONHECIMENTO PROFISSIONAL", {
      fontSize: "18px", color: TEXT_ACCENT, fontFamily: "monospace", stroke: "#000", strokeThickness: 2,
    }).setOrigin(0.5, 0);

    // Reconhecimento counter
    const vrText = this.add.text(GAME_WIDTH / 2, 54, "", {
      fontSize: "13px", color: "#88ffbb", fontFamily: "monospace",
    }).setOrigin(0.5, 0);

    const refresh = () => {
      vrText.setText(`Reconhecimento disponível: ${run.reconhecimento.toLocaleString("pt-BR")} pts`);
    };
    refresh();

    // Grid of upgrade cards
    const COLS = 3;
    const CARD_W = 190;
    const CARD_H = 140;
    const PAD_X = 16;
    const PAD_Y = 14;
    const startX = (GAME_WIDTH - (COLS * CARD_W + (COLS - 1) * PAD_X)) / 2;
    const startY = 90;

    const cardTexts: Map<UpgradeId, Phaser.GameObjects.Text[]> = new Map();

    UPGRADE_ORDER.forEach((id, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = startX + col * (CARD_W + PAD_X);
      const cy = startY + row * (CARD_H + PAD_Y);
      const def = UPGRADES[id];

      const bg = this.add.rectangle(cx + CARD_W / 2, cy + CARD_H / 2, CARD_W, CARD_H, CARD_BG)
        .setStrokeStyle(1, 0x333344);

      const iconT = this.add.text(cx + 12, cy + 10, def.icon, { fontSize: "22px" });
      const nameT = this.add.text(cx + 44, cy + 12, def.name, {
        fontSize: "11px", color: def.color, fontFamily: "monospace",
        wordWrap: { width: CARD_W - 50 },
      });
      const descT = this.add.text(cx + 8, cy + 44, def.desc, {
        fontSize: "10px", color: TEXT_DIM, fontFamily: "monospace",
        wordWrap: { width: CARD_W - 16 },
      });
      const lvlT = this.add.text(cx + 8, cy + 82, "", {
        fontSize: "11px", color: TEXT_LIGHT, fontFamily: "monospace",
      });
      const costT = this.add.text(cx + 8, cy + 98, "", {
        fontSize: "10px", color: TEXT_ACCENT, fontFamily: "monospace",
      });
      const btnT = this.add.text(cx + CARD_W / 2, cy + CARD_H - 20, "[ INVESTIR ]", {
        fontSize: "11px", color: "#00ff88", fontFamily: "monospace",
      }).setOrigin(0.5);

      cardTexts.set(id, [lvlT, costT, btnT]);

      const updateCard = () => {
        const lvl = getLevel(levels, id);
        const cost = nextCost(levels, id);
        lvlT.setText(`Nível: ${lvl} / ${def.maxLevel}`);
        if (cost !== null) {
          costT.setText(`Custo: ${cost} pts`);
          const canAfford = run.reconhecimento >= cost;
          btnT.setVisible(true).setColor(canAfford ? "#00ff88" : "#666666");
          btnT.setText(canAfford ? "[ INVESTIR ]" : "[ SEM VERBA ]");
        } else {
          costT.setText("MÁXIMO");
          btnT.setVisible(false);
        }
        // Highlight border at max level
        bg.setStrokeStyle(1, lvl >= def.maxLevel ? Phaser.Display.Color.HexStringToColor(def.color).color : 0x333344);
      };
      updateCard();

      // Click to buy
      bg.setInteractive({ useHandCursor: true });
      const tryBuy = () => {
        const cost = nextCost(levels, id);
        if (cost === null || run.reconhecimento < cost) return;
        run.reconhecimento -= cost;
        levels[id] = (levels[id] ?? 0) + 1;
        saveUpgrades(levels);
        savePersisted(run.reconhecimento, run.fgts, run.loopCount);
        Sfx.perkSelect();
        refresh();
        // Update all cards (costs may have changed)
        UPGRADE_ORDER.forEach(uid => {
          const txts = cardTexts.get(uid);
          if (txts) {
            const lvl2 = getLevel(levels, uid);
            const cost2 = nextCost(levels, uid);
            txts[0].setText(`Nível: ${lvl2} / ${UPGRADES[uid].maxLevel}`);
            if (cost2 !== null) {
              txts[1].setText(`Custo: ${cost2} pts`);
              const canAfford2 = run.reconhecimento >= cost2;
              txts[2].setVisible(true).setColor(canAfford2 ? "#00ff88" : "#666666");
              txts[2].setText(canAfford2 ? "[ INVESTIR ]" : "[ SEM VERBA ]");
            } else {
              txts[1].setText("MÁXIMO");
              txts[2].setVisible(false);
            }
          }
        });
        updateCard();
      };
      bg.on("pointerdown", tryBuy);
      bg.on("pointerover", () => bg.setFillStyle(0x22263a));
      bg.on("pointerout", () => bg.setFillStyle(CARD_BG));
      btnT.setInteractive({ useHandCursor: true }).on("pointerdown", tryBuy);

      void iconT; void nameT; void descT;
    });

    // Back button
    const backY = startY + Math.ceil(UPGRADE_ORDER.length / COLS) * (CARD_H + PAD_Y) + 10;
    const backBtn = this.add.text(GAME_WIDTH / 2, Math.min(backY, GAME_HEIGHT - 30), "← VOLTAR  [ ESC ]", {
      fontSize: "13px", color: TEXT_DIM, fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on("pointerover", () => backBtn.setColor(TEXT_LIGHT));
    backBtn.on("pointerout", () => backBtn.setColor(TEXT_DIM));
    backBtn.on("pointerdown", () => this.goBack());

    this.input.keyboard?.on("keydown-ESC", () => this.goBack());
  }

  private goBack() {
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("MenuScene"));
  }
}
