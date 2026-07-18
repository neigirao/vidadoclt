import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { getRun, savePersisted } from "../systems/PlayerState";
import {
  UPGRADES,
  UpgradeId,
  loadUpgrades,
  saveUpgrades,
  getLevel,
  nextCost,
  isLocked,
} from "../systems/ReconhecimentoSystem";
import { Sfx } from "../systems/AudioSystem";

const BG = 0x12151a;
const CARD_BG = 0x1a1d23;
const ACCENT = 0xf2a800;
const TEXT_LIGHT = "#eaeaea";
const TEXT_DIM = "#888888";
const TEXT_ACCENT = "#f2a800";

const UPGRADE_ORDER: UpgradeId[] = [
  "cafe",
  "sindicalismo",
  "hora_extra",
  "plr",
  "resiliencia",
  "networking",
  "autonomia_base",
  "carteira_assinada",
  "banco_de_horas",
  "insalubridade",
  "vale_alimentacao",
  "inss",
  "participacao_lucros",
  "beneficios_clt",
  "processei_empresa",
];

export class ReconhecimentoScene extends Phaser.Scene {
  constructor() {
    super("ReconhecimentoScene");
  }

  create() {
    const run = getRun(this);
    const levels = loadUpgrades();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, BG);

    // Title
    this.add
      .text(GAME_WIDTH / 2, 8, "RECONHECIMENTO PROFISSIONAL", {
        fontSize: "16px",
        color: TEXT_ACCENT,
        fontFamily: "monospace",
        stroke: "#000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);

    // Reconhecimento counter
    const vrText = this.add
      .text(GAME_WIDTH / 2, 30, "", {
        fontSize: "12px",
        color: "#88ffbb",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0);

    const refresh = () => {
      vrText.setText(
        `Reconhecimento disponível: ${run.reconhecimento.toLocaleString("pt-BR")} pts`,
      );
    };
    refresh();

    // Grid of upgrade cards
    const COLS = 3;
    const CARD_W = 190;
    const CARD_H = 84;
    const PAD_X = 16;
    const PAD_Y = 5;
    const startX = (GAME_WIDTH - (COLS * CARD_W + (COLS - 1) * PAD_X)) / 2;
    const startY = 62;

    const cardTexts: Map<UpgradeId, Phaser.GameObjects.Text[]> = new Map();
    const cardUpdaters: Map<UpgradeId, () => void> = new Map();

    UPGRADE_ORDER.forEach((id, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = startX + col * (CARD_W + PAD_X);
      const cy = startY + row * (CARD_H + PAD_Y);
      const def = UPGRADES[id];

      const bg = this.add
        .rectangle(cx + CARD_W / 2, cy + CARD_H / 2, CARD_W, CARD_H, CARD_BG)
        .setStrokeStyle(1, 0x333344);

      const iconT = this.add.text(cx + 12, cy + 5, def.icon, { fontSize: "16px" });
      const nameT = this.add.text(cx + 36, cy + 6, def.name, {
        fontSize: "9px",
        color: def.color,
        fontFamily: "monospace",
        wordWrap: { width: CARD_W - 42 },
      });
      const descT = this.add.text(cx + 8, cy + 26, def.desc, {
        fontSize: "8px",
        color: TEXT_DIM,
        fontFamily: "monospace",
        wordWrap: { width: CARD_W - 16 },
      });
      const lvlT = this.add.text(cx + 8, cy + 50, "", {
        fontSize: "9px",
        color: TEXT_LIGHT,
        fontFamily: "monospace",
      });
      const costT = this.add.text(cx + 8, cy + 61, "", {
        fontSize: "8px",
        color: TEXT_ACCENT,
        fontFamily: "monospace",
      });
      const btnT = this.add.text(cx + 8, cy + 72, "[ INVESTIR ]", {
        fontSize: "9px",
        color: "#00ff88",
        fontFamily: "monospace",
      });

      cardTexts.set(id, [lvlT, costT, btnT]);

      const updateCard = () => {
        const lvl = getLevel(levels, id);
        const cost = nextCost(levels, id);
        const lockedBy = isLocked(levels, id);
        lvlT.setText(`Nível: ${lvl} / ${def.maxLevel}`);
        // Projeção de impacto: troca o desc genérico pelo ganho CONCRETO da
        // PRÓXIMA run (agora → após investir). Só nos upgrades escalares.
        if (def.proj) {
          const cur = def.proj.step * lvl;
          const nxt = def.proj.step * (lvl + 1);
          descT.setText(
            cost !== null
              ? `Próx. run: +${cur} → +${nxt} ${def.proj.unit}`
              : `Próx. run: +${cur} ${def.proj.unit} (máx)`,
          );
        }
        if (lockedBy) {
          costT.setText(`TRANCADO por ${UPGRADES[lockedBy].name}`).setColor("#aa5555");
          btnT.setVisible(false);
          bg.setStrokeStyle(1, 0x553333).setFillStyle(0x16100f);
          return;
        }
        if (cost !== null) {
          costT.setText(`Custo: ${cost} pts`).setColor(TEXT_ACCENT);
          const canAfford = run.reconhecimento >= cost;
          btnT.setVisible(true).setColor(canAfford ? "#00ff88" : "#666666");
          btnT.setText(canAfford ? "[ INVESTIR ]" : "[ SEM VERBA ]");
        } else {
          costT.setText("MÁXIMO").setColor(TEXT_ACCENT);
          btnT.setVisible(false);
        }
        // Highlight border at max level
        bg.setStrokeStyle(
          1,
          lvl >= def.maxLevel ? Phaser.Display.Color.HexStringToColor(def.color).color : 0x333344,
        );
      };
      updateCard();
      cardUpdaters.set(id, updateCard);

      // Click to buy
      bg.setInteractive({ useHandCursor: true });
      const tryBuy = () => {
        if (isLocked(levels, id)) {
          Sfx.parryWhiff();
          return;
        }
        const cost = nextCost(levels, id);
        if (cost === null || run.reconhecimento < cost) return;
        run.reconhecimento -= cost;
        levels[id] = (levels[id] ?? 0) + 1;
        saveUpgrades(levels);
        savePersisted(run.reconhecimento, run.fgts, run.loopCount);
        Sfx.perkSelect();
        refresh();
        // Update all cards (costs, affordability and exclusive locks may have changed)
        cardUpdaters.forEach((fn) => fn());
      };
      bg.on("pointerdown", tryBuy);
      bg.on("pointerover", () => bg.setFillStyle(0x22263a));
      bg.on("pointerout", () => bg.setFillStyle(CARD_BG));
      btnT
        .setInteractive({
          useHandCursor: true,
          hitArea: new Phaser.Geom.Rectangle(0, 0, CARD_W - 16, 14),
          hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        })
        .on("pointerdown", tryBuy);

      void iconT;
      void nameT;
      void descT;
    });

    // Back button
    const backY = startY + Math.ceil(UPGRADE_ORDER.length / COLS) * (CARD_H + PAD_Y) + 10;
    const backBtn = this.add
      .text(GAME_WIDTH / 2, Math.min(backY, GAME_HEIGHT - 30), "← VOLTAR  [ ESC ]", {
        fontSize: "13px",
        color: TEXT_DIM,
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
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
