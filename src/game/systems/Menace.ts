// ─────────────────────────────────────────────────────────────────────────────
// "Ameaça" (menace) — dificuldade acumulada de loop + Heat + New Game+.
// Aprendizado de design #3: escalada deve adicionar MECÂNICA, não só HP. Em vez
// de deixar o boss só mais gordo, a ameaça ANTECIPA o momento de enrage: quanto
// maior a dificuldade, mais cedo (e por mais tempo) rodam as assinaturas do 2º
// terço da luta (balões extras / firewalls / Cascata do Diretor). Puro/testável.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_ENRAGE = 0.35; // % de HP em que o boss enraivece na dificuldade normal
const MAX_ENRAGE = 0.6; // teto p/ não enraivecer instantaneamente

/**
 * Fração de HP do boss em que o enrage dispara, elevada pela ameaça:
 *  - loop: +0,05 por loop completado (até +0,15)
 *  - New Game+: +0,10
 *  - Heat: +0,02 por nível (0–5, até +0,10)
 * Somado à base 0,35 e capado em 0,60 (enraivece com ≤60% de HP no pico).
 */
export function menaceEnrageThreshold(
  loopCount: number,
  ngPlus: boolean,
  heatLevel: number,
): number {
  const loop = Math.min(Math.max(loopCount, 0), 3) * 0.05;
  const ng = ngPlus ? 0.1 : 0;
  const heat = Math.min(Math.max(heatLevel, 0), 5) * 0.02;
  return Math.min(MAX_ENRAGE, BASE_ENRAGE + loop + ng + heat);
}
