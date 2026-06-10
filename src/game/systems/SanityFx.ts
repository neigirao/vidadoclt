import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { sanityBand } from "./PlayerState";

/**
 * Vignette + camera jitter overlay driven by sanity bands.
 */
export class SanityFx {
  private vignette: Phaser.GameObjects.Graphics;
  private noise: Phaser.GameObjects.Graphics;
  private currentBand: ReturnType<typeof sanityBand> = "ok";
  private nextNoiseAt = 0;

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

    // Camera jitter / phantom noise
    if (band === "anxious" || band === "burnout") {
      const cam = this.scene.cameras.main;
      const j = band === "burnout" ? 1.2 : 0.5;
      cam.setScroll(cam.scrollX + Phaser.Math.FloatBetween(-j, j), cam.scrollY + Phaser.Math.FloatBetween(-j, j));

      if (time >= this.nextNoiseAt) {
        this.nextNoiseAt = time + Phaser.Math.Between(80, 180);
        this.noise.clear();
        const dots = band === "burnout" ? 80 : 30;
        this.noise.fillStyle(0xffffff, 0.06);
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
  }

  private redraw(band: ReturnType<typeof sanityBand>) {
    this.vignette.clear();
    const alpha = band === "ok" ? 0 : band === "stressed" ? 0.18 : band === "anxious" ? 0.36 : 0.58;
    if (alpha === 0) return;
    const color = band === "burnout" ? 0x6b0a0a : 0x000000;
    // Layered radial-ish vignette using stacked rectangles with growing transparency.
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
