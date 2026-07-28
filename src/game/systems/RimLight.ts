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
type Pair = {
  sprite: RimSprite;
  rim: RimSprite;
  dx: number;
  dy: number;
  /** Instante (relógio da cena) em que o `pulse` acaba. 0 = sem pulso ativo. */
  pulseUntil?: number;
};

const RIM_COLOR = 0xffe6b0; // luz quente de escritório (~lâmpada)
const RIM_ALPHA = 0.4;
// Alpha do PULSO. Escolhido SIMULANDO o blend offline (mesma matemática do ADD
// que a GPU faz: cópia tingida deslocada 2px + sprite por cima, sobre o fundo
// escuro da fase) e comparando 0.40 / 0.55 / 0.70 lado a lado. Em 0.55 a troca de
// cor quase não se distingue da franja base — seria um recurso que não comunica.
// Em 0.70 o contorno lê como vermelho sem "acender" o miolo do sprite, que é o
// risco real aqui: a cópia está em BLEND_ADD, então alpha demais deixa de
// destacar a borda e passa a lavar o personagem inteiro.
const PULSE_ALPHA = 0.7;

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

  /**
   * PULSO de contorno: troca a cor do rim de um personagem por um instante.
   *
   * Por que isto vale: o contorno já separa o personagem do fundo, mas com cor
   * FIXA ele só informa "existe alguém aqui". Pulsando na cor da ameaça durante
   * o windup, a mesma luz passa a contar a MECÂNICA — dá pra ler que o inimigo
   * vai atacar sem depender do "!!", que pode estar encoberto por cenário, por
   * outro inimigo ou simplesmente fora do enquadramento quando a câmera aperta.
   * É um terceiro canal da mesma informação (cor do aviso + forma do glyph +
   * contorno), o que também ajuda quem joga com o modo daltônico: o chamador
   * passa a cor JÁ remapeada, então os três canais nunca se contradizem.
   *
   * Restaura sozinho. Chamadas repetidas no mesmo sprite reiniciam o pulso em vez
   * de empilhar (o windup roda a cada frame enquanto o estado dura).
   */
  pulse(sprite: RimSprite, color: number, ms = 260, alpha = PULSE_ALPHA) {
    const par = this.pairs.find((p) => p.sprite === sprite);
    if (!par) return;
    par.rim.setTint(color).setAlpha(alpha);
    // A volta à cor base é resolvida no `update()`, por PRAZO, e não por
    // `time.delayedCall`. Motivo: o update já roda todo frame (é ele que faz o
    // contorno seguir o sprite), então o prazo é garantido pelo mesmo laço que
    // mantém o efeito vivo — sem um timer por pulso para criar, cancelar e
    // limpar no shutdown. Um pulso novo simplesmente reescreve o prazo, o que é
    // o comportamento certo: o windup chama isto enquanto o estado durar.
    par.pulseUntil = this.scene.time.now + ms;
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
      // Fim do pulso → volta à cor base.
      if (p.pulseUntil && this.scene.time.now >= p.pulseUntil) {
        p.pulseUntil = undefined;
        p.rim.setTint(RIM_COLOR).setAlpha(RIM_ALPHA);
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
