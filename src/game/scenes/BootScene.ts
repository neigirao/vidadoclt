import Phaser from "phaser";
import { COLORS } from "../config";

/**
 * Generates colored-rectangle textures used as placeholders for sprites.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create() {
    this.makeRect("tex-player", 24, 36, COLORS.player, COLORS.playerAccent);
    this.makeRect("tex-estagiario", 22, 30, COLORS.estagiario);
    this.makeRect("tex-analista", 28, 38, COLORS.analista);
    this.makeRect("tex-vr", 12, 12, COLORS.vr);
    this.makeRect("tex-platform", 32, 16, COLORS.platform);
    this.makeRect("tex-floor", 32, 16, COLORS.floor);
    this.makeRect("tex-baia", 64, 40, COLORS.baia);
    this.makeRect("tex-hitbox", 28, 24, 0xffffff);

    this.scene.start("OpenSpaceScene");
  }

  private makeRect(key: string, w: number, h: number, fill: number, accent?: number) {
    const g = this.add.graphics();
    g.fillStyle(fill, 1);
    g.fillRect(0, 0, w, h);
    if (accent !== undefined) {
      // little "shirt" stripe
      g.fillStyle(accent, 1);
      g.fillRect(0, Math.floor(h * 0.45), w, Math.floor(h * 0.2));
    }
    g.lineStyle(2, 0x000000, 0.4);
    g.strokeRect(1, 1, w - 2, h - 2);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
