import Phaser from "phaser";
import { COLORS } from "../constants";

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
    this.makeRect("tex-faxineiro", 32, 44, COLORS.faxineiro, 0xeeeeee);
    this.makeRect("tex-door", 36, 60, COLORS.door, 0xc9a36a);
    this.makeRect("tex-coffee", 28, 40, 0x6a4a3a, 0xeac08a);
    this.makeRect("tex-ponto", 28, 40, COLORS.ponto, 0x222222);
    // novos inimigos
    this.makeRect("tex-facilitador", 24, 36, 0x3a6a2a, 0xfff066); // verde com post-it amarelo
    this.makeRect("tex-scrum",       26, 34, 0x6a2a4a, 0xff8800); // roxo com laranja
    this.makeRect("tex-coordenador", 28, 40, 0x1a4a6a, 0x44ff88); // azul com verde neón
    this.makeRect("tex-senior",      32, 46, 0x3a3a3a, 0x884444); // cinza escuro com vermelho
    this.makeRect("tex-postit",      14, 14, 0xffee22, 0xffaa00); // post-it amarelo

    this.scene.start("MenuScene");
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
