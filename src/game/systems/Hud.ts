import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../constants";

const F = "monospace";
export const HUD_TOP_H = 56;
export const HUD_BOT_H = 48;
export const HUD_BOT_Y = GAME_HEIGHT - HUD_BOT_H;

// ─── layout constants ───────────────────────────────────────────
const LEFT_W = 290;       // portrait + bars panel
const RIGHT_X = 670;      // boss bar x
const RIGHT_W = GAME_WIDTH - RIGHT_X;

const BAR_X = 56;         // energy/sanity bar start x (relative to container)
const BAR_W = 174;        // bar width
const BAR_H = 9;
const BAR_ENERGY_Y = 13;  // energy bar y
const BAR_SANITY_Y = 33;  // sanity bar y

// bottom sections
const BOT_WEAPON_W  = 170;
const BOT_SPECIAL_W = 150;
const BOT_SKILLS_W  = 200;
const BOT_VR_W      = 160;
// remaining = minimap

// skill slots (bottom bar)
const SLOT_Y = 12;
const SLOT_W = 40;
const SLOT_H = 32;
const SLOT_GAP = 62;      // x distance between slot lefts
const SLOT_X0 = 10;       // first slot x inside skills section
const DASH_SLOT_INDEX = 2; // SHIFT / DASH is the third slot

export class Hud {
  private scene: Phaser.Scene;

  // top-left
  private topLeft!: Phaser.GameObjects.Container;
  private energyBarG!: Phaser.GameObjects.Graphics;
  private sanityBarG!: Phaser.GameObjects.Graphics;
  private energyNumT!: Phaser.GameObjects.Text;
  private sanityNumT!: Phaser.GameObjects.Text;
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

  // bottom
  private botContainer!: Phaser.GameObjects.Container;
  private weaponNameT!: Phaser.GameObjects.Text;
  private specialNameT!: Phaser.GameObjects.Text;
  private vrBotT!: Phaser.GameObjects.Text;
  private minimapG!: Phaser.GameObjects.Graphics;
  private dashCooldownG!: Phaser.GameObjects.Graphics;
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

  // ─── build ──────────────────────────────────────────────────────

  private buildTopLeft() {
    this.topLeft = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    // panel background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.75);
    bg.fillRect(0, 0, LEFT_W, HUD_TOP_H);
    bg.lineStyle(1, 0x333333, 1);
    bg.lineBetween(LEFT_W, 0, LEFT_W, HUD_TOP_H);
    bg.lineBetween(0, HUD_TOP_H, GAME_WIDTH, HUD_TOP_H);
    this.topLeft.add(bg);

    // portrait panel (drawn at original 48×58 scale, shrunk to fit 56px band)
    const portrait = this.scene.add.graphics();
    portrait.fillStyle(0x1a1d23, 1);
    portrait.fillRect(6, 5, 48, 58);
    portrait.lineStyle(1, 0x445566, 1);
    portrait.strokeRect(6, 5, 48, 58);
    // character (CLT) — head, glasses, shirt, tie, pants
    // hair
    portrait.fillStyle(0x1a0c06, 1);
    portrait.fillRect(18, 9,  18, 4);
    portrait.fillRect(16, 11, 22, 5);
    // face / skin
    portrait.fillStyle(0xd4a07a, 1);
    portrait.fillRect(15, 14, 22, 16);
    // hair fringe
    portrait.fillStyle(0x1a0c06, 1);
    portrait.fillRect(18, 14, 18, 3);
    // glasses
    portrait.fillStyle(0x111111, 1);
    portrait.fillRect(15, 18,  8, 5);
    portrait.fillRect(27, 18,  8, 5);
    portrait.fillRect(23, 19,  4, 1); // bridge
    // lens tint
    portrait.fillStyle(0xaabbcc, 0.35);
    portrait.fillRect(16, 19,  6, 3);
    portrait.fillRect(28, 19,  6, 3);
    // mouth
    portrait.fillStyle(0x8a6040, 1);
    portrait.fillRect(20, 27,  8, 2);
    // neck
    portrait.fillStyle(0xd4a07a, 1);
    portrait.fillRect(22, 30,  6, 4);
    // shirt
    portrait.fillStyle(0xe8e8e0, 1);
    portrait.fillRect(13, 33, 28, 18);
    // collar
    portrait.fillRect(14, 33,  7,  6);
    portrait.fillRect(33, 33,  7,  6);
    // tie
    portrait.fillStyle(0x1a2a5a, 1);
    portrait.fillRect(21, 33,  8, 18);
    portrait.fillRect(20, 40, 10,  8);
    // belt
    portrait.fillStyle(0x2a1a08, 1);
    portrait.fillRect(13, 50, 28,  3);
    // pants (cropped at bottom of portrait)
    portrait.fillStyle(0x1a2030, 1);
    portrait.fillRect(14, 53, 12,  8);
    portrait.fillRect(28, 53, 12,  8);
    portrait.setScale(0.8); // 48×58 drawing → fits the 56px band
    this.topLeft.add(portrait);

    // ENERGIA label
    this.topLeft.add(
      this.scene.add.text(BAR_X, 3, "ENERGIA", { fontFamily: F, fontSize: "9px", color: "#ffa0a0" })
    );
    // bar graphics
    this.energyBarG = this.scene.add.graphics();
    this.topLeft.add(this.energyBarG);
    // number
    this.energyNumT = this.scene.add.text(BAR_X + BAR_W + 4, 3, "100/100", {
      fontFamily: F, fontSize: "9px", color: "#ffd0d0",
    });
    this.topLeft.add(this.energyNumT);

    // SANIDADE label
    this.topLeft.add(
      this.scene.add.text(BAR_X, 23, "SANIDADE", { fontFamily: F, fontSize: "9px", color: "#a0c0ff" })
    );
    this.sanityBarG = this.scene.add.graphics();
    this.topLeft.add(this.sanityBarG);
    this.sanityNumT = this.scene.add.text(BAR_X + BAR_W + 4, 23, "100/100", {
      fontFamily: F, fontSize: "9px", color: "#cfe2ff",
    });
    this.topLeft.add(this.sanityNumT);

    // Reconhecimento row (VR lives only in the bottom bar now)
    this.recoT = this.scene.add.text(BAR_X, 44, "R: 0", {
      fontFamily: F, fontSize: "10px", color: "#aaaaaa",
    });
    this.topLeft.add(this.recoT);
  }

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

