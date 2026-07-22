import Phaser from "phaser";

/**
 * Sombras de contato (contact shadows): uma elipse suave e escura sob CADA
 * personagem (player + inimigos), fixada ao CHÃO. Ela ancora o sprite no
 * cenário — sem ela os personagens parecem "flutuar/deslizar". Ao pular, a
 * sombra fica no chão e ENCOLHE/desbota conforme o sprite sobe (leitura de
 * altura), voltando ao normal ao aterrissar.
 *
 * Segue o padrão de "follow" do jogo (ThreatMarkers/EliteSystem): uma lista de
 * pares {sprite, sombra}, repovoada no `update()` da cena, que reposiciona e
 * descarta sombras de sprites mortos. A sombra fica ABAIXO do sprite (depth-1).
 *
 * Desligada sob `reduceSanityFx`? NÃO — sombra de contato não é FX de sanidade
 * (não pisca/distorce); é leitura espacial base. Fica sempre ligada.
 */
type Bodyish = { blocked?: { down: boolean }; touching?: { down: boolean } };
type ShadowSprite = Phaser.GameObjects.Sprite & { body?: Bodyish | null };

type Pair = {
  sprite: ShadowSprite;
  shadow: Phaser.GameObjects.Ellipse;
  groundY: number; // último Y do chão sob o sprite (feet quando apoiado)
  baseW: number; // largura da sombra apoiada
};

// Altura (px) acima do chão em que a sombra chega ao encolhimento máximo.
const MAX_AIR = 260;
// Escala/alpha mínimos no ápice do pulo (nunca some de todo — mantém a âncora).
const MIN_SCALE = 0.45;
const MIN_ALPHA = 0.12;
const BASE_ALPHA = 0.34;

export class ContactShadows {
  private pairs: Pair[] = [];

  constructor(private scene: Phaser.Scene) {}

  /** Adiciona uma sombra sob `sprite`. `widthMult` afina a elipse por porte. */
  add(sprite: ShadowSprite, widthMult = 0.62) {
    const baseW = Math.max(10, sprite.displayWidth * widthMult);
    const feetY = sprite.y + sprite.displayHeight / 2;
    const shadow = this.scene.add
      .ellipse(sprite.x, feetY, baseW, baseW * 0.32, 0x000000, BASE_ALPHA)
      .setDepth((sprite.depth ?? 0) - 1);
    this.pairs.push({ sprite, shadow, groundY: feetY, baseW });
  }

  /** Reposiciona/escala as sombras (chamar no update da cena). */
  update() {
    if (!this.pairs.length) return;
    this.pairs = this.pairs.filter((p) => {
      const s = p.sprite;
      if (!s.active) {
        p.shadow.destroy();
        return false;
      }
      const feetY = s.y + s.displayHeight / 2;
      const grounded = !!s.body?.blocked?.down || !!s.body?.touching?.down;
      // Ao apoiar, "gruda" o chão sob o sprite; no ar mantém o último chão.
      if (grounded) p.groundY = feetY;
      const air = Math.max(0, p.groundY - feetY);
      const t = Math.min(1, air / MAX_AIR);
      const scale = 1 - (1 - MIN_SCALE) * t;
      p.shadow
        .setPosition(s.x, p.groundY)
        .setScale(scale, scale)
        .setAlpha(BASE_ALPHA - (BASE_ALPHA - MIN_ALPHA) * t);
      return true;
    });
  }

  destroy() {
    for (const p of this.pairs) p.shadow.destroy();
    this.pairs = [];
  }
}
