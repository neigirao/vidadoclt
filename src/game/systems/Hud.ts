import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../constants";
import { ATLAS_KEY } from "./SpriteLibrary";

const F = "monospace";
export const HUD_TOP_H = 56;
export const HUD_BOT_H = 68;
export const HUD_BOT_Y = GAME_HEIGHT - HUD_BOT_H;

// ─── Bottom bar section widths ───────────────────────────────────
const SEC1_W = 220; // Character
const SEC2_W = 220; // UT / HUD Items
const SEC3_W = 240; // Perks Ativos
const SEC4_W = 280; // Mapa da Fase
// total = 960

// ─── Section 1 layout ────────────────────────────────────────────
const PORTRAIT_W = 44;
const PORTRAIT_H = 52;
const PORTRAIT_X = 6;
const PORTRAIT_Y = 8;
const STAT_X = PORTRAIT_X + PORTRAIT_W + 6; // 56
const BAR_W = 148;
const BAR_H = 8;
const BAR_ENERGY_Y = 14;
const BAR_SANITY_Y = 30;

// ─── Section 2 layout ────────────────────────────────────────────
const S2_X = SEC1_W;
const ITEM_SLOT_SIZE = 44;
const ITEM_SLOT_GAP = 4;
const ITEM_SLOT_Y = 16;

// ─── Section 3 layout ────────────────────────────────────────────
const S3_X = SEC1_W + SEC2_W;
const PERK_SLOT_SIZE = 32;
const PERK_SLOT_GAP = 4;
const PERK_SLOT_Y = 20;
const PERK_COUNT = 5;

// ─── Section 4 layout ────────────────────────────────────────────
const S4_X = SEC1_W + SEC2_W + SEC3_W;
const MAP_COLS = 5;
const MAP_ROWS = 2;
const MAP_CELL_W = 20;
const MAP_CELL_H = 16;
const MAP_CELL_GAP = 4;
const MAP_X0 = S4_X + 12; // relative to botContainer
const MAP_Y0 = 16;

// ─── Top bar right (boss) ─────────────────────────────────────────
const LEFT_W = 290;
const RIGHT_X = 670;
const RIGHT_W = GAME_WIDTH - RIGHT_X;

export class Hud {
  private scene: Phaser.Scene;

  // top-left
  private topLeft!: Phaser.GameObjects.Container;
  private energyBarG!: Phaser.GameObjects.Graphics;
  private sanityBarG!: Phaser.GameObjects.Graphics;
  private energyNumT!: Phaser.GameObjects.Text;
  private sanityNumT!: Phaser.GameObjects.Text;
  private vrTopT!: Phaser.GameObjects.Text;
  private recoT!: Phaser.GameObjects.Text;

  // top-center
  private clockT!: Phaser.GameObjects.Text;
  private objectiveT!: Phaser.GameObjects.Text;
  private phaseTitleT!: Phaser.GameObjects.Text;

  // top-right boss
  private bossContainer!: Phaser.GameObjects.Container;
  private bossBarG!: Phaser.GameObjects.Graphics;
  private bossNameT!: Phaser.GameObjects.Text;
  private bossHpT!: Phaser.GameObjects.Text;
  private bossMaxHp = 300;

  // bottom bar container (4 sections)
  private botContainer!: Phaser.GameObjects.Container;

  // Section 1 graphics
  private sec1EnergyG!: Phaser.GameObjects.Graphics;
  private sec1SanityG!: Phaser.GameObjects.Graphics;
  private sec1EnergyNumT!: Phaser.GameObjects.Text;
  private sec1SanityNumT!: Phaser.GameObjects.Text;
  private sec1VrT!: Phaser.GameObjects.Text;
  private sec1RecoT!: Phaser.GameObjects.Text;

  // Section 2 graphics
  private weaponNameT!: Phaser.GameObjects.Text;
  private specialNameT!: Phaser.GameObjects.Text;
  private dashCooldownG!: Phaser.GameObjects.Graphics;

  // Section 3 perks
  private perkSlotGraphics!: Phaser.GameObjects.Graphics;
  private perkTexts: Phaser.GameObjects.Text[] = [];
  private activePerks: string[] = [];

