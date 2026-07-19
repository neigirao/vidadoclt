// ─────────────────────────────────────────────────────────────────────────────
// FONTE ÚNICA da config de animação por inimigo (contagem de frames + ms por
// estado). Consumida por `Enemies.ts` (setEnemyTex, o que o jogo REALMENTE cicla)
// e pelo `SpriteLabScene` (que cruza contra os frames disponíveis e AVISA quando
// diverge). Antes cada um tinha a sua definição → dava pra o LAB dizer "OK"
// enquanto o jogo ciclava outra contagem (aconteceu com o sênior 16 e os bosses
// recolor). Um lugar só evita a mentira.
//
// Convenção: chave = prefixo de textura (`enemy-<prefixo>-<estado>N`). Prefixo
// ausente num record → default do consumidor (walk 2, idle 4, attack 1).
// ─────────────────────────────────────────────────────────────────────────────

// Só conta frames de walk com canvas consistente (48×64). Os 64×64 extraídos a
// mais tinham o personagem em escala errada e faziam o sprite "encolher".
// DOBRADOS com in-betweens sintéticos (gen-inbetweens.mjs): cada família teve o
// walk interpolado 2× (ex.: senior 16→32). Contagens hardcoded aqui (não via
// AtlasFrameScan) p/ o cycling não depender da varredura de pixels em runtime.
export const WALK_FRAME_COUNTS: Record<string, number> = {
  // 5 inimigos da Fase 1: arte real da s7 (4 frames) dobrada p/ 16 via
  // gen-inbetweens (16 frames/ação — alvo do projeto). WALK_MS ajustado p/ manter
  // a duração do ciclo.
  estagiario: 16,
  analista: 16,
  facilitador: 16,
  scrum: 16,
  coordenador: 16,
  senior: 32,
  rh: 16,
  // Bosses recolor (asBoss)
  "scrum-boss": 24,
  "coord-boss": 16,
};

export const IDLE_FRAME_COUNTS: Record<string, number> = {
  // 5 inimigos da Fase 1: idle real da s7 (4 frames) dobrado 2× p/ 16 (alvo do
  // projeto). IDLE_MS ajustado p/ manter a cadência calma de respiração.
  estagiario: 16,
  analista: 16,
  facilitador: 16,
  scrum: 16,
  coordenador: 16,
  // senior/rh e os bosses-recolor levados a 16 (idle dobrado via gen-inbetweens).
  senior: 16,
  rh: 16,
  "scrum-boss": 16,
  "coord-boss": 16,
};

// Ataque animado: whitelist dos frames de arte VALIDADA (48×64). Outliers 32×48 /
// lixo de extração ficam de fora. Prefixo ausente → 1 (frame 0 estático).
// senior/rh subidos a 4: a leva de frames do Lovable ("auditou frames faltantes")
// completou ciclos COERENTES aqui (conferido no strip). As demais famílias NÃO
// foram subidas: os attack2/3 gerados por IA são um personagem DIFERENTE da base
// (musculoso/chicote/ícone de som) — ciclar quebraria a leitura.
export const ATTACK_FRAME_COUNTS: Record<string, number> = {
  senior: 4,
  rh: 4,
  // Attack RE-CORTADO da s7 (poses limpas do personagem, sem o FX que fica à
  // direita — o jogo já spawna o próprio projétil). estagiário/scrum ficaram de
  // fora: as poses de attack deles têm papéis/balão "SINERGIA!" grudados e pedem
  // arte à mão; seguem em frame 0 estático.
  facilitador: 5,
  analista: 5,
  coordenador: 5,
  // Bosses recolor: os 3 frames de attack são 48×64 limpos (recolor regenerou).
  "scrum-boss": 3,
  "coord-boss": 3,
};

// Duração de frame (ms) por estado — afinada à "energia" de cada inimigo.
// ms POR FRAME halvado (era o dobro): os ciclos de walk foram DOBRADOS com
// in-betweens sintéticos (gen-inbetweens.mjs). Metade do ms por frame mantém a
// MESMA duração de ciclo de antes — só mais suave. (ex.: senior 32×35 ≈ 16×70.)
export const WALK_MS: Record<string, number> = {
  estagiario: 55, // 16 × 55 ≈ 880ms/ciclo
  analista: 65, // 16 × 65 ≈ 1040ms
  facilitador: 55,
  scrum: 68, // 16 × 68 ≈ 1090ms
  coordenador: 70, // 16 × 70 ≈ 1120ms
  senior: 35, // 32 × 35 ≈ 1.1s
  rh: 65,
};

