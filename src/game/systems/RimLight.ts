import Phaser from "phaser";
import { loadSettings } from "./Settings";

/**
 * Rim-light (luz de contorno): um realce quente na borda de cada personagem para
 * SEPARÁ-LO do fundo. Sem isso os sprites "grudam" no cenário escuro das fases.
 *
 * Esta build do Phaser NÃO tem `sprite.preFX/postFX` (ver docs/LIGHTING_SPIKE.md),
 * então não dá pra usar o Glow FX por-sprite. A técnica clássica de pixel-art sem
 * shader: uma CÓPIA do sprite (mesma textura/frame), tingida de claro, em BLEND_ADD,
 * atrás do original e deslocada 2px na direção da luz (cima-trás). O original cobre
 * o miolo; sobra só a franja acesa na borda iluminada. É o "selout" clássico.
 *
 * Segue o padrão de follow (ContactShadows/ThreatMarkers): lista de pares repovoada
 * no update da cena, sincronizando frame/flip/escala a cada tick. Desligado sob
 * `reduceSanityFx` (acessibilidade/perf — é 1 sprite extra por personagem).
 */
type RimSprite = Phaser.GameObjects.Sprite;
type Pair = { sprite: RimSprite; rim: RimSprite; dx: number; dy: number };

const RIM_COLOR = 0xffe6b0; // luz quente de escritório (~lâmpada)
const RIM_ALPHA = 0.4;

export class RimLight {
  private pairs: Pair[] = [];
  private enabled: boolean;

  constructor(private scene: Phaser.Scene) {
    this.enabled = !loadSettings().reduceSanityFx;
  }

  /** Adiciona rim-light sob `sprite`. `dx,dy` = direção do deslocamento (luz vindo
   *  de cima-esquerda por padrão → franja acesa em cima/esquerda). */
  add(sprite: RimSprite, dx = -2, dy = -2) {
    if (!this.enabled || !sprite.texture) return;
    const rim = this.scene.add
      .sprite(sprite.x + dx, sprite.y + dy, sprite.texture.key, sprite.frame?.name)
      .setTint(RIM_COLOR)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(RIM_ALPHA)
      .setDepth((sprite.depth ?? 0) - 1);
    this.pairs.push({ sprite, rim, dx, dy });
  }

  /** Sincroniza os contornos com os sprites (chamar no update da cena). */
  update() {
    if (!this.pairs.length) return;
    this.pairs = this.pairs.filter((p) => {
      const s = p.sprite;
      if (!s.active) {
        p.rim.destroy();
        return false;
      }
      p.rim
        .setFrame(s.frame.name)
        .setPosition(s.x + p.dx, s.y + p.dy)
        .setFlipX(s.flipX)
        .setFlipY(s.flipY)
        .setScale(s.scaleX, s.scaleY)
        .setOrigin(s.originX, s.originY)
        .setRotation(s.rotation)
        .setVisible(s.visible);
      return true;
    });
  }

  destroy() {
    for (const p of this.pairs) p.rim.destroy();
    this.pairs = [];
  }
}
