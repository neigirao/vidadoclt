import Phaser from "phaser";

/**
 * "Cara de chefão" — tratamento visual compartilhado que faz um sprite ler como
 * BOSS (e não inimigo comum reusando o mesmo sprite): escala maior, aura
 * pulsante colorida, sombra no chão e uma coroa 👑 flutuante (hierarquia
 * corporativa). Aplicado PELA CENA só no boss ativo — nunca no construtor da
 * entidade (Coordenador/Scrum também aparecem como trash na Fase 1).
 *
 * Não toca na hitbox física (só escala o visual + adiciona elementos decorativos).
 */
export class BossPresence {
  private aura: Phaser.GameObjects.Ellipse;
  private shadow: Phaser.GameObjects.Ellipse;
  private crown: Phaser.GameObjects.Text;
  private sprite: Phaser.Physics.Arcade.Sprite;
  private t = 0;

  constructor(
    scene: Phaser.Scene,
    sprite: Phaser.Physics.Arcade.Sprite,
    color: number,
    scale = 1.2,
  ) {
    this.sprite = sprite;
    // aumenta o porte (visual apenas — multiplica a escala já aplicada)
    sprite.setScale(sprite.scaleX * scale, sprite.scaleY * scale);
    const d = sprite.depth;
    const w = sprite.displayWidth;

    this.shadow = scene.add
      .ellipse(sprite.x, sprite.y, w * 0.9, 12, 0x000000, 0.32)
      .setDepth(d - 2);
    this.aura = scene.add
      .ellipse(sprite.x, sprite.y, w * 1.35, sprite.displayHeight * 1.15, color, 0.14)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(d - 1);
    this.crown = scene.add
      .text(sprite.x, sprite.y, "👑", { fontFamily: "monospace", fontSize: "18px" })
      .setOrigin(0.5)
      .setDepth(d + 1);
  }

  /** Reposiciona os elementos sobre o sprite (chamar no update da cena). */
  update(dt = 16) {
    const s = this.sprite;
    if (!s.active) return;
    this.t += dt;
    const pulse = 1 + Math.sin(this.t / 300) * 0.08;
    const bob = Math.sin(this.t / 400) * 3;
    const half = s.displayHeight / 2;
    this.shadow.setPosition(s.x, s.y + half - 2).setScale(pulse, 1);
    this.aura.setPosition(s.x, s.y).setScale(pulse, pulse);
    this.aura.setAlpha(0.1 + (Math.sin(this.t / 300) + 1) * 0.04);
    this.crown.setPosition(s.x, s.y - half - 12 + bob);
  }

  setVisible(v: boolean) {
    this.aura.setVisible(v);
    this.shadow.setVisible(v);
    this.crown.setVisible(v);
  }

  destroy() {
    this.aura.destroy();
    this.shadow.destroy();
    this.crown.destroy();
  }
}
