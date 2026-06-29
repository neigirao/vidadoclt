import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { sanityBand } from "./PlayerState";
import { generateNotifSubject, noise2d } from "./CorporateAI";
import { Sfx } from "./AudioSystem";

// Static fallback pool — shown alongside procedurally-generated subjects
const STATIC_NOTIFS = [
  "[Teams] URGENTE: action needed ate 18h",
  "[Slack] @here reuniao em 5 minutos",
  "[Teams] Voce tem 12 mensagens nao lidas",
  "[Outlook] Prazo antecipado. Favor confirmar.",
  "[Slack] Pode me dar 5 min? Eh rapido",
  "[Calendario] Lembrete: 1:1 com gestor - AGORA",
  "[Teams] Voce viu o meu e-mail de ontem?",
  "[Outlook] RE: RE: RE: Urgente: ver isso",
  "[Jira] 47 tickets atribuidos a voce",
  "[Teams] Vc esta disponivel? E importante",
];

// 50% chance to show a procedurally-generated corporate subject
function pickNotif(): string {
  if (Math.random() < 0.5) return generateNotifSubject();
  return Phaser.Utils.Array.GetRandom(STATIC_NOTIFS) as string;
}

export class SanityFx {
  private vignette!: Phaser.Filters.Vignette;
  private colorMatrix!: Phaser.Filters.ColorMatrix;
  private barrel!: Phaser.Filters.Barrel;
  private noise: Phaser.GameObjects.Graphics;
  private useFilters: boolean;

  private currentBand: ReturnType<typeof sanityBand> = "ok";
  private nextNoiseAt = 0;
  private nextNotifAt = 0;
  private nextShakeAt = 0;

  private chromaRed!: Phaser.GameObjects.Rectangle;
  private chromaCyan!: Phaser.GameObjects.Rectangle;
  private scanlines: Phaser.GameObjects.Graphics;
  private scanlinesBuilt = false;

  constructor(private scene: Phaser.Scene) {
    // WebGL filters only — Canvas renderer falls back to vignette-less mode
    this.useFilters = scene.game.renderer.type === Phaser.WEBGL;

    if (this.useFilters) {
      const cam = scene.cameras.main;
      // Start invisible; updateFilters() drives all values each frame
      this.vignette     = cam.filters.internal.addVignette(0.5, 0.5, 0.85, 0, 0x000000);
      this.colorMatrix  = cam.filters.internal.addColorMatrix();
      this.barrel       = cam.filters.internal.addBarrel(1.0);
    }

    // Pixel-static noise kept as Graphics (30–80 dots, cheaper than a GPU texture alloc)
    this.noise = scene.add.graphics().setScrollFactor(0).setDepth(901);

    // CRT scanlines: horizontal dark stripes every 2px, alpha 0 at rest
    // Built once, alpha driven by stress level
    this.scanlines = scene.add.graphics().setScrollFactor(0).setDepth(903).setAlpha(0);

    // Chromatic aberration: two full-screen tinted rects, alpha 0 at rest
    // Offset increased to 8px for stronger visual impact per artist audit
    this.chromaRed  = scene.add.rectangle(GAME_WIDTH / 2 - 8, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0)
      .setScrollFactor(0).setDepth(902).setBlendMode(Phaser.BlendModes.ADD);
    this.chromaCyan = scene.add.rectangle(GAME_WIDTH / 2 + 8, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x00ffff, 0)
      .setScrollFactor(0).setDepth(902).setBlendMode(Phaser.BlendModes.ADD);
  }

  private buildScanlines(): void {
    if (this.scanlinesBuilt) return;
    if (!this.useFilters) return; // scanlines only meaningful in WebGL path
    this.scanlinesBuilt = true;
    this.scanlines.fillStyle(0x000000, 0.5);
    for (let y = 0; y < GAME_HEIGHT; y += 4) {
      this.scanlines.fillRect(0, y, GAME_WIDTH, 2);
    }
  }

  update(time: number, sanity: number) {
    const band = sanityBand(sanity);
    // Sanity audio drone on band change — throttled to prevent audio spam
    if (band !== this.currentBand) {
      const stress = Math.max(0, Math.min(1, (100 - sanity) / 100));
      if (stress > 0.25) Sfx.sanityDrone(stress);
    }
    this.currentBand = band;

    // Continuous stress value: 0 = full sanity, 1 = burnout
    const stress = Math.max(0, Math.min(1, (100 - sanity) / 100));

    if (this.useFilters) this.updateFilters(stress);

    // CRT scanlines — fade in starting at anxious, full at burnout
    if (stress > 0.6) {
      this.buildScanlines();
      const scanAlpha = Math.min(1, (stress - 0.6) / 0.4) * 0.35;
      this.scanlines.setAlpha(scanAlpha);
    } else {
      this.scanlines.setAlpha(0);
    }

    // Periodic camera shake + pixel static
    if (band === "anxious" || band === "burnout") {
      if (time >= this.nextShakeAt) {
        const intensity = band === "burnout" ? 0.005 : 0.0022;
        const duration  = band === "burnout" ? 180 : 120;
        const interval  = band === "burnout"
          ? Phaser.Math.Between(350, 600)
          : Phaser.Math.Between(700, 1200);
        this.nextShakeAt = time + interval;
        this.scene.cameras.main.shake(duration, intensity);
      }

      if (time >= this.nextNoiseAt) {
        this.nextNoiseAt = time + Phaser.Math.Between(80, 180);
        this.noise.clear();
        const dots = band === "burnout" ? 80 : 30;
        this.noise.fillStyle(0xffffff, 0.05);
        for (let i = 0; i < dots; i++) {
          this.noise.fillRect(
            Phaser.Math.Between(0, GAME_WIDTH),
            Phaser.Math.Between(0, GAME_HEIGHT),
            2, 2,
          );
        }
      }
    } else {
      this.noise.clear();
    }

    // Fake notification popups at stressed / anxious
    if ((band === "stressed" || band === "anxious") && time >= this.nextNotifAt) {
      const interval = band === "anxious"
        ? Phaser.Math.Between(2000, 4000)
        : Phaser.Math.Between(5000, 9000);
      this.nextNotifAt = time + interval;
      this.spawnNotif();
    }
  }

