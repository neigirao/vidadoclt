import Phaser from "phaser";
import {
  makeFurnitureTextures,
  makeOfficeBackgrounds,
  makeUiTextures,
  makeObjectTextures,
  applyBackgroundFilters,
} from "../systems/TextureFactory";
import { initSpriteLibrary } from "../systems/SpriteLibrary";

const GREEN  = "#00ff41";
const AMBER  = "#ffb000";
const WHITE  = "#e8e8e8";
const CURSOR = "█";

// Milliseconds between each character when "typing"
const TYPE_MS = 48;

export class PreloadScene extends Phaser.Scene {
  private loadProgress = 0;
  private assetsReady  = false;
  private animDone     = false;

  constructor() {
    super("PreloadScene");
  }

  // ─── Asset loading (same as BootScene) ───────────────────────────────────

  preload() {
    this.load.image("bg-menu",        "/assets/bg-menu.png");
    this.load.image("bg-openspace",   "/assets/bg-openspace.png");
    this.load.image("bg-atendimento", "/assets/bg-atendimento.png");
    this.load.image("bg-comercial",   "/assets/bg-comercial.png");
    this.load.image("bg-produto",     "/assets/bg-produto.png");
    this.load.image("bg-tecnologia",  "/assets/bg-tecnologia.png");
    this.load.image("bg-rh",          "/assets/bg-rh.png");
    this.load.image("bg-compliance",  "/assets/bg-compliance.png");
    this.load.image("bg-diretoria",   "/assets/bg-diretoria.png");
    this.load.image("bg-presidencia", "/assets/bg-presidencia.png");
    this.load.image("bg-cobertura",   "/assets/bg-cobertura.png");
    this.load.image("bg-copa",        "/assets/bg-copa.png");
    this.load.image("tex-floor",      "/assets/sprites/tile-floor.png");
    this.load.image("tex-vr",         "/assets/sprites/item-vr-coin.png");
    this.load.image("tex-inkproj",    "/assets/sprites/item-inkproj.png");
    this.load.image("tex-coffee",     "/assets/sprites/item-coffee-cup.png");
    this.load.image("tex-door",       "/assets/sprites/obj-door.png");
    this.load.image("tex-ponto",      "/assets/sprites/obj-ponto.png");
    this.load.atlas("sprites", "/assets/atlas.png", "/assets/atlas.json");

    this.load.on("progress", (v: number) => { this.loadProgress = v; });
    this.load.on("complete", () => { this.assetsReady = true; });
  }

  // ─── Cinematic boot sequence ──────────────────────────────────────────────

  create() {
    // Texture factories — safe to call now (all assets loaded)
    makeUiTextures(this);
    makeFurnitureTextures(this);
    makeObjectTextures(this);
    makeOfficeBackgrounds(this);
    applyBackgroundFilters(this);
    initSpriteLibrary(this);
    this.assetsReady = true;

    const W = this.scale.width;
    const H = this.scale.height;

    // Full-screen black background
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000).setDepth(0);

    // Scanline overlay
    const scanGfx = this.add.graphics().setDepth(2).setAlpha(0.04);
    for (let y = 0; y < H; y += 4) {
      scanGfx.fillStyle(0x000000);
      scanGfx.fillRect(0, y, W, 2);
    }

