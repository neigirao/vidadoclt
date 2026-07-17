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
export const WALK_FRAME_COUNTS: Record<string, number> = {
  estagiario: 4,
  analista: 4,
  facilitador: 2,
  scrum: 6,
  coordenador: 4,
  senior: 16, // ciclo de caminhada premium (folha 8×2 fatiada) — elite
  rh: 4,
  // Bosses recolor (asBoss): sem estas entradas caíam no default 2 e animavam só
  // 2 de 6 (scrum-boss) / 2 de 4 (coord-boss). Arte 48×64 válida desperdiçada.
  "scrum-boss": 6,
  "coord-boss": 4,
};

export const IDLE_FRAME_COUNTS: Record<string, number> = {
  // estagiario/analista/facilitador: idle3 é frame CORROMPIDO (extração) → 0-2.
  estagiario: 3,
  analista: 3,
  facilitador: 3,
  scrum: 4,
  coordenador: 4,
  senior: 4,
  rh: 4,
};

// Ataque animado: whitelist dos frames de arte VALIDADA (48×64). Outliers 32×48 /
// lixo de extração ficam de fora. Prefixo ausente → 1 (frame 0 estático).
export const ATTACK_FRAME_COUNTS: Record<string, number> = {
  senior: 3,
  rh: 2,
  facilitador: 2,
  analista: 2,
  // Bosses recolor: os 3 frames de attack são 48×64 limpos (recolor regenerou).
  "scrum-boss": 3,
  "coord-boss": 3,
};

// Duração de frame (ms) por estado — afinada à "energia" de cada inimigo.
export const WALK_MS: Record<string, number> = {
  estagiario: 160,
  analista: 200,
  facilitador: 180,
  scrum: 140,
  coordenador: 220,
  senior: 70, // 16 frames × 70ms ≈ 1.1s/ciclo — caminhada suave (era 4×280)
  rh: 200,
};

export const IDLE_MS: Record<string, number> = {
  estagiario: 280,
  analista: 320,
  facilitador: 300,
  scrum: 260,
  coordenador: 350,
  senior: 500,
  rh: 320,
};

export const ATTACK_MS: Record<string, number> = {
  senior: 120,
  rh: 110,
  facilitador: 100,
  analista: 110,
};

// Defaults do consumidor (o que o jogo usa quando o prefixo não está no record).
export const DEFAULT_WALK_FRAMES = 2;
export const DEFAULT_IDLE_FRAMES = 4;
export const DEFAULT_ATTACK_FRAMES = 1;
export const DEFAULT_WALK_MS = 180;
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
// Além dos overrides de RUNTIME, `AtlasFrameScan` também registra aqui no boot a
// contagem de frames CONTÍGUOS não-vazios que existem NO ATLAS (arte subida pelo
// LAB direto no atlas via pack-atlas) → o jogo cicla o que está empacotado sem
// editar as consts acima na mão.
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