export const IDLE_MS: Record<string, number> = {
  // 5 inimigos da Fase 1: idle 16 frames → ms baixo mantém a respiração calma.
  estagiario: 70, // 16 × 70 ≈ 1.1s/ciclo
  analista: 80,
  facilitador: 75,
  scrum: 65,
  coordenador: 88,
  // senior/rh/bosses-recolor: idle 16 frames → ms baixo mantém a respiração calma.
  senior: 125,
  rh: 80,
  "scrum-boss": 90,
  "coord-boss": 90,
};

export const ATTACK_MS: Record<string, number> = {
  senior: 120,
  rh: 110,
  facilitador: 100,
  analista: 110,
  coordenador: 130,
};

// Defaults do consumidor (o que o jogo usa quando o prefixo não está no record).
export const DEFAULT_WALK_FRAMES = 2;
export const DEFAULT_IDLE_FRAMES = 4;
export const DEFAULT_ATTACK_FRAMES = 1;
export const DEFAULT_WALK_MS = 90; // halvado (walk dobrado com in-betweens)
export const DEFAULT_IDLE_MS = 300;
export const DEFAULT_ATTACK_MS = 110;

export type AnimState = "walk" | "idle" | "attack";

// ── Aumentos de contagem por overrides de RUNTIME (multi-frame do LAB) ───────
// As contagens acima são `const` (arte validada empacotada no atlas). Mas o LAB
// permite ADICIONAR frames novos por IA que persistem como override em runtime
// (Supabase Storage/IndexedDB), sem reempacotar o atlas. `SpriteOverrides`
// registra aqui, ao carregar/subir, quantos frames o override implica para um
// prefixo+estado (índice do frame extra + 1). Os acessores abaixo devolvem
// max(base, registrado), então `setEnemyTex` e o LAB passam a ciclar os extras.
const _additions: Record<AnimState, Record<string, number>> = {
  walk: {},
  idle: {},
  attack: {},
};

/** Registra que um override adiciona frames a `prefix`/`state` (conta = maior
 *  índice de frame + 1). Idempotente: mantém o maior já visto. */
export function registerFrameAddition(state: AnimState, prefix: string, count: number): void {
  const reg = _additions[state];
  if (!reg[prefix] || count > reg[prefix]) reg[prefix] = count;
}

/** Limpa os aumentos registrados (usado em testes). */
export function resetFrameAdditions(): void {
  _additions.walk = {};
  _additions.idle = {};
  _additions.attack = {};
}

/** Só o aumento REGISTRADO por override (0 se nenhum). Usado por consumidores que
 *  têm a base própria (ex.: animPhase das Fases 2–5 passa a contagem hardcoded). */
export function runtimeFrameAddition(state: AnimState, prefix: string): number {
  return _additions[state][prefix] ?? 0;
}

/** true se o prefixo tem config de animação por `setEnemyTex` (Fase 1 + recolor
 *  bosses). O LAB usa p/ liberar o COMPLETAR FAMÍLIA só onde os frames de fato
 *  ciclam. */
export function hasAnimConfig(prefix: string): boolean {
  return (
    prefix in WALK_FRAME_COUNTS || prefix in IDLE_FRAME_COUNTS || prefix in ATTACK_FRAME_COUNTS
  );
}

const _baseFor = (state: AnimState): Record<string, number> =>
  state === "walk" ? WALK_FRAME_COUNTS : state === "idle" ? IDLE_FRAME_COUNTS : ATTACK_FRAME_COUNTS;
const _defaultFor = (state: AnimState): number =>
  state === "walk"
    ? DEFAULT_WALK_FRAMES
    : state === "idle"
      ? DEFAULT_IDLE_FRAMES
      : DEFAULT_ATTACK_FRAMES;

/** Contagem EFETIVA de frames de um estado: max(base do atlas, override runtime). */
export function frameCount(state: AnimState, prefix: string): number {
  const base = _baseFor(state)[prefix] ?? _defaultFor(state);
  return Math.max(base, _additions[state][prefix] ?? 0);
}

export const walkFrames = (prefix: string): number => frameCount("walk", prefix);
export const idleFrames = (prefix: string): number => frameCount("idle", prefix);
export const attackFrames = (prefix: string): number => frameCount("attack", prefix);
