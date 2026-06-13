import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { sanityBand } from "./PlayerState";

const NOTIFS = [
  "[Teams] Re: RE: Fw: alinhamento estrategico",
  "[Outlook] URGENTE: action needed ate 18h",
  "[Slack] @here reuniao em 5 minutos",
  "[Teams] Voce tem 12 mensagens nao lidas",
  "[Outlook] Prazo antecipado. Favor confirmar.",
  "[Slack] Pode me dar 5 min? Eh rapido",
  "[Calendario] Lembrete: 1:1 com gestor - AGORA",
  "[Teams] Voce viu o meu e-mail de ontem?",
  "[Outlook] RE: RE: RE: Urgente: ver isso",
  "[Jira] 47 tickets atribuidos a voce",
  "[Teams] Vc esta disponivel? E importante",
  "[Outlook] FW: FW: Nova diretriz aprovada",
];

export class SanityFx {
  private vignette: Phaser.GameObjects.Graphics;
  private noise: Phaser.GameObjects.Graphics;
  private currentBand: ReturnType<typeof sanityBand> = "ok";
  private nextNoiseAt = 0;
  private nextNotifAt = 0;
  private nextShakeAt = 0;  // periodic camera shake (replaces per-frame scroll jitter)

  constructor(private scene: Phaser.Scene) {
    this.vignette = scene.add.graphics().setScrollFactor(0).setDepth(900);
    this.noise = scene.add.graphics().setScrollFactor(0).setDepth(901);
    this.redraw("ok");
  }

  update(time: number, sanity: number) {
    const band = sanityBand(sanity);
    if (band !== this.currentBand) {
      this.currentBand = band;
      this.redraw(band);
    }

    // Periodic camera shake + pixel noise for anxious/burnout.
    // Previously used per-frame cam.setScroll() which caused constant pixel-level
    // jitter (everything appeared to flicker at 60fps). Now uses cameras.main.shake()
    // at intervals so the shake is intentional and readable, not a visual glitch.
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

    // Fake notification popups at stressed + anxious
    if ((band === "stressed" || band === "anxious") && time >= this.nextNotifAt) {
      const interval = band === "anxious"
        ? Phaser.Math.Between(2000, 4000)
        : Phaser.Math.Between(5000, 9000);
      this.nextNotifAt = time + interval;
      this.spawnNotif();
    }
  }

  private spawnNotif() {
    const msg = Phaser.Utils.Array.GetRandom(NOTIFS) as string;
    const pw = 284, ph = 30;
    const px = GAME_WIDTH - pw - 8;
    const py = 74;

    const panel = this.scene.add.graphics().setScrollFactor(0).setDepth(950);
    panel.fillStyle(0x0a1f0a, 0.93);
    panel.fillRect(px, py, pw, ph);
    panel.lineStyle(1, 0x33aa33, 0.85);
    panel.strokeRect(px, py, pw, ph);
    // accent strip on left
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

  private redraw(band: ReturnType<typeof sanityBand>) {
    this.vignette.clear();
    const alpha = band === "ok" ? 0 : band === "stressed" ? 0.14 : band === "anxious" ? 0.34 : 0.56;
    if (alpha === 0) return;
    const color = band === "burnout" ? 0x6b0a0a : 0x000000;
    for (let i = 0; i < 6; i++) {
      const inset = 30 + i * 16;
      this.vignette.fillStyle(color, alpha * 0.18);
      this.vignette.fillRect(0, 0, GAME_WIDTH, inset);
      this.vignette.fillRect(0, GAME_HEIGHT - inset, GAME_WIDTH, inset);
      this.vignette.fillRect(0, 0, inset, GAME_HEIGHT);
      this.vignette.fillRect(GAME_WIDTH - inset, 0, inset, GAME_HEIGHT);
    }
  }

  destroy() {
    this.vignette.destroy();
    this.noise.destroy();
  }
}
