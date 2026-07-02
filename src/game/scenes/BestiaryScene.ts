import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { ENEMIES, EnemyId } from "../systems/EnemyCatalog";
import { resolveSprite } from "../systems/SpriteLibrary";
import { hasKilled, getAllKilled, getKillCount } from "../systems/BestiarySystem";

const COLS = 3;
const CARD_W = 220;
const CARD_H = 110;
const PAD_X = 16;
const PAD_Y = 12;
const GRID_START_Y = 72;

const PHASE_COLORS: Record<number, number> = {
  1: 0x44aaff,
  2: 0xff8844,
  3: 0xaa44ff,
  4: 0xff4444,
  5: 0xff0055,
};

const ARCHETYPE_COLOR: Record<string, string> = {
  rusher: "#ff6644",
  ranged: "#44aaff",
  charger: "#ff8800",
  tank: "#cc4444",
  healer: "#44ff88",
  aerial: "#8844ff",
  splitter: "#ff44aa",
  support: "#aaaaff",
};

export class BestiaryScene extends Phaser.Scene {
  private scrollY = 0;
  private maxScroll = 0;
  private container!: Phaser.GameObjects.Container;

  constructor() {
    super("BestiaryScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#0e1018");

    const killed = getAllKilled();
    const total = Object.keys(ENEMIES).length;
    const found = killed.size;

    // Header
    this.add
      .text(GAME_WIDTH / 2, 16, "BESTIARIO CORPORATIVO", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#f2c14e",
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.add
      .text(GAME_WIDTH / 2, 36, `${found} / ${total} entidades identificadas`, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#666666",
      })
      .setOrigin(0.5)
      .setDepth(20);

    // Phase legend
    let lx = 16;
    for (const [phase, color] of Object.entries(PHASE_COLORS)) {
      const hex = `#${color.toString(16).padStart(6, "0")}`;
      this.add
        .text(lx, 52, `▪ FASE ${phase}`, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: hex,
        })
        .setDepth(20);
      lx += 72;
    }

    // Scroll container
    this.container = this.add.container(0, GRID_START_Y);

    const enemyIds = Object.keys(ENEMIES) as EnemyId[];
    const totalRows = Math.ceil(enemyIds.length / COLS);