    // Subtle CRT vignette
    const vig = this.add.graphics().setDepth(3).setAlpha(0.35);
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const alpha = t * t * 0.6;
      vig.fillStyle(0x000000, alpha);
      vig.fillRect(i, i, W - i * 2, H - i * 2);
    }

    const font14 = { fontFamily: "Courier New, monospace", fontSize: "14px", color: GREEN };
    const font16 = { fontFamily: "Courier New, monospace", fontSize: "16px", color: GREEN };
    const font13 = { fontFamily: "Courier New, monospace", fontSize: "13px", color: AMBER };

    const startX = Math.round(W * 0.08);
    let   curY   = Math.round(H * 0.06);
    const lineH  = 22;

    const lines: Phaser.GameObjects.Text[] = [];

    const addLine = (txt: string, style = font14, yOff = 0): Phaser.GameObjects.Text => {
      const t = this.add.text(startX, curY + yOff, txt, style).setDepth(4).setAlpha(0);
      curY += lineH;
      lines.push(t);
      return t;
    };

    // ── BIOS header ──
    const bios1 = addLine("VIDACLT(R) BIOS v2.6.1  Copyright (C) 1994-2026", { ...font14, color: AMBER });
    const bios2 = addLine("Recursos Humanos LTDA - All rights reserved.", { ...font14, color: AMBER });
    addLine("");
    const mem   = addLine("640K Conventional Memory....", font14);
    const cpu   = addLine("CPU: Pentium(R) Analista 233MHz  [OK]", font14);
    const hdd   = addLine("HDD0: VIDACLT-20GB  [DETECTING...]", font14);
    addLine("");
    const dos   = addLine("Starting VIDACLT-DOS 6.22...", { ...font16, color: WHITE });
    addLine("");

    // ── Prompt lines ──
    const prompt1 = addLine("C:\\>", font16);
    const prompt2 = addLine("C:\\NEI>", font16);
    addLine("");
    const loading = addLine("Carregando...", { ...font14, color: AMBER });
    addLine("");
    const barLabel = addLine("", font13);
    addLine("");
    const ready    = addLine("", { ...font16, color: WHITE });

    // Cursor object
    const cursor = this.add.text(0, 0, CURSOR, font16).setDepth(5).setAlpha(0);
    this.tweens.add({ targets: cursor, alpha: { from: 1, to: 0 }, duration: 500, repeat: -1, yoyo: true });

    // ── Sequencing ──
    const seq = (delay: number, fn: () => void) => this.time.delayedCall(delay, fn);

    // Screen flicker on boot
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff).setDepth(10).setAlpha(0);
    seq(100,  () => { flash.setAlpha(0.6); });
    seq(160,  () => { flash.setAlpha(0);   });
    seq(240,  () => { flash.setAlpha(0.25);});
    seq(300,  () => { flash.setAlpha(0);   });

    // BIOS lines appear
    seq(350,  () => { bios1.setAlpha(1); bios2.setAlpha(1); });
    seq(750,  () => { mem.setAlpha(1);   });
    seq(1050, () => { cpu.setAlpha(1);   });
    seq(1300, () => { hdd.setAlpha(1);   });
    seq(1800, () => {
      hdd.setText("HDD0: VIDACLT-20GB  [OK]");
      hdd.setStyle({ ...font14, color: GREEN });
    });
    seq(2100, () => { dos.setAlpha(1); });

    // DOS prompt — user types "cd nei"
    seq(2700, () => {
      prompt1.setAlpha(1);
      cursor.setPosition(startX + prompt1.width + 2, prompt1.y);
      cursor.setAlpha(1);
      this.typeText(prompt1, "C:\\>cd nei", TYPE_MS, cursor, () => {
        cursor.setAlpha(0);
      });
    });

    // Second prompt — user types "vidadoclt.exe"
    seq(3500, () => {
      prompt2.setAlpha(1);
      cursor.setPosition(startX + prompt2.width + 2, prompt2.y);
      cursor.setAlpha(1);
      this.typeText(prompt2, "C:\\NEI>vidadoclt.exe", TYPE_MS, cursor, () => {
        cursor.setAlpha(0);
        this.time.delayedCall(200, () => {
          loading.setAlpha(1);
          this.animDone = true;
        });
      });
    });

    // Loading bar updates via tweened timer
    seq(4500, () => {
      barLabel.setAlpha(1);
      this.updateBarLoop(barLabel, ready);
    });
  }

  // ─── Typing animation ─────────────────────────────────────────────────────

  private typeText(
    obj: Phaser.GameObjects.Text,
    full: string,
    msPerChar: number,
    cursor: Phaser.GameObjects.Text,
    onDone: () => void,
  ) {
    let i = 0;
    const timer = this.time.addEvent({
      delay: msPerChar,
      repeat: full.length - 1,
      callback: () => {
        i++;
        obj.setText(full.slice(0, i));
        cursor.setPosition(obj.x + obj.width + 2, obj.y);
        if (i >= full.length) { timer.remove(); onDone(); }
      },
    });
    obj.setText("");
  }

  // ─── Progress bar loop ────────────────────────────────────────────────────

  private updateBarLoop(
    barLabel: Phaser.GameObjects.Text,
    ready: Phaser.GameObjects.Text,
  ) {
    const BAR_CHARS = 28;
    let   displayed = 0;

    const tick = this.time.addEvent({
      delay: 80,
      loop: true,
      callback: () => {
        // Drive displayed progress toward real load progress (min 5% visual lead)
        const target = Math.max(this.loadProgress, this.assetsReady ? 1 : 0);
        displayed = Math.min(displayed + 0.04, target);

        const filled = Math.round(displayed * BAR_CHARS);
        const bar    = "█".repeat(filled) + "░".repeat(BAR_CHARS - filled);
        const pct    = Math.round(displayed * 100);
        barLabel.setText(`[${bar}] ${pct}%`);

        if (displayed >= 0.99 && this.assetsReady && this.animDone) {
          tick.remove();
          barLabel.setText(`[${"█".repeat(BAR_CHARS)}] 100%`);
          ready.setText("Sistema inicializado. Boa sorte, CLT.");
          ready.setAlpha(1);

          this.time.delayedCall(1200, () => this.transitionToMenu());
        }
      },
    });
  }

  // ─── Fade out and start menu ──────────────────────────────────────────────

  private transitionToMenu() {
    const W = this.scale.width;
    const H = this.scale.height;
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000)
      .setAlpha(0).setDepth(20);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 800,
      ease: "Power2",
      onComplete: () => this.scene.start("MenuScene"),
    });
  }
}
