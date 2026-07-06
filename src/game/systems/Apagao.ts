import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";

/**
 * Evento APAGÃO (Fase 1): escuridão com "lanterna" ao redor do player.
 * Máscaras de geometria são Canvas-only no Phaser 4 (o jogo roda WebGL), então
 * a lanterna é uma textura 2x maior que a tela, escura com um furo radial no
 * centro (recorte via destination-out), recentralizada no player a cada frame.
 * Extraído da OpenSpaceV2Scene para isolar a mecânica.
 */
export class Apagao {
  private dark?: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene) {}

  get active(): boolean {
    return !!this.dark;
  }

  enable(): void {
    const key = "apagao-tex";
    if (!this.scene.textures.exists(key)) {
      const tw = GAME_WIDTH * 2,
        th = GAME_HEIGHT * 2;
      const cnv = this.scene.textures.createCanvas(key, tw, th);
      if (!cnv) return;
      const ctx = cnv.getContext();
      ctx.fillStyle = "rgba(4,6,11,0.92)";
      ctx.fillRect(0, 0, tw, th);
      const R = 170;
      const grad = ctx.createRadialGradient(tw / 2, th / 2, R * 0.35, tw / 2, th / 2, R);
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(tw / 2, th / 2, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      cnv.refresh();
    }
    this.dark = this.scene.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key)
      .setScrollFactor(0)
      .setDepth(950);
  }

  /** Recentraliza o furo da escuridão no player (coords de tela). */
  reposition(worldX: number, worldY: number): void {
    if (!this.dark) return;
    const cam = this.scene.cameras.main;
    this.dark.setPosition(worldX - cam.scrollX, worldY - cam.scrollY);
  }

  /** Acende as luzes (ex.: quando o boss ativa). */
  disable(): void {
    this.dark?.destroy();
    this.dark = undefined;
  }
}
