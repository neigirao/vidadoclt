import Phaser from "phaser";

/**
 * Marcadores de leitura de ameaça (aprendizado do Lovable): um ícone flutuante
 * PERSISTENTE por arquétipo acima do inimigo, para o jogador ler a ameaça de
 * relance em qualquer fase. Antes só healers tinham sinal (anel durante o buff).
 *
 *  - ranged (!)  amarelo  → atira à distância
 *  - elite (♦)   vermelho → tanky / perigoso corpo-a-corpo
 *  - healer (+)  verde    → cura/reforça aliados
 *
 * Rushers básicos ficam SEM marcador de propósito (menos ruído; a ameaça óbvia).
 */
export type ThreatType = "ranged" | "elite" | "healer";

const ICONS: Record<ThreatType, { char: string; color: string }> = {
  ranged: { char: "!", color: "#ffcc33" },
  elite: { char: "♦", color: "#ff5544" },
  healer: { char: "+", color: "#44dd88" },
};

export class ThreatMarkers {
  private pairs: { enemy: Phaser.GameObjects.Sprite; mark: Phaser.GameObjects.Text }[] = [];

  constructor(private scene: Phaser.Scene) {}

  add(enemy: Phaser.GameObjects.Sprite, type: ThreatType) {
    const cfg = ICONS[type];
    if (!cfg) return;
    const mark = this.scene.add
      .text(enemy.x, enemy.y, cfg.char, {
        fontFamily: "monospace",
        fontSize: "13px",
        fontStyle: "bold",
        color: cfg.color,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(50);
    // leve pulsar p/ chamar atenção sem virar ruído
    this.scene.tweens.add({
      targets: mark,
      alpha: 0.55,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.pairs.push({ enemy, mark });
  }

  /** Reposiciona os marcadores sobre os inimigos (chamar no update da cena). */
  update() {
    if (!this.pairs.length) return;
    this.pairs = this.pairs.filter((p) => {
      if (!p.enemy.active) {
        p.mark.destroy();
        return false;
      }
      p.mark.setPosition(p.enemy.x, p.enemy.y - p.enemy.displayHeight / 2 - 8);
      return true;
    });
  }
}
