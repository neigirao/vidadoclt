import type Phaser from "phaser";

// ─────────────────────────────────────────────────────────────────────────────
// JUICE — fonte ÚNICA e TUNÁVEL do "game feel" (squash & stretch, hit-stop, shake,
// flash). Antes esses números viviam espalhados como magic numbers dentro de
// CombatFx (55ms aqui, 0.012 ali) — impossível de afinar coeso. Aqui ficam num só
// lugar, nomeados, pra o feel ser uma decisão (como Dead Cells/Hades tunam) e pra
// o `bun juice:profile` medir contra o alvo.
//
// PURO o suficiente p/ testar: a tabela JUICE não importa Phaser; só o helper
// `squash()` toca em tweens. CombatFx delega a estes valores (sem mudar o feel);
// o hit-squash é novo (recuo ao tomar dano).
// ─────────────────────────────────────────────────────────────────────────────

export type SquashSpec = {
  /** Escala horizontal no pico (1 = neutro; >1 = alarga). */
  sx: number;
  /** Escala vertical no pico (1 = neutro; <1 = achata). */
  sy: number;
  /** Duração de ida (ms); o yoyo dobra o total. */
  ms: number;
  /** Ease do Phaser (string). */
  ease: string;
};

export type ShakeSpec = { ms: number; amp: number };

/** Tabela canônica de juice — AJUSTE AQUI pra mudar o feel do jogo inteiro. */
export const JUICE = {
  squash: {
    // Aterrissagem: alarga e achata (impacto no chão), mola de volta.
    land: { sx: 1.15, sy: 0.85, ms: 55, ease: "Bounce.easeOut" } as SquashSpec,
    // Pulo: estica e afina na subida.
    jump: { sx: 0.75, sy: 1.25, ms: 80, ease: "Quad.easeOut" } as SquashSpec,
    // Tomar dano: recuo rápido (achata levemente) — NOVO, dá peso ao hit.
    hit: { sx: 1.18, sy: 0.82, ms: 45, ease: "Quad.easeOut" } as SquashSpec,
  },
  hitStop: {
    light: 85, // hit comum
    finisher: 110, // finalizador de combo
  },
  shake: {
    light: { ms: 80, amp: 0.005 } as ShakeSpec,
    heavy: { ms: 180, amp: 0.012 } as ShakeSpec,
    finisher: { ms: 140, amp: 0.009 } as ShakeSpec,
    death: { ms: 300, amp: 0.015 } as ShakeSpec,
    parry: { ms: 60, amp: 0.01 } as ShakeSpec,
  },
} as const;

/**
 * Aplica um squash & stretch (tween de escala com yoyo) num sprite. Base do
 * land/jump/hit — reusável por qualquer entidade que queira o mesmo feel.
 * Respeita a escala base atual do sprite (multiplica), então não quebra
 * personagens que já rodam em escala != 1.
 */
export function squash(
  sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
  spec: SquashSpec,
): void {
  // BUG histórico: o baseX/baseY vinha de `sprite.scaleX/scaleY` (interpolado se
  // um tween anterior ainda estava rodando) → chamadas empilhadas MULTIPLICAVAM
  // a escala (baseY drift → scaleY → 0). Sintoma: player "vira uma linha" ao
  // entrar na fase quando landSquash disparava vários frames seguidos (jitter
  // de blocked.down sobre móveis, ou land+jump em rajada). Fix:
  //  (a) cachear a escala ORIGINAL em data no 1º uso (não muda mais);
  //  (b) matar qualquer tween de escala em andamento antes de começar novo;
  //  (c) resetar pra escala original antes de tweenar → sempre parte do 0.
  const s = sprite as Phaser.GameObjects.Sprite & { getData(k: string): number | undefined };
  let baseX = s.getData("juice:baseX");
  let baseY = s.getData("juice:baseY");
  if (baseX === undefined || baseY === undefined) {
    baseX = sprite.scaleX;
    baseY = sprite.scaleY;
    sprite.setData("juice:baseX", baseX);
    sprite.setData("juice:baseY", baseY);
  }
  sprite.scene.tweens.killTweensOf(sprite);
  sprite.setScale(baseX, baseY);
  const originX = baseX;
  const originY = baseY;
  sprite.scene.tweens.add({
    targets: sprite,
    scaleX: originX * spec.sx,
    scaleY: originY * spec.sy,
    duration: spec.ms,
    yoyo: true,
    ease: spec.ease,
    onComplete: () => sprite.setScale(originX, originY),
  });
}
