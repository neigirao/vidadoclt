import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { sanityBand } from "./PlayerState";
import { TutorialPrompts } from "./TutorialPrompts";
import { generateNotifSubject, noise2d } from "./CorporateAI";
import { Sfx } from "./AudioSystem";
import { loadSettings } from "./Settings";
import { Telemetry } from "./Telemetry";

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

  /**
   * Acessibilidade: quando ligado, corta os efeitos que distorcem/piscam a tela
   * (barrel, cromática, tremor, chiado, scanlines). Mantém uma vinheta e a
   * dessaturação suaves — o jogador ainda "sente" o estresse sem gatilho
   * fotossensível. Lido 1× na construção (a cena é recriada a cada fase).
   */
  private reduce: boolean;
  private nextSettingCheck = 0;

  constructor(private scene: Phaser.Scene) {
    this.reduce = loadSettings().reduceSanityFx;
    // WebGL filters only — Canvas renderer falls back to vignette-less mode
    this.useFilters = scene.game.renderer.type === Phaser.WEBGL;

    if (this.useFilters) {
      const cam = scene.cameras.main;
      // Start invisible; updateFilters() drives all values each frame
      this.vignette = cam.filters.internal.addVignette(0.5, 0.5, 0.85, 0, 0x000000);
      this.colorMatrix = cam.filters.internal.addColorMatrix();
      this.barrel = cam.filters.internal.addBarrel(1.0);
    }

    // Pixel-static noise kept as Graphics (30–80 dots, cheaper than a GPU texture alloc)
    this.noise = scene.add.graphics().setScrollFactor(0).setDepth(901);

    // CRT scanlines: horizontal dark stripes every 2px, alpha 0 at rest
    // Built once, alpha driven by stress level
    this.scanlines = scene.add.graphics().setScrollFactor(0).setDepth(903).setAlpha(0);

    // Chromatic aberration: two full-screen tinted rects, alpha 0 at rest
    // Offset increased to 8px for stronger visual impact per artist audit
    this.chromaRed = scene.add
      .rectangle(GAME_WIDTH / 2 - 8, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0)
      .setScrollFactor(0)
      .setDepth(902)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.chromaCyan = scene.add
      .rectangle(GAME_WIDTH / 2 + 8, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x00ffff, 0)
      .setScrollFactor(0)
      .setDepth(902)
      .setBlendMode(Phaser.BlendModes.ADD);
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
    // Reaplica o setting em tempo real (toggle no Pause) sem ler localStorage
    // todo frame — checa a cada 500ms.
    if (time >= this.nextSettingCheck) {
      this.nextSettingCheck = time + 500;
      this.reduce = loadSettings().reduceSanityFx;
    }

    const band = sanityBand(sanity);
    // Sanity audio drone on band change — throttled to prevent audio spam
    if (band !== this.currentBand) {
      const stress = Math.max(0, Math.min(1, (100 - sanity) / 100));
      if (stress > 0.25) Sfx.sanityDrone(stress);
      // Dica 1ª sessão: explica a Sanidade quando ela piora pela 1ª vez.
      if (band !== "ok") {
        TutorialPrompts.maybeShow(
          this.scene,
          "sanity",
          "Sanidade caindo: no fundo dela vem o Burnout. Cuide dela — ou aprenda a lutar nele.",
        );
      }
      // VAI NA RAÇA: ao ENTRAR no Burnout, ensina o trade-off (é modo, não bug).
      // Parry apertado + frágil, MAS bate mais forte, ganha +VR e mata cura.
      if (band === "burnout") {
        Telemetry.burnoutEnter(); // tuning: quantas runs realmente engajam o glass-cannon
        TutorialPrompts.maybeShow(
          this.scene,
          "burnout",
          "🔥 VAI NA RAÇA: você bate +forte, ganha +VR e mata cura sanidade — mas é frágil. Ataque pra sair.",
        );
      }
    }
    this.currentBand = band;

    // Continuous stress value: 0 = full sanity, 1 = burnout
    const stress = Math.max(0, Math.min(1, (100 - sanity) / 100));

    if (this.useFilters) this.updateFilters(stress);

    // CRT scanlines — fade in starting at anxious, full at burnout.
    // Desligadas no modo de acessibilidade (padrão pisca-pisca).
    if (!this.reduce && stress > 0.6) {
      this.buildScanlines();
      const scanAlpha = Math.min(1, (stress - 0.6) / 0.4) * 0.3;
      this.scanlines.setAlpha(scanAlpha);
    } else {
      this.scanlines.setAlpha(0);
    }

    // Periodic camera shake + pixel static — pulados no modo de acessibilidade.
    if (!this.reduce && (band === "anxious" || band === "burnout")) {
      if (time >= this.nextShakeAt) {
        // Intensidade suavizada (antes 0.005/0.0022) para parecer menos "glitch".
        const intensity = band === "burnout" ? 0.0035 : 0.0016;
        const duration = band === "burnout" ? 180 : 120;
        const interval =
          band === "burnout" ? Phaser.Math.Between(350, 600) : Phaser.Math.Between(700, 1200);
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
            2,
            2,
          );
        }
      }
    } else {
      this.noise.clear();
    }

    // Fake notification popups at stressed / anxious
    if ((band === "stressed" || band === "anxious") && time >= this.nextNotifAt) {
      const interval =
        band === "anxious" ? Phaser.Math.Between(2000, 4000) : Phaser.Math.Between(5000, 9000);
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

    // burnoutT: 0→1 DENTRO da faixa burnout (stress>0.75). O Burnout deixou de ser
    // "agonia" (túnel cinza escuro) e virou "VAI NA RAÇA / adrenalina": a partir
    // daqui o vinhete ABRE (você enxerga pra brigar), a cor vira vermelho-quente
    // VIVO com pulso de batimento, e a dessaturação VOLTA (raiva é vívida).
    const burnoutT = Phaser.Math.Clamp((stress - 0.75) / 0.25, 0, 1);

    // Menos túnel que antes (0.30 vs 0.45) e ABRE de volta na raiva (−0.15·burnoutT).
    this.vignette.radius = 0.85 - stress * 0.3 + burnoutT * 0.15 + pulse;
    this.vignette.strength = stress * 0.7 - burnoutT * 0.15 + pulse * 0.5;

    // Cor: preto → vermelho-adrenalina VIVO a partir de ~60% stress. Na raiva,
    // pulso de batimento cardíaco (heartbeat) — comunica "modo fúria", não agonia.
    if (stress > 0.6) {
      const ct = (stress - 0.6) / 0.4; // 0 → 1
      const heartbeat = burnoutT > 0 ? 0.72 + 0.28 * Math.sin(this.scene.time.now * 0.009) : 1;
      const r = Math.round(ct * 0xd8 * heartbeat);
      const g = Math.round(ct * 0x18 * heartbeat);
      const b = Math.round(ct * 0x0e * heartbeat);
      this.vignette.setColor((r << 16) | (g << 8) | b);
    } else {
      this.vignette.setColor(0x000000);
    }

    // ── ColorMatrix (desaturation) ────────────────────────────────────────────
    // Sobe até o "anxious" (dread, aviso) e CAI na raiva (adrenalina é vívida,
    // não cinza-agonia). Pico ~stress 0.75, quase zerada no fundo do burnout.
    if (stress > 0.5) {
      const desat = (stress - 0.5) / 0.5; // 0 → 1
      const amt = desat * 0.6 * (1 - burnoutT * 0.85); // volta a cor na raiva
      this.colorMatrix.colorMatrix.reset().saturate(-amt);
    } else {
      this.colorMatrix.colorMatrix.reset();
    }

    // ── Barrel distortion (pincushion at anxious+) ──────────────────────────
    // Desligada no modo de acessibilidade (é o efeito que "entorta as formas").
    if (!this.reduce && stress > 0.5) {
      const t = (stress - 0.5) / 0.5; // 0 → 1 over upper half
      // Warp suave: 5% de pincushion (antes 7%). Mantém a "visão estressada"
      // sem desalinhar a mira do combate na borda.
      this.barrel.amount = 1.0 - t * 0.05; // 1.0 → 0.95
    } else {
      this.barrel.amount = 1.0;
    }

    // ── Chromatic aberration (warm→cold as stress rises) ─────────────────────
    // Pulada no modo de acessibilidade (franjas piscando nas bordas).
    if (!this.reduce && stress > 0.3) {
      const chromaAmt = ((stress - 0.3) / 0.7) * 0.05; // suavizado (antes 0.07)
      this.chromaRed.setAlpha(chromaAmt);
      this.chromaCyan.setAlpha(chromaAmt * 0.75);
    } else {
      this.chromaRed.setAlpha(0);
      this.chromaCyan.setAlpha(0);
    }
  }

  triggerChromaticHit(): void {
    this.chromaRed.setAlpha(0.14);
    this.chromaCyan.setAlpha(0.1);
    this.scene.tweens.add({ targets: [this.chromaRed, this.chromaCyan], alpha: 0, duration: 200 });
  }

  private spawnNotif() {
    const msg = pickNotif();
    const pw = 284,
      ph = 30;
    const px = GAME_WIDTH - pw - 8;
    const py = 74;

    const panel = this.scene.add.graphics().setScrollFactor(0).setDepth(950);
    panel.fillStyle(0x0a1f0a, 0.93);
    panel.fillRect(px, py, pw, ph);
    panel.lineStyle(1, 0x33aa33, 0.85);
    panel.strokeRect(px, py, pw, ph);
    panel.fillStyle(0x33aa33, 1);
    panel.fillRect(px, py, 3, ph);

    const txt = this.scene.add
      .text(px + 10, py + 9, msg, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#88ee88",
      })
      .setScrollFactor(0)
      .setDepth(951);

    this.scene.tweens.add({
      targets: [panel, txt],
      alpha: 0,
      duration: 500,
      delay: 2600,
      onComplete: () => {
        panel.destroy();
        txt.destroy();
      },
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
