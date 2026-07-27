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
  // a escala (drift → scaleY → 0). Sintoma: player "vira uma linha" quando
  // landSquash/jumpStretch disparavam em rajada (jitter de blocked.down sobre
  // móveis, land+jump encadeados). Fix: cachear a escala ORIGINAL em data,
  // matar SÓ o tween anterior de squash (não outros tweens do sprite), e sempre
  // partir do valor original.
  const s = sprite as Phaser.GameObjects.Sprite & {
    getData(k: string): number | Phaser.Tweens.Tween | undefined;
  };
  let baseX = s.getData("juice:baseX") as number | undefined;
  let baseY = s.getData("juice:baseY") as number | undefined;
  if (baseX === undefined || baseY === undefined) {
    baseX = sprite.scaleX;
    baseY = sprite.scaleY;
    sprite.setData("juice:baseX", baseX);
    sprite.setData("juice:baseY", baseY);
  }
  const prev = s.getData("juice:squashTween") as Phaser.Tweens.Tween | undefined;
  if (prev && prev.isPlaying()) prev.stop();
  sprite.setScale(baseX, baseY);
  const originX = baseX;
  const originY = baseY;

  // No Arcade o CORPO escala junto com o sprite. Sem compensar, o squash deixa
  // de ser visual e vira FÍSICA: ao achatar (scaleY 0.8 → 0.68) a caixa encolhe
  // ancorada no TOPO e o PÉ sobe ~4px, tirando o personagem do chão. Isso
  // realimenta (sai do chão → cai → aterrissa → landSquash → sai de novo) e o
  // corpo vai afundando no piso a cada ciclo até vazar pela faixa de 32px: o
  // player atravessava o cenário e ia parar no limite inferior do mundo, sob o
  // HUD, sem alcançar mais nenhum interativo — na Copa isso TRANCAVA a run
  // (impossível bater o ponto). Medido andando 9s na Copa: 42–57 saídas do chão
  // e queda em 4 de 4 corridas; travando o scaleY, 0 e 0.
  //
  // A compensação abaixo mantém a caixa do corpo com o MESMO tamanho e a MESMA
  // linha do pé em coordenadas de mundo, em qualquer escala — o squash volta a
  // ser 100% visual. Roda no onUpdate do tween (o único instante em que a escala
  // muda), e não a cada frame: reescrever size/offset todo frame briga com a
  // separação do Arcade e afunda o corpo de outro jeito.
  const body = (sprite as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body | null;
  const pin = body
    ? {
        // Geometria autoral, em px de mundo, na escala base.
        w: body.sourceWidth * Math.abs(originX),
        h: body.sourceHeight * originY,
        ox: body.offset.x,
        oy: body.offset.y,
        srcW: body.sourceWidth,
        srcH: body.sourceHeight,
        // Origem do sprite em px do frame (o Arcade multiplica isto pela escala).
        origX: sprite.displayOriginX,
        origY: sprite.displayOriginY,
        // Pé (base do corpo) relativo ao y do sprite, na escala base.
        foot: originY * (body.offset.y - sprite.displayOriginY + body.sourceHeight),
      }
    : null;
  const repin = () => {
    if (!pin || !body) return;
    const sx = Math.abs(sprite.scaleX) || 1;
    const sy = sprite.scaleY || 1;
    const w = pin.w / sx;
    const h = pin.h / sy;
    body.setSize(w, h, false);
    body.setOffset(pin.origX - w / 2, pin.origY + (pin.foot - pin.h) / sy);
  };
  const unpin = () => {
    if (!pin || !body) return;
    body.setSize(pin.srcW, pin.srcH, false);
    body.setOffset(pin.ox, pin.oy);
  };

  const tw = sprite.scene.tweens.add({
    targets: sprite,
    scaleX: originX * spec.sx,
    scaleY: originY * spec.sy,
    duration: spec.ms,
    yoyo: true,
    ease: spec.ease,
    onUpdate: repin,
    onStop: () => {
      sprite.setScale(originX, originY);
      unpin();
    },
    onComplete: () => {
      sprite.setScale(originX, originY);
      unpin();
    },
  });
  sprite.setData("juice:squashTween", tw);
}