    enemyIds.forEach((id, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const def = ENEMIES[id];
      const discovered = hasKilled(id);

      const x = PAD_X + col * (CARD_W + PAD_X);
      const y = row * (CARD_H + PAD_Y);

      const phaseColor = PHASE_COLORS[def.phase] ?? 0x888888;
      const borderAlpha = discovered ? 0.5 : 0.2;

      // Card bg
      const card = this.add.graphics();
      card.fillStyle(discovered ? 0x13151c : 0x0a0b0f, 1);
      card.fillRoundedRect(x, y, CARD_W, CARD_H, 4);
      card.lineStyle(1, phaseColor, borderAlpha);
      card.strokeRoundedRect(x, y, CARD_W, CARD_H, 4);
      this.container.add(card);

      // Phase badge
      const hex = `#${phaseColor.toString(16).padStart(6, "0")}`;
      this.container.add(
        this.add
          .text(x + CARD_W - 4, y + 4, `F${def.phase}`, {
            fontFamily: "monospace",
            fontSize: "8px",
            color: discovered ? hex : "#333344",
          })
          .setOrigin(1, 0),
      );

      // Sprite preview
      const [tex, frame] = resolveSprite(`tex-${def.spritePrefix ?? id.replace(/_/g, "-")}-idle0`);
      const sprite = this.add.image(x + 36, y + CARD_H / 2, tex, frame);
      sprite.setOrigin(0.5, 0.5);
      sprite.setScale(2);
      if (!discovered) {
        sprite.setTint(0x000000);
        sprite.setAlpha(0.4);
      }
      this.container.add(sprite);

      if (discovered) {
        const killCount = getKillCount(id);
        const loreUnlocked = killCount >= 10;

        // Name
        this.container.add(
          this.add.text(x + 70, y + 8, def.label.toUpperCase(), {
            fontFamily: "monospace",
            fontSize: "9px",
            color: "#eaeaea",
            wordWrap: { width: 140 },
          }),
        );

        // Archetype
        if (def.archetype) {
          this.container.add(
            this.add.text(x + 70, y + 22, def.archetype.toUpperCase(), {
              fontFamily: "monospace",
              fontSize: "7px",
              color: ARCHETYPE_COLOR[def.archetype] ?? "#888888",
            }),
          );
        }

        // Kill count
        this.container.add(
          this.add
            .text(x + CARD_W - 8, y + 22, `×${killCount}${loreUnlocked ? " ★" : ""}`, {
              fontFamily: "monospace",
              fontSize: "7px",
              color: loreUnlocked ? "#f2c14e" : "#445566",
            })
            .setOrigin(1, 0),
        );

        // Stats
        const stats = [
          `HP: ${def.hp}   SPD: ${def.speed}`,
          `DMG: ${def.contactDamage}   VR: ${def.vrReward}`,
        ];
        stats.forEach((line, li) => {
          this.container.add(
            this.add.text(x + 70, y + 34 + li * 14, line, {
              fontFamily: "monospace",
              fontSize: "8px",
              color: "#888888",
            }),
          );
        });

        // Description or lore (unlocked at 10 kills)
        if (loreUnlocked && def.lore) {
          this.container.add(
            this.add.text(x + 70, y + 66, `"${def.lore}"`, {
              fontFamily: "monospace",
              fontSize: "7px",
              color: "#c8b840",
              fontStyle: "italic",
              wordWrap: { width: 142 },
            }),
          );
        } else if (def.description) {
          this.container.add(
            this.add.text(x + 70, y + 66, def.description, {
              fontFamily: "monospace",
              fontSize: "7px",
              color: "#555566",
              wordWrap: { width: 142 },
            }),
          );
          if (killCount < 10) {
            this.container.add(
              this.add.text(x + 70, y + 88, `Lore: ${killCount}/10 abates`, {
                fontFamily: "monospace",
                fontSize: "6px",
                color: "#333344",
              }),
            );
          }
        }

        // First attack
        if (def.attacks && def.attacks.length > 0) {
          const atk = def.attacks[0];
          this.container.add(
            this.add.text(x + 4, y + CARD_H - 14, `⚔ ${atk.name} (${atk.damage}dmg)`, {
              fontFamily: "monospace",
              fontSize: "7px",
              color: "#cc4444",
            }),
          );
        }
      } else {
        // Undiscovered — silhouette with "???"
        this.container.add(
          this.add.text(x + 70, y + 8, "???", {
            fontFamily: "monospace",
            fontSize: "12px",
            fontStyle: "bold",
            color: "#222233",
          }),
        );
        this.container.add(
          this.add.text(x + 70, y + 28, `Fase ${def.phase} — não encontrado`, {
            fontFamily: "monospace",
            fontSize: "7px",
            color: "#1a1a22",
          }),
        );
        this.container.add(
          this.add.text(x + 4, y + CARD_H - 14, "Derrote para desbloquear", {
            fontFamily: "monospace",
            fontSize: "7px",
            color: "#1a1a22",
          }),
        );
      }
    });

    this.maxScroll = Math.max(0, totalRows * (CARD_H + PAD_Y) - (GAME_HEIGHT - GRID_START_Y - 20));

    // Scroll indicator
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 10, "↑↓ ou mouse para rolar  ·  ESC para voltar", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#333344",
      })
      .setOrigin(0.5)
      .setDepth(20);

    // Input
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("MenuScene"));
    this.input.keyboard?.on("keydown-UP", () => this.doScroll(-80));
    this.input.keyboard?.on("keydown-DOWN", () => this.doScroll(80));
    this.input.on("wheel", (_p: unknown, _gos: unknown, _dx: number, dy: number) => {
      this.doScroll(dy * 0.8);
    });

    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private doScroll(delta: number) {
    this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScroll);
    this.container.setY(GRID_START_Y - this.scrollY);
  }
}