  // Section 4 minimap
  private minimapG!: Phaser.GameObjects.Graphics;
  private currentRoomCol = 0;
  private currentRoomRow = 0;

  // Interact hint (above bottom bar)
  private interactHintT!: Phaser.GameObjects.Text;

  private levelWidth: number;

  constructor(scene: Phaser.Scene, levelWidth = 1920) {
    this.scene = scene;
    this.levelWidth = levelWidth;

    this.buildTopLeft();
    this.buildTopCenter();
    this.buildBossBar();
    this.buildBottomBar();
  }

  // ─── build top-left ─────────────────────────────────────────────

  private buildTopLeft() {
    this.topLeft = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.75);
    bg.fillRect(0, 0, LEFT_W, HUD_TOP_H);
    bg.lineStyle(1, 0x333333, 1);
    bg.lineBetween(LEFT_W, 0, LEFT_W, HUD_TOP_H);
    bg.lineBetween(0, HUD_TOP_H, GAME_WIDTH, HUD_TOP_H);
    this.topLeft.add(bg);

    // Portrait — player sprite
    const portraitBg = this.scene.add.graphics();
    portraitBg.fillStyle(0x1a1d23, 1);
    portraitBg.fillRect(4, 4, 46, 48);
    portraitBg.lineStyle(1, 0x445566, 1);
    portraitBg.strokeRect(4, 4, 46, 48);
    this.topLeft.add(portraitBg);

    const portrait = this.scene.add.image(27, 28, ATLAS_KEY, "player-idle0")
      .setDisplaySize(40, 44);
    this.topLeft.add(portrait);

    // ENERGIA label + bar
    this.topLeft.add(
      this.scene.add.text(56, 3, "❤ ENERGIA", { fontFamily: F, fontSize: "8px", color: "#ffa0a0" })
    );
    this.energyBarG = this.scene.add.graphics();
    this.topLeft.add(this.energyBarG);
    this.energyNumT = this.scene.add.text(56 + BAR_W + 4, 3, "100/100", {
      fontFamily: F, fontSize: "8px", color: "#ffd0d0",
    });
    this.topLeft.add(this.energyNumT);

    // SANIDADE label + bar
    this.topLeft.add(
      this.scene.add.text(56, 23, "🧠 SANIDADE", { fontFamily: F, fontSize: "8px", color: "#a0c0ff" })
    );
    this.sanityBarG = this.scene.add.graphics();
    this.topLeft.add(this.sanityBarG);
    this.sanityNumT = this.scene.add.text(56 + BAR_W + 4, 23, "100/100", {
      fontFamily: F, fontSize: "8px", color: "#cfe2ff",
    });
    this.topLeft.add(this.sanityNumT);

    // VR and Reconhecimento
    this.vrTopT = this.scene.add.text(56, 43, "VR: R$ 0,00", {
      fontFamily: F, fontSize: "9px", color: "#f2c14e",
    });
    this.topLeft.add(this.vrTopT);