  private updateFilters(stress: number) {
    // ── Vignette ──────────────────────────────────────────────────────────────
    // Organic pulse: simplex noise drives subtle breathing of radius + strength.
    // Scale: time in seconds (slow drift), stress used as spatial axis for variation.
    const t = this.scene.time.now * 0.001;
    const pulse = noise2d(t * 0.4, stress * 2.0) * 0.03 * stress; // ±3% at full burnout

    this.vignette.radius   = 0.85 - stress * 0.45 + pulse;
    this.vignette.strength = stress * 0.85 + pulse * 0.5;

    // Color transitions from black → dark red starting at ~75% stress
    if (stress > 0.75) {
      const t = (stress - 0.75) / 0.25;              // 0 → 1 over last quarter
      const r = Math.round(t * 0x6b);
      const g = Math.round(t * 0x08);
      const b = Math.round(t * 0x08);
      this.vignette.setColor((r << 16) | (g << 8) | b);
    } else {
      this.vignette.setColor(0x000000);
    }

    // ── ColorMatrix (desaturation) ────────────────────────────────────────────
    // Begins at 50% stress, reaches full desaturation at burnout
    if (stress > 0.5) {
      const desat = (stress - 0.5) / 0.5;            // 0 → 1 over upper half
      // saturate(-x): x=0 identity, x=1 fully grey
      this.colorMatrix.colorMatrix.reset().saturate(-(desat * 0.85));
    } else {
      this.colorMatrix.colorMatrix.reset();
    }

    // ── Barrel distortion (pincushion at anxious+) ──────────────────────────
    // Increased range: starts earlier (0.5 stress) and goes deeper (→ 0.88)
    if (stress > 0.5) {
      const t = (stress - 0.5) / 0.5;               // 0 → 1 over upper half
      this.barrel.amount = 1.0 - t * 0.12;          // 1.0 → 0.88
    } else {
      this.barrel.amount = 1.0;
    }

    // ── Color temperature shift (warm→cold as stress rises) ──────────────────
    // Boost chromatic aberration alpha proportional to stress
    if (stress > 0.3) {
      const chromaAmt = (stress - 0.3) / 0.7 * 0.07;
      this.chromaRed.setAlpha(chromaAmt);
      this.chromaCyan.setAlpha(chromaAmt * 0.75);
    } else {
      this.chromaRed.setAlpha(0);
      this.chromaCyan.setAlpha(0);
    }
  }

  triggerChromaticHit(): void {
    this.chromaRed.setAlpha(0.14);
    this.chromaCyan.setAlpha(0.10);
    this.scene.tweens.add({ targets: [this.chromaRed, this.chromaCyan], alpha: 0, duration: 200 });
  }

  private spawnNotif() {
    const msg = pickNotif();
    const pw = 284, ph = 30;
    const px = GAME_WIDTH - pw - 8;
    const py = 74;

    const panel = this.scene.add.graphics().setScrollFactor(0).setDepth(950);
    panel.fillStyle(0x0a1f0a, 0.93);
    panel.fillRect(px, py, pw, ph);
    panel.lineStyle(1, 0x33aa33, 0.85);
    panel.strokeRect(px, py, pw, ph);
    panel.fillStyle(0x33aa33, 1);
    panel.fillRect(px, py, 3, ph);

    const txt = this.scene.add.text(px + 10, py + 9, msg, {
      fontFamily: "monospace", fontSize: "10px", color: "#88ee88",
    }).setScrollFactor(0).setDepth(951);

    this.scene.tweens.add({
      targets: [panel, txt],
      alpha: 0,
      duration: 500,
      delay: 2600,
      onComplete: () => { panel.destroy(); txt.destroy(); },
    });
  }

  destroy() {
    if (this.useFilters) {
      this.vignette.destroy();
      this.colorMatrix.destroy();
      this.barrel.destroy();
    }
    this.noise.destroy();
    this.scanlines.destroy();
    this.chromaRed.destroy();
    this.chromaCyan.destroy();
  }
}
