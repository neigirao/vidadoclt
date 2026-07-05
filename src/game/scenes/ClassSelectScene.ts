import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { CLASSES, ClassId, WEAPONS } from "../systems/WeaponSystem";
import { getRun } from "../systems/PlayerState";
import { applyRunSeed } from "../systems/RNG";
import { resolveSprite } from "../systems/SpriteLibrary";
import { loadUpgrades, applyUpgradesToRun } from "../systems/ReconhecimentoSystem";

const BG_PANEL = 0x12151a;
const BG_CARD = 0x1a1d23;
const ACCENT = 0xf2a800;
const TEXT_LIGHT = "#eaeaea";
const TEXT_DIM = "#888888";
const TEXT_ACCENT = "#f2a800";

const CLASS_IDS: ClassId[] = ["estagiario", "analista", "terceirizado"];
const CARD_W = 240;
const CARD_H = 340;

export class ClassSelectScene extends Phaser.Scene {
  private selectedIndex = 1;
  private cards: Phaser.GameObjects.Container[] = [];
  private cardY = 0;
  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;
  private prevLeft = false;
  private prevRight = false;
  private lockedClasses = new Set<ClassId>();

  constructor() {
    super("ClassSelectScene");
  }

  create() {
    this.cards = [];

    // Seed all RNG for this run — must happen before any Phaser.Math.Between call
    const run = getRun(this);
    applyRunSeed(run.seed);

    // Primeira run: só Estagiário destravado. Analista/Terceirizado destravam
    // ao completar a Fase 1 pela primeira vez (via loopCount > 0).
    if (run.loopCount === 0) {
      this.lockedClasses = new Set<ClassId>(["analista", "terceirizado"]);
      this.selectedIndex = 0;
    }

    // Background — match MenuScene palette
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, BG_PANEL);
    if (this.textures.exists("bg-menu")) {
      this.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "bg-menu")
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(0.18)
        .setDepth(-1);
    }

    // Scanlines overlay
    const scan = this.add.graphics();
    scan.lineStyle(1, 0x000000, 0.1);
    for (let y = 0; y < GAME_HEIGHT; y += 4) scan.lineBetween(0, y, GAME_WIDTH, y);

    // Header bar
    const hdrG = this.add.graphics();
    hdrG.fillStyle(BG_CARD, 1);
    hdrG.fillRect(0, 0, GAME_WIDTH, 46);
    hdrG.lineStyle(1, ACCENT, 0.6);
    hdrG.lineBetween(0, 46, GAME_WIDTH, 46);

    this.add
      .text(GAME_WIDTH / 2, 14, "ESCOLHA SUA FUNÇÃO", {
        fontFamily: "monospace",
        fontSize: "18px",
        fontStyle: "bold",
        color: TEXT_ACCENT,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 36, "←  →  navegar     ENTER / clique  confirmar", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: TEXT_DIM,
      })
      .setOrigin(0.5);

    this.cardY = Math.floor(GAME_HEIGHT / 2) + 28;
    const totalW = CLASS_IDS.length * CARD_W + (CLASS_IDS.length - 1) * 30;
    const startX = Math.floor((GAME_WIDTH - totalW) / 2);

    CLASS_IDS.forEach((cid, i) => {
      const cx = startX + i * (CARD_W + 30) + CARD_W / 2;
      const container = this.buildCard(cid, cx, this.cardY);
      this.cards.push(container);

      const hit = this.add
        .rectangle(cx, this.cardY, CARD_W, CARD_H, 0, 0)
        .setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => {
        if (this.lockedClasses.has(cid)) return;
        this.selectedIndex = i;
        this.refreshCards();
        this.confirm();
      });
      hit.on("pointerover", () => {
        if (this.lockedClasses.has(cid)) return;
        this.selectedIndex = i;
        this.refreshCards();
      });
    });

    this.refreshCards();

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 12, "[ ENTER ] ou clique no card para começar", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#333333",
      })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    this.leftKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.A).on("down", () => this.moveSelection(-1));
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.D).on("down", () => this.moveSelection(1));
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on("down", () => this.confirm());
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on("down", () => this.confirm());

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private buildCard(classId: ClassId, cx: number, cy: number): Phaser.GameObjects.Container {
    const def = CLASSES[classId];
    const weapon = WEAPONS[def.startWeapon];
    const hw = CARD_W / 2;
    const hh = CARD_H / 2;
    const container = this.add.container(cx, cy);

    // [0] Background — redrawn in refreshCards
    container.add(this.add.graphics());

    // [1] Color header stripe
    const hdr = this.add.graphics();
    hdr.fillStyle(def.color, 0.9);
    hdr.fillRect(-hw, -hh, CARD_W, 32);
    container.add(hdr);

    // [2] Class label
    container.add(
      this.add
        .text(0, -hh + 16, def.label.toUpperCase(), {
          fontFamily: "monospace",
          fontSize: "13px",
          fontStyle: "bold",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5),
    );

    // [3] Player sprite preview using real atlas sprite
    const classIdx = CLASS_IDS.indexOf(classId);
    const idleFrame = `tex-player-idle${classIdx + 1}`;
    const charSpr = this.add
      .image(0, -hh + 90, ...resolveSprite(idleFrame))
      .setDisplaySize(72, 72)
      .setTint(def.color);
    container.add(charSpr);

    // [4] Stat bars
    const barG = this.add.graphics();
    const barX = -hw + 14;
    const barW = CARD_W - 28;
    const barsTop = -hh + 142;
    const drawBar = (yOff: number, fill: number, color: number) => {
      barG.fillStyle(0x0a0d12, 1);
      barG.fillRect(barX, barsTop + yOff, barW, 7);
      barG.fillStyle(color, 1);
      barG.fillRect(barX, barsTop + yOff, Math.max(4, Math.floor(barW * Math.min(fill, 1))), 7);
    };
    drawBar(0, def.maxEnergy / 130, 0xdd4444);
    drawBar(20, def.maxSanity / 120, 0x44ddaa);
    drawBar(40, def.speedMult / 1.2, 0x4488ff);
    container.add(barG);

    // [5,6,7] Stat labels
    const lblStyle = (color: string) => ({ fontFamily: "monospace", fontSize: "8px", color });
    container.add(
      this.add.text(barX, barsTop - 11, `ENERGIA  ${def.maxEnergy}`, lblStyle("#dd6666")),
    );
    container.add(
      this.add.text(barX, barsTop + 9, `SANIDADE ${def.maxSanity}`, lblStyle("#44ddaa")),
    );
    container.add(
      this.add.text(
        barX,
        barsTop + 29,
        `VELOCIDADE ${def.speedMult >= 1 ? "+" : ""}${Math.round((def.speedMult - 1) * 100)}%`,
        lblStyle("#4488ff"),
      ),
    );

    // [8] Description
    container.add(
      this.add
        .text(0, -hh + 200, def.description, {
          fontFamily: "monospace",
          fontSize: "9px",
          color: TEXT_DIM,
          align: "center",
          wordWrap: { width: CARD_W - 20 },
        })
        .setOrigin(0.5, 0),
    );

    // [9] Weapon
    container.add(
      this.add
        .text(0, hh - 68, `⚔ ${weapon.name}`, {
          fontFamily: "monospace",
          fontSize: "10px",
          fontStyle: "bold",
          color: TEXT_ACCENT,
        })
        .setOrigin(0.5, 0),
    );

    // [10] Trait
    container.add(
      this.add
        .text(0, hh - 48, def.trait, {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#88ff88",
        })
        .setOrigin(0.5, 0),
    );

    // [11] Confirm hint
    container.add(
      this.add
        .text(0, hh - 18, "[ ENTER ] para jogar", {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#444444",
        })
        .setOrigin(0.5, 0),
    );

    return container;
  }

  private refreshCards() {
    const hw = CARD_W / 2;
    const hh = CARD_H / 2;
    this.cards.forEach((container, i) => {
      const bg = container.getAt(0) as Phaser.GameObjects.Graphics;
      const charSpr = container.getAt(3) as Phaser.GameObjects.Image;
      const def = CLASSES[CLASS_IDS[i]];
      const selected = i === this.selectedIndex;
      const locked = this.lockedClasses.has(CLASS_IDS[i]);
      bg.clear();
      if (selected && !locked) {
        bg.fillStyle(BG_CARD, 1);
        bg.fillRect(-hw, -hh, CARD_W, CARD_H);
        bg.lineStyle(2, ACCENT, 1);
        bg.strokeRect(-hw + 1, -hh + 1, CARD_W - 2, CARD_H - 2);
        charSpr.clearTint();
        container.setAlpha(1);
        container.setY(this.cardY - 8);
      } else {
        bg.fillStyle(BG_PANEL, 1);
        bg.fillRect(-hw, -hh, CARD_W, CARD_H);
        bg.lineStyle(1, locked ? 0x442222 : 0x252830, 1);
        bg.strokeRect(-hw, -hh, CARD_W, CARD_H);
        charSpr.setTint(locked ? 0x333333 : def.color);
        container.setAlpha(locked ? 0.35 : 0.48);
        container.setY(this.cardY);
      }
      // Overlay de bloqueio: só monta 1x (slot [12] no container)
      if (locked && container.length < 13) {
        const lockG = this.add.graphics();
        lockG.fillStyle(0x000000, 0.55);
        lockG.fillRect(-hw, -hh, CARD_W, CARD_H);
        container.add(lockG);
        const lockT = this.add
          .text(0, 0, "🔒 BLOQUEADO", {
            fontFamily: "monospace",
            fontSize: "12px",
            fontStyle: "bold",
            color: "#cc6644",
            stroke: "#000",
            strokeThickness: 3,
          })
          .setOrigin(0.5);
        container.add(lockT);
        const hintT = this.add
          .text(0, 22, "Complete a Fase 1 para destravar", {
            fontFamily: "monospace",
            fontSize: "8px",
            color: "#886644",
            align: "center",
            wordWrap: { width: CARD_W - 20 },
          })
          .setOrigin(0.5, 0);
        container.add(hintT);
      }
    });
  }

  /** Move selectedIndex ao próximo card não-bloqueado na direção dada. */
  private moveSelection(dir: 1 | -1) {
    let idx = this.selectedIndex;
    for (let step = 0; step < CLASS_IDS.length; step++) {
      idx = Math.max(0, Math.min(CLASS_IDS.length - 1, idx + dir));
      if (!this.lockedClasses.has(CLASS_IDS[idx])) {
        this.selectedIndex = idx;
        this.refreshCards();
        return;
      }
      if (idx === 0 || idx === CLASS_IDS.length - 1) break;
    }
  }

  update() {
    const leftDown = this.leftKey.isDown;
    const rightDown = this.rightKey.isDown;
    if (leftDown && !this.prevLeft) this.moveSelection(-1);
    if (rightDown && !this.prevRight) this.moveSelection(1);
    this.prevLeft = leftDown;
    this.prevRight = rightDown;
  }

  private confirm() {
    if (this.lockedClasses.has(CLASS_IDS[this.selectedIndex])) return;
    const run = getRun(this);
    run.characterClass = CLASS_IDS[this.selectedIndex];

    // Apply permanent upgrades from Reconhecimento meta-progression
    const levels = loadUpgrades();
    const mods = {
      maxEnergy: 0,
      maxSanity: 0,
      vrDropMult: 0,
      parryWindowBonus: 0,
      specialCooldownMult: 1.0,
      dashCooldownBonus: 0,
      damageReductionMult: 1.0,
      parryEnergyRestore: 0,
      parryVrDrop: 0,
      comboHitsBonus: 0,
    };
    applyUpgradesToRun(levels, run, mods);
    run.upgMaxEnergy = mods.maxEnergy;
    run.upgMaxSanity = mods.maxSanity;
    run.upgVrDropMult = mods.vrDropMult;
    run.upgParryWindowBonus = mods.parryWindowBonus;
    run.upgSpecialCooldownMult = mods.specialCooldownMult;
    run.upgDashCooldownBonus = mods.dashCooldownBonus;
    run.upgDamageReductionMult = mods.damageReductionMult;
    run.upgParryEnergyRestore = mods.parryEnergyRestore;
    run.upgParryVrDrop = mods.parryVrDrop;
    run.upgComboHitsBonus = mods.comboHitsBonus;

    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("OpenSpaceV2Scene");
    });
  }
}