    this.recoT = this.scene.add.text(180, 43, "R: 0", {
      fontFamily: F, fontSize: "9px", color: "#aaaaaa",
    });
    this.topLeft.add(this.recoT);
  }

  // ─── build top-center ───────────────────────────────────────────

  private buildTopCenter() {
    const ctr = this.scene.add.container(LEFT_W, 0).setScrollFactor(0).setDepth(1000);

    const W = RIGHT_X - LEFT_W;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.5);
    bg.fillRect(0, 0, W, HUD_TOP_H);
    ctr.add(bg);

    this.phaseTitleT = this.scene.add.text(W / 2, 5, "FASE 1 — OPEN SPACE", {
      fontFamily: F, fontSize: "12px", fontStyle: "bold", color: "#eaeaea",
    }).setOrigin(0.5, 0);
    ctr.add(this.phaseTitleT);

    this.objectiveT = this.scene.add.text(W / 2, 21, "OBJETIVO: Chegue ao elevador e desça", {
      fontFamily: F, fontSize: "9px", color: "#888888",
    }).setOrigin(0.5, 0);
    ctr.add(this.objectiveT);

    this.clockT = this.scene.add.text(W / 2, 36, "18:00", {
      fontFamily: F, fontSize: "13px", color: "#eaeaea",
    }).setOrigin(0.5, 0);
    ctr.add(this.clockT);
  }

  // ─── build boss bar ─────────────────────────────────────────────

  private buildBossBar() {
    this.bossContainer = this.scene.add
      .container(RIGHT_X, 0)
      .setScrollFactor(0)
      .setDepth(1001)
      .setVisible(false);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(0, 0, RIGHT_W, HUD_TOP_H);
    bg.lineStyle(1, 0x661111, 1);
    bg.strokeRect(0, 0, RIGHT_W, HUD_TOP_H);
    this.bossContainer.add(bg);

    this.bossContainer.add(
      this.scene.add.text(RIGHT_W / 2, 4, "CHEFE DA FASE", {
        fontFamily: F, fontSize: "9px", color: "#cc4444",
      }).setOrigin(0.5, 0)
    );

    this.bossNameT = this.scene.add.text(RIGHT_W / 2, 15, "", {
      fontFamily: F, fontSize: "12px", fontStyle: "bold", color: "#ff6666",
    }).setOrigin(0.5, 0);
    this.bossContainer.add(this.bossNameT);

    this.bossBarG = this.scene.add.graphics();
    this.bossContainer.add(this.bossBarG);

    this.bossHpT = this.scene.add.text(RIGHT_W / 2, 44, "", {
      fontFamily: F, fontSize: "9px", color: "#ff9999",
    }).setOrigin(0.5, 0);
    this.bossContainer.add(this.bossHpT);
  }

  // ─── build bottom bar (4 sections) ─────────────────────────────

  private buildBottomBar() {
    this.botContainer = this.scene.add.container(0, HUD_BOT_Y).setScrollFactor(0).setDepth(1000);

    // Full-width dark background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0c10, 0.92);
    bg.fillRect(0, 0, GAME_WIDTH, HUD_BOT_H);
    bg.lineStyle(1, 0x2a2e38, 1);
    bg.lineBetween(0, 0, GAME_WIDTH, 0);
    this.botContainer.add(bg);

    // Section dividers
    const divG = this.scene.add.graphics();
    divG.lineStyle(1, 0x2a3040, 1);
    [SEC1_W, SEC1_W + SEC2_W, SEC1_W + SEC2_W + SEC3_W].forEach(x => {
      divG.lineBetween(x, 2, x, HUD_BOT_H - 2);
    });
    this.botContainer.add(divG);

    this.buildSec1();
    this.buildSec2();
    this.buildSec3();
    this.buildSec4();

    // Interact hint (floating above bottom bar)
    this.interactHintT = this.scene.add.text(GAME_WIDTH / 2, HUD_BOT_Y - 14, "", {
      fontFamily: F, fontSize: "10px", color: "#f2c14e",
      backgroundColor: "#000000cc", padding: { x: 8, y: 3 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(1001).setVisible(false);
  }

  // ─── Section 1: Character portrait + stats ──────────────────────

  private buildSec1() {
    // Dark panel background
    const panBg = this.scene.add.graphics();
    panBg.fillStyle(0x101418, 1);
    panBg.fillRect(2, 2, SEC1_W - 4, HUD_BOT_H - 4);
    this.botContainer.add(panBg);

    // Character portrait — player sprite
    const portBg = this.scene.add.graphics();
    portBg.fillStyle(0x1a1d23, 1);
    portBg.fillRect(PORTRAIT_X, PORTRAIT_Y, PORTRAIT_W, PORTRAIT_H);
    portBg.lineStyle(1, 0x445566, 1);
    portBg.strokeRect(PORTRAIT_X, PORTRAIT_Y, PORTRAIT_W, PORTRAIT_H);
    this.botContainer.add(portBg);

    const port = this.scene.add.image(
      PORTRAIT_X + PORTRAIT_W / 2,
      PORTRAIT_Y + PORTRAIT_H / 2,
      ATLAS_KEY,
      "player-idle0",
    ).setDisplaySize(PORTRAIT_W - 4, PORTRAIT_H - 4);
    this.botContainer.add(port);

    // Stat labels and bars
    const statX = STAT_X;

    // ENERGIA label
    this.botContainer.add(
      this.scene.add.text(statX, 7, "ENERGIA", { fontFamily: F, fontSize: "7px", color: "#ff9090" })
    );
    // ENERGIA bar graphics
    this.sec1EnergyG = this.scene.add.graphics();
    this.botContainer.add(this.sec1EnergyG);
    // ENERGIA number
    this.sec1EnergyNumT = this.scene.add.text(statX + BAR_W + 3, 7, "100/100", {
      fontFamily: F, fontSize: "7px", color: "#ffd0d0",
    });
    this.botContainer.add(this.sec1EnergyNumT);

    // SANIDADE label
    this.botContainer.add(
      this.scene.add.text(statX, 24, "SANIDADE", { fontFamily: F, fontSize: "7px", color: "#80a0ff" })
    );
    // SANIDADE bar graphics
    this.sec1SanityG = this.scene.add.graphics();
    this.botContainer.add(this.sec1SanityG);
    // SANIDADE number
    this.sec1SanityNumT = this.scene.add.text(statX + BAR_W + 3, 24, "100/100", {
      fontFamily: F, fontSize: "7px", color: "#cfe2ff",
    });
    this.botContainer.add(this.sec1SanityNumT);

    // VR gold text
    this.sec1VrT = this.scene.add.text(statX, 42, "VR  R$ 0,00", {
      fontFamily: F, fontSize: "9px", fontStyle: "bold", color: "#f2c14e",
    });
    this.botContainer.add(this.sec1VrT);

    // Reconhecimento
    this.sec1RecoT = this.scene.add.text(statX, 55, "RECO: 0", {
      fontFamily: F, fontSize: "7px", color: "#c8b840",
    });
    this.botContainer.add(this.sec1RecoT);
  }

  // ─── Section 2: UT / HUD Items ──────────────────────────────────

  private buildSec2() {
    // Header
    this.botContainer.add(
      this.scene.add.text(S2_X + SEC2_W / 2, 3, "UT / HUD", {
        fontFamily: F, fontSize: "7px", color: "#666677",
      }).setOrigin(0.5, 0)
    );

    const slotDefs = [
      { label: "1", hint: "ATQ", color: 0x3a2a4a, border: 0xf2c14e, active: true },
      { label: "2", hint: "ESP", color: 0x1a2a3a, border: 0x4a7a8a, active: false },
      { label: "3", hint: "",    color: 0x151820, border: 0x2a2e38, active: false },
      { label: "4", hint: "",    color: 0x151820, border: 0x2a2e38, active: false },
    ];

    const totalW = slotDefs.length * ITEM_SLOT_SIZE + (slotDefs.length - 1) * ITEM_SLOT_GAP;
    const startX = S2_X + (SEC2_W - totalW - 40) / 2;

    slotDefs.forEach((sd, i) => {
      const sx = startX + i * (ITEM_SLOT_SIZE + ITEM_SLOT_GAP);
      const sy = ITEM_SLOT_Y;

      const slotG = this.scene.add.graphics();
      slotG.fillStyle(sd.color, 1);
      slotG.fillRect(sx, sy, ITEM_SLOT_SIZE, ITEM_SLOT_SIZE);
      slotG.lineStyle(sd.active ? 2 : 1, sd.border, 1);
      slotG.strokeRect(sx, sy, ITEM_SLOT_SIZE, ITEM_SLOT_SIZE);

      // Icon hint if present
      if (sd.hint) {
        const iconG = this.scene.add.graphics();
        if (i === 0) {
          // Weapon icon — stapler hint
          iconG.fillStyle(0x888899, 1);
          iconG.fillRect(sx + 10, sy + 16, 24, 9);
          iconG.fillRect(sx + 17, sy + 8, 10, 9);
        } else if (i === 1) {
          // Coffee cup hint
          iconG.fillStyle(0x8b4a1a, 1);
          iconG.fillEllipse(sx + ITEM_SLOT_SIZE / 2, sy + ITEM_SLOT_SIZE / 2, 16, 20);
          iconG.fillStyle(0xf2c14e, 1);
          iconG.fillRect(sx + ITEM_SLOT_SIZE / 2 - 8, sy + 8, 16, 4);
        }
        this.botContainer.add(iconG);
      }

      this.botContainer.add(slotG);

      // Slot number badge
      this.botContainer.add(
        this.scene.add.text(sx + 3, sy + ITEM_SLOT_SIZE - 10, sd.label, {
          fontFamily: F, fontSize: "7px", color: sd.active ? "#f2c14e" : "#555566",
        })
      );
    });

    // "Q" slot on the right
    const qx = startX + slotDefs.length * (ITEM_SLOT_SIZE + ITEM_SLOT_GAP) + 6;
    const qG = this.scene.add.graphics();
    qG.fillStyle(0x1a1820, 1);
    qG.fillRect(qx, ITEM_SLOT_Y + 4, 36, 36);
    qG.lineStyle(1, 0x3a3a4a, 1);
    qG.strokeRect(qx, ITEM_SLOT_Y + 4, 36, 36);
    this.botContainer.add(qG);
    this.botContainer.add(
      this.scene.add.text(qx + 18, ITEM_SLOT_Y + 22, "Q", {
        fontFamily: F, fontSize: "12px", fontStyle: "bold", color: "#444455",
      }).setOrigin(0.5)
    );

    // Weapon name below
    this.weaponNameT = this.scene.add.text(S2_X + 6, ITEM_SLOT_Y + ITEM_SLOT_SIZE + 4, "GRAMPEADOR", {
      fontFamily: F, fontSize: "7px", color: "#ccccdd",
    });
    this.botContainer.add(this.weaponNameT);

    this.specialNameT = this.scene.add.text(S2_X + 6, ITEM_SLOT_Y + ITEM_SLOT_SIZE + 14, "CAFÉ TURBO", {
      fontFamily: F, fontSize: "7px", color: "#f2c14e",
    });
    this.botContainer.add(this.specialNameT);

    // Dash cooldown overlay graphics (draw over slot index 2, i.e. 3rd slot — SHIFT/DASH)
    this.dashCooldownG = this.scene.add.graphics();
    this.botContainer.add(this.dashCooldownG);
  }

  // ─── Section 3: Perks Ativos ────────────────────────────────────

  private buildSec3() {
    // Header
    this.botContainer.add(
      this.scene.add.text(S3_X + SEC3_W / 2, 3, "PERKS ATIVOS", {
        fontFamily: F, fontSize: "7px", color: "#666677",
      }).setOrigin(0.5, 0)
    );

    this.perkSlotGraphics = this.scene.add.graphics();
    this.botContainer.add(this.perkSlotGraphics);
    this.perkTexts = [];

    this.drawPerkSlots();
  }

  private drawPerkSlots() {
    this.perkSlotGraphics.clear();
    this.perkTexts.forEach(t => t.destroy());
    this.perkTexts = [];

    const totalW = PERK_COUNT * PERK_SLOT_SIZE + (PERK_COUNT - 1) * PERK_SLOT_GAP;
    const startX = S3_X + (SEC3_W - totalW) / 2;

    for (let i = 0; i < PERK_COUNT; i++) {
      const px = startX + i * (PERK_SLOT_SIZE + PERK_SLOT_GAP);
      const py = PERK_SLOT_Y;
      const perk = this.activePerks[i];

      if (perk) {
        // Active perk — colored slot
        const hue = (i * 60) % 360;
        const col = Phaser.Display.Color.HSLToColor(hue / 360, 0.6, 0.35).color;
        this.perkSlotGraphics.fillStyle(col, 1);
        this.perkSlotGraphics.fillRect(px, py, PERK_SLOT_SIZE, PERK_SLOT_SIZE);
        this.perkSlotGraphics.lineStyle(1, 0x8888aa, 1);
        this.perkSlotGraphics.strokeRect(px, py, PERK_SLOT_SIZE, PERK_SLOT_SIZE);
        // Abbreviated perk name
        const abbrev = perk.substring(0, 3).toUpperCase();
        const t = this.scene.add.text(px + PERK_SLOT_SIZE / 2, py + PERK_SLOT_SIZE / 2, abbrev, {
          fontFamily: F, fontSize: "7px", fontStyle: "bold", color: "#ffffff",
        }).setOrigin(0.5);
        this.perkSlotGraphics.scene.children.bringToTop(t);
        (this.botContainer as any).add(t);
        this.perkTexts.push(t);
      } else {
        // Empty slot — dotted border
        this.perkSlotGraphics.fillStyle(0x111318, 1);
        this.perkSlotGraphics.fillRect(px, py, PERK_SLOT_SIZE, PERK_SLOT_SIZE);
        // Dashed border (draw as individual segments)
        this.perkSlotGraphics.lineStyle(1, 0x2a2e3a, 1);
        this.perkSlotGraphics.strokeRect(px, py, PERK_SLOT_SIZE, PERK_SLOT_SIZE);
        // Plus hint
        this.perkSlotGraphics.fillStyle(0x222630, 1);
        this.perkSlotGraphics.fillRect(px + PERK_SLOT_SIZE / 2 - 1, py + 6, 2, PERK_SLOT_SIZE - 12);
        this.perkSlotGraphics.fillRect(px + 6, py + PERK_SLOT_SIZE / 2 - 1, PERK_SLOT_SIZE - 12, 2);
      }
    }
  }

  // ─── Section 4: Mapa da Fase ────────────────────────────────────

  private buildSec4() {
    // Header
    this.botContainer.add(
      this.scene.add.text(S4_X + SEC4_W / 2, 3, "MAPA DA FASE", {
        fontFamily: F, fontSize: "7px", color: "#666677",
      }).setOrigin(0.5, 0)
    );

    // Background for entire minimap area
    const mapBg = this.scene.add.graphics();
    mapBg.fillStyle(0x0c0e14, 1);
    const mapAreaW = MAP_COLS * MAP_CELL_W + (MAP_COLS - 1) * MAP_CELL_GAP;
    const mapAreaH = MAP_ROWS * MAP_CELL_H + (MAP_ROWS - 1) * MAP_CELL_GAP;
    mapBg.fillRect(MAP_X0 - 2, MAP_Y0 - 2, mapAreaW + 4, mapAreaH + 4);
    mapBg.lineStyle(1, 0x334455, 1);
    mapBg.strokeRect(MAP_X0 - 2, MAP_Y0 - 2, mapAreaW + 4, mapAreaH + 4);
    this.botContainer.add(mapBg);

    this.minimapG = this.scene.add.graphics();
    this.botContainer.add(this.minimapG);

    this.drawMinimap(0, 0);
  }

  private drawMinimap(playerX: number, _playerY = 0) {
    this.minimapG.clear();

    // Map player column based on world position (5 columns = 5 zones)
    const col = Math.min(MAP_COLS - 1, Math.floor((playerX / this.levelWidth) * MAP_COLS));
    this.currentRoomCol = col;

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const rx = MAP_X0 + c * (MAP_CELL_W + MAP_CELL_GAP);
        const ry = MAP_Y0 + row * (MAP_CELL_H + MAP_CELL_GAP);
        const isCurrent = c === col && row === 0;
        const isVisited = c < col;

        if (isCurrent) {
          // Current room — orange
          this.minimapG.fillStyle(0xf0a020, 1);
          this.minimapG.fillRect(rx, ry, MAP_CELL_W, MAP_CELL_H);
          this.minimapG.lineStyle(1, 0xffcc44, 1);
          this.minimapG.strokeRect(rx, ry, MAP_CELL_W, MAP_CELL_H);
        } else if (isVisited) {
          // Visited — grey
          this.minimapG.fillStyle(0x444455, 1);
          this.minimapG.fillRect(rx, ry, MAP_CELL_W, MAP_CELL_H);
          this.minimapG.lineStyle(1, 0x555566, 1);
          this.minimapG.strokeRect(rx, ry, MAP_CELL_W, MAP_CELL_H);
        } else {
          // Unvisited — dark
          this.minimapG.fillStyle(0x222233, 1);
          this.minimapG.fillRect(rx, ry, MAP_CELL_W, MAP_CELL_H);
          this.minimapG.lineStyle(1, 0x333344, 1);
          this.minimapG.strokeRect(rx, ry, MAP_CELL_W, MAP_CELL_H);
          // "?" mark
          this.minimapG.fillStyle(0x444455, 1);
          this.minimapG.fillRect(rx + MAP_CELL_W / 2 - 1, ry + 3, 2, MAP_CELL_H - 6);
        }
      }
    }

    // Row 2 — all unvisited/hidden (boss rooms, etc.)
    // Already drawn above in loop

    // Player position dot (small orange rect in current room center)
    const dotX = MAP_X0 + col * (MAP_CELL_W + MAP_CELL_GAP) + MAP_CELL_W / 2;
    const dotY = MAP_Y0 + MAP_CELL_H / 2;
    this.minimapG.fillStyle(0xffee44, 1);
    this.minimapG.fillRect(dotX - 2, dotY - 2, 4, 4);
  }

  // ─── public update API ──────────────────────────────────────────

  update(opts: {
    energy: number; maxEnergy: number;
    sanity: number; maxSanity: number;
    vr: number; reconhecimento: number;
    time: number; startTime: number;
    playerX: number;
    interactHint?: string;
    dashCooldown?: number;
    perks?: string[];
  }) {
    // Sanity color: green→orange at 50%, orange→pulsing red at 25%
    const sanityPct = opts.sanity / opts.maxSanity;
    const sanityColor = sanityPct > 0.5
      ? COLORS.sanityBar
      : sanityPct > 0.25
        ? 0xffaa44
        : (Math.floor(opts.time / 350) % 2 === 0 ? 0xff3322 : 0xff8844);

    // Top-left bars
    this.drawBar(this.energyBarG, 56, BAR_ENERGY_Y, opts.energy, opts.maxEnergy, COLORS.energyBar);
    this.drawBar(this.sanityBarG, 56, BAR_SANITY_Y, opts.sanity, opts.maxSanity, sanityColor);
    const sanityHex = sanityPct > 0.5 ? "#cfe2ff" : sanityPct > 0.25 ? "#ffcc88" : "#ff9977";
    this.energyNumT.setText(`${opts.energy}/${opts.maxEnergy}`);
    this.sanityNumT.setText(`${opts.sanity}/${opts.maxSanity}`).setColor(sanityHex);
    this.vrTopT.setText(`VR ${this.fmtVR(opts.vr)}`);
    this.recoT.setText(`R: ${opts.reconhecimento.toLocaleString("pt-BR")}`);

    // Bottom-left bars (section 1)
    this.drawBar(this.sec1EnergyG, STAT_X, BAR_ENERGY_Y, opts.energy, opts.maxEnergy, COLORS.energyBar);
    this.drawBar(this.sec1SanityG, STAT_X, BAR_SANITY_Y, opts.sanity, opts.maxSanity, sanityColor);
    this.sec1EnergyNumT.setText(`${opts.energy}/${opts.maxEnergy}`);
    this.sec1SanityNumT.setText(`${opts.sanity}/${opts.maxSanity}`).setColor(sanityHex);
    this.sec1VrT.setText(`VR  ${this.fmtVR(opts.vr)}`);
    this.sec1RecoT.setText(`RECO: ${opts.reconhecimento.toLocaleString("pt-BR")}`);

    // Clock
    const minutes = Math.floor((opts.time - opts.startTime) / 1000);
    const hh = 18 + Math.floor(minutes / 60);
    const mm = minutes % 60;
    this.clockT.setText(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);

    // Minimap
    this.drawMinimap(opts.playerX);

    // Dash cooldown overlay
    this.dashCooldownG.clear();
    const dashRatio = opts.dashCooldown ?? 0;
    if (dashRatio > 0) {
      // Overlay on the 3rd slot (index 2) in section 2
      const totalW = 4 * ITEM_SLOT_SIZE + 3 * ITEM_SLOT_GAP;
      const startX = S2_X + (SEC2_W - totalW - 40) / 2;
      const dsx = startX + 2 * (ITEM_SLOT_SIZE + ITEM_SLOT_GAP);
      this.dashCooldownG.fillStyle(0x000000, 0.72);
      this.dashCooldownG.fillRect(dsx, ITEM_SLOT_Y, ITEM_SLOT_SIZE, Math.round(dashRatio * ITEM_SLOT_SIZE));
      this.dashCooldownG.lineStyle(1, 0x6688cc, 0.9);
      this.dashCooldownG.strokeRect(dsx, ITEM_SLOT_Y, ITEM_SLOT_SIZE, ITEM_SLOT_SIZE);
    }

    // Perks
    if (opts.perks && opts.perks.length !== this.activePerks.length) {
      this.setPerks(opts.perks);
    }

    // Interact hint
    if (opts.interactHint) {
      this.interactHintT.setText(opts.interactHint).setVisible(true);
    } else {
      this.interactHintT.setVisible(false);
    }
  }

  // ─── public methods ─────────────────────────────────────────────

  showBoss(name: string, maxHp: number) {
    this.bossMaxHp = maxHp;
    this.bossNameT.setText(name);
    this.bossContainer.setVisible(true);
    this.updateBoss(maxHp);
  }

  updateBoss(hp: number) {
    const pct = Math.max(0, hp / this.bossMaxHp);
    const bw = RIGHT_W - 16;
    this.bossBarG.clear();
    this.bossBarG.fillStyle(0x330000, 1);
    this.bossBarG.fillRect(8, 31, bw, 11);
    this.bossBarG.fillStyle(pct > 0.5 ? 0xdd3322 : pct > 0.25 ? 0xee8800 : 0xff2222, 1);
    this.bossBarG.fillRect(8, 31, Math.max(0, pct * bw), 11);
    this.bossBarG.lineStyle(1, 0x660000, 1);
    this.bossBarG.strokeRect(8, 31, bw, 11);
    this.bossHpT.setText(`${hp} / ${this.bossMaxHp}`);
  }

  hideBoss() {
    this.bossContainer.setVisible(false);
  }

  setWeapon(name: string) {
    this.weaponNameT.setText(name.toUpperCase());
  }

  setSpecial(name: string) {
    this.specialNameT.setText(name.toUpperCase());
  }

  setObjective(text: string) {
    this.objectiveT.setText(`OBJETIVO: ${text}`);
  }

  setPhaseTitle(text: string) {
    this.phaseTitleT.setText(text);
  }

  setInteractHint(text: string | null) {
    if (text) {
      this.interactHintT.setText(text).setVisible(true);
    } else {
      this.interactHintT.setVisible(false);
    }
  }

  setPerks(names: string[]): void {
    this.activePerks = names.slice(0, PERK_COUNT);
    this.drawPerkSlots();
  }

  addMinimapDot(worldX: number, _worldY: number, color: number) {
    // Draw dot in the current minimap based on world position
    const col = Math.min(MAP_COLS - 1, Math.floor((worldX / this.levelWidth) * MAP_COLS));
    const rx = MAP_X0 + col * (MAP_CELL_W + MAP_CELL_GAP) + MAP_CELL_W / 2;
    const ry = MAP_Y0 + MAP_CELL_H / 2;
    this.minimapG.fillStyle(color, 1);
    this.minimapG.fillRect(rx - 1, ry - 1, 3, 3);
  }

  // ─── private helpers ────────────────────────────────────────────

  private drawBar(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number,
    value: number, max: number,
    color: number,
  ) {
    g.clear();
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(x, y, BAR_W, BAR_H);
    const fill = Math.max(0, (value / max) * BAR_W);
    g.fillStyle(color, 1);
    g.fillRect(x, y, fill, BAR_H);
    // shine
    g.fillStyle(0xffffff, 0.12);
    g.fillRect(x, y, fill, Math.floor(BAR_H / 2));
    g.lineStyle(1, 0x000000, 0.7);
    g.strokeRect(x, y, BAR_W, BAR_H);
  }

  private fmtVR(vr: number): string {
    return `R$ ${vr.toFixed(2).replace(".", ",")}`;
  }

  destroy() {
    this.topLeft.destroy();
    this.bossContainer.destroy();
    this.botContainer.destroy();
    this.interactHintT.destroy();
  }
}
