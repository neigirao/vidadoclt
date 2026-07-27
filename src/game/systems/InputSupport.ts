// ─────────────────────────────────────────────────────────────────────────────
// SUPORTE DE ENTRADA — o jogo é 100% teclado (movimento, 7 verbos de combate,
// interagir). NÃO há controles de toque. Num celular a página abre, o menu até
// responde ao toque (os botões de menu são interativos), mas a FASE não anda —
// o jogador fica olhando um personagem parado sem entender o que houve.
//
// Este módulo não conserta isso; ele torna a limitação HONESTA, avisando antes
// de o jogador perder tempo. Controles virtuais de verdade (D-pad + 7 botões,
// com layout que não cubra a ação) são um projeto à parte.
//
// Núcleo PURO (sem Phaser, sem window) p/ ser testável: quem decide recebe as
// capacidades já lidas do ambiente.
// ─────────────────────────────────────────────────────────────────────────────

export type PointerCapabilities = {
  /** `matchMedia("(pointer: coarse)")` — apontador impreciso (dedo). */
  coarsePointer: boolean;
  /** `matchMedia("(hover: hover)")` — o dispositivo consegue "passar por cima". */
  canHover: boolean;
  /** `navigator.maxTouchPoints > 0`. */
  hasTouch: boolean;
};

/**
 * Decide se o dispositivo é de TOQUE COMO ENTRADA PRINCIPAL — ou seja, se muito
 * provavelmente não há teclado.
 *
 * Não basta `hasTouch`: notebooks com tela sensível ao toque têm toque E
 * teclado, e avisá-los seria ruído. O sinal que separa é o apontador grosso sem
 * hover — celular/tablet. Um tablet com teclado acoplado reporta hover e fica
 * de fora, que é o comportamento desejado.
 */
export function isTouchPrimary(caps: PointerCapabilities): boolean {
  if (!caps.hasTouch) return false;
  return caps.coarsePointer && !caps.canHover;
}

/** Lê as capacidades do navegador. Retorna "sem toque" fora do browser (SSR). */
export function readPointerCapabilities(): PointerCapabilities {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return { coarsePointer: false, canHover: true, hasTouch: false };
  }
  return {
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    canHover: window.matchMedia("(hover: hover)").matches,
    hasTouch: (navigator?.maxTouchPoints ?? 0) > 0,
  };
}

/** Atalho: o dispositivo atual precisa do aviso de "requer teclado"? */
export function needsKeyboardWarning(): boolean {
  return isTouchPrimary(readPointerCapabilities());
}