  private buildBottomBar() {
    this.botContainer = this.scene.add.container(0, HUD_BOT_Y).setScrollFactor(0).setDepth(1000);

    // full-width background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.82);
    bg.fillRect(0, 0, GAME_WIDTH, HUD_BOT_H);
    bg.lineStyle(1, 0x333333, 1);
    bg.lineBetween(0, 0, GAME_WIDTH, 0);
    this.botContainer.add(bg);

    // ── Weapon slot ──────────────────────────────
    this.drawBotSection(bg, 0, BOT_WEAPON_W);
    // weapon icon placeholder
    const wIcon = this.scene.add.graphics();
    wIcon.fillStyle(0x4a5260, 1);
    wIcon.fillRect(6, 5, 34, 38);
    wIcon.lineStyle(1, 0x667788, 1);
    wIcon.strokeRect(6, 5, 34, 38);
    // stapler shape hint
    wIcon.fillStyle(0x888899, 1);
    wIcon.fillRect(10, 20, 26, 10);
    wIcon.fillRect(17, 12, 12, 9);
    this.botContainer.add(wIcon);

    this.botContainer.add(
      this.scene.add.text(46, 5, "ARMA ATUAL", { fontFamily: F, fontSize: "8px", color: "#666666" })
    );
    this.weaponNameT = this.scene.add.text(46, 16, "GRAMPEADOR TÁTICO", {
      fontFamily: F, fontSize: "10px", fontStyle: "bold", color: "#eaeaea",
    });
    this.botContainer.add(this.weaponNameT);
    this.botContainer.add(
      this.scene.add.text(46, 29, "∞", { fontFamily: F, fontSize: "13px", color: "#aaaaaa" })
    );

    // ── Special ability ───────────────────────────
    const spX = BOT_WEAPON_W;
    this.drawBotSection(bg, spX, BOT_SPECIAL_W);
    const spIcon = this.scene.add.graphics();
    spIcon.fillStyle(0x3a2010, 1);
    spIcon.fillRect(spX + 6, 5, 34, 38);
    spIcon.lineStyle(1, 0x886644, 1);
    spIcon.strokeRect(spX + 6, 5, 34, 38);
    spIcon.fillStyle(0x8b4a1a, 1);
    spIcon.fillEllipse(spX + 23, 23, 19, 23);
    spIcon.fillStyle(0xf2c14e, 1);
    spIcon.fillRect(spX + 15, 8, 16, 5);
    this.botContainer.add(spIcon);

    this.botContainer.add(
      this.scene.add.text(spX + 46, 5, "HABILIDADE ESPECIAL", { fontFamily: F, fontSize: "8px", color: "#666666" })
    );
    this.specialNameT = this.scene.add.text(spX + 46, 16, "CAFÉ TURBO", {
      fontFamily: F, fontSize: "10px", fontStyle: "bold", color: "#f2c14e",
    });
    this.botContainer.add(this.specialNameT);
    // key badge — special ability key is K
    const keyBg = this.scene.add.graphics();
    keyBg.fillStyle(0xf2c14e, 1);
    keyBg.fillRect(spX + 46, 30, 18, 13);
    keyBg.lineStyle(1, 0x000000, 0.5);
    keyBg.strokeRect(spX + 46, 30, 18, 13);
    this.botContainer.add(keyBg);
    this.botContainer.add(
      this.scene.add.text(spX + 55, 36, "K", { fontFamily: F, fontSize: "10px", fontStyle: "bold", color: "#000000" }).setOrigin(0.5)
    );

    // ── Skills ────────────────────────────────────
    const skX = BOT_WEAPON_W + BOT_SPECIAL_W;
    this.drawBotSection(bg, skX, BOT_SKILLS_W);
    this.botContainer.add(
      this.scene.add.text(skX + BOT_SKILLS_W / 2, 2, "HABILIDADES", {
        fontFamily: F, fontSize: "8px", color: "#666666",
      }).setOrigin(0.5, 0)
    );

    // exactly the 3 real ability slots — ASCII glyphs only
    const skills = [
      { key: "J",     glyph: "ATQ", color: 0xb65555 },
      { key: "K",     glyph: "ESP", color: 0xcc9933 },
      { key: "SHIFT", glyph: ">>",  color: 0x3b6fb6 },
    ];
    skills.forEach((sk, i) => {
      const sx = skX + SLOT_X0 + i * SLOT_GAP;
      const slotBg = this.scene.add.graphics();
      slotBg.fillStyle(0x222630, 1);
      slotBg.fillRect(sx, SLOT_Y, SLOT_W, SLOT_H);
      slotBg.lineStyle(1, 0x445566, 1);
      slotBg.strokeRect(sx, SLOT_Y, SLOT_W, SLOT_H);
      slotBg.fillStyle(sk.color, 0.3);
      slotBg.fillRect(sx + 1, SLOT_Y, SLOT_W - 2, 21);
      this.botContainer.add(slotBg);
      this.botContainer.add(
        this.scene.add.text(sx + SLOT_W / 2, SLOT_Y + 10, sk.glyph, {
          fontFamily: F, fontSize: "10px", fontStyle: "bold", color: "#dddddd",
        }).setOrigin(0.5)
      );
      this.botContainer.add(
        this.scene.add.text(sx + SLOT_W / 2, SLOT_Y + 26, sk.key, {
          fontFamily: F, fontSize: "7px", color: "#888888",
        }).setOrigin(0.5)
      );
    });

    // dash cooldown overlay (drawn over the SHIFT / DASH slot)
    this.dashCooldownG = this.scene.add.graphics();
    this.botContainer.add(this.dashCooldownG);

    // ── VR counter ────────────────────────────────
    const vrX = skX + BOT_SKILLS_W;
    this.drawBotSection(bg, vrX, BOT_VR_W);
    this.botContainer.add(
      this.scene.add.text(vrX + BOT_VR_W / 2, 3, "VALE REFEIÇÃO", {
        fontFamily: F, fontSize: "8px", color: "#888800",
      }).setOrigin(0.5, 0)
    );
    // VR ticket icon
    const vrIcon = this.scene.add.graphics();
    vrIcon.fillStyle(0xf2c14e, 1);
    vrIcon.fillRect(vrX + 12, 14, 42, 26);
    vrIcon.lineStyle(1, 0x000000, 0.5);
    vrIcon.strokeRect(vrX + 12, 14, 42, 26);
    vrIcon.lineStyle(1, 0x000000, 0.3);
    vrIcon.lineBetween(vrX + 16, 14, vrX + 16, 40);
    vrIcon.lineBetween(vrX + 50, 14, vrX + 50, 40);
    vrIcon.fillStyle(0x000000, 0.6);
    vrIcon.fillRect(vrX + 18, 19, 28, 8);
    this.botContainer.add(vrIcon);
    this.vrBotT = this.scene.add.text(vrX + 62, 18, "R$ 0,00", {
      fontFamily: F, fontSize: "13px", fontStyle: "bold", color: "#f2c14e",
    });
    this.botContainer.add(this.vrBotT);

    // ── Mini-map ──────────────────────────────────
    const mm = this.minimapRect();
    this.botContainer.add(
      this.scene.add.text(mm.ox + mm.w / 2, 2, "MAPA", { fontFamily: F, fontSize: "8px", color: "#666666" }).setOrigin(0.5, 0)
    );
    const mmBg = this.scene.add.graphics();
    mmBg.fillStyle(0x111418, 1);
    mmBg.fillRect(mm.ox, mm.oy, mm.w, mm.h);
    mmBg.lineStyle(1, 0x334455, 1);
    mmBg.strokeRect(mm.ox, mm.oy, mm.w, mm.h);
    this.botContainer.add(mmBg);

    this.minimapG = this.scene.add.graphics();
    this.botContainer.add(this.minimapG);

    // ── interact hint (replaces old bottom hint) ──
    this.interactHintT = this.scene.add.text(GAME_WIDTH / 2, HUD_BOT_Y - 14, "", {
      fontFamily: F, fontSize: "10px", color: "#f2c14e",
      backgroundColor: "#000000cc", padding: { x: 8, y: 3 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(1001).setVisible(false);
  }

  private drawBotSection(g: Phaser.GameObjects.Graphics, x: number, w: number) {
    g.lineStyle(1, 0x2a2e38, 1);
    g.lineBetween(x + w, 0, x + w, HUD_BOT_H);
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
  }) {
    this.drawStat(this.energyBarG, BAR_X, BAR_ENERGY_Y, opts.energy, opts.maxEnergy, COLORS.energyBar);
    this.drawStat(this.sanityBarG, BAR_X, BAR_SANITY_Y, opts.sanity, opts.maxSanity, COLORS.sanityBar);
    this.energyNumT.setText(`${opts.energy}/${opts.maxEnergy}`);
    this.sanityNumT.setText(`${opts.sanity}/${opts.maxSanity}`);

    this.recoT.setText(`R: ${opts.reconhecimento.toLocaleString("pt-BR")}`);
    this.vrBotT.setText(this.fmtVR(opts.vr));

    // clock
    const minutes = Math.floor((opts.time - opts.startTime) / 1000);
    const hh = 18 + Math.floor(minutes / 60);
    const mm = minutes % 60;
    this.clockT.setText(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);

    // minimap player dot
    this.updateMinimap(opts.playerX);

    // dash cooldown overlay (third slot = SHIFT / DASH)
    this.dashCooldownG.clear();
    const dashRatio = opts.dashCooldown ?? 0;
    if (dashRatio > 0) {
      const dsx = BOT_WEAPON_W + BOT_SPECIAL_W + SLOT_X0 + DASH_SLOT_INDEX * SLOT_GAP;
      this.dashCooldownG.fillStyle(0x000000, 0.72);
      this.dashCooldownG.fillRect(dsx, SLOT_Y, SLOT_W, Math.round(dashRatio * SLOT_H));
      this.dashCooldownG.lineStyle(1, 0x6688cc, 0.9);
      this.dashCooldownG.strokeRect(dsx, SLOT_Y, SLOT_W, SLOT_H);
    }

    // interact hint
    if (opts.interactHint) {
      this.interactHintT.setText(opts.interactHint).setVisible(true);
    } else {
      this.interactHintT.setVisible(false);
    }
  }

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

  // ─── private helpers ────────────────────────────────────────────

  private drawStat(
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

  /** Minimap rectangle in bottom-bar local coords. */
  private minimapRect() {
    const mmX = BOT_WEAPON_W + BOT_SPECIAL_W + BOT_SKILLS_W + BOT_VR_W;
    return {
      ox: mmX + 4,
      oy: 12,
      w: GAME_WIDTH - mmX - 8,
      h: HUD_BOT_H - 16,
    };
  }

  private updateMinimap(playerX: number) {
    const { ox, oy, w, h } = this.minimapRect();
    const scaleX = w / this.levelWidth;

    this.minimapG.clear();
    // floor line
    this.minimapG.lineStyle(1, 0x3a3f47, 1);
    this.minimapG.lineBetween(ox, oy + h - 2, ox + w, oy + h - 2);
    // player dot
    const px = ox + playerX * scaleX;
    const py = oy + h - 4;
    this.minimapG.fillStyle(COLORS.player, 1);
    this.minimapG.fillRect(px - 2, py - 3, 4, 6);
    // enemies (red dots — drawn by scene if needed via addMinimapDot)
  }

  addMinimapDot(worldX: number, worldY: number, color: number) {
    const { ox, oy, w, h } = this.minimapRect();
    const scaleX = w / this.levelWidth;
    const scaleY = h / GAME_HEIGHT;
    this.minimapG.fillStyle(color, 1);
    this.minimapG.fillRect(ox + worldX * scaleX - 1, oy + worldY * scaleY - 1, 3, 3);
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
