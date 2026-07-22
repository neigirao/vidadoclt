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
  // REVERTIDO à arte ORIGINAL LIMPA (pré-projeto 16-frames): os in-betweens por
  // blend fantasmavam frames do meio/cauda do ciclo (poses borradas/duplas —
  // flagado por audit:anim como loop-pop, confirmado visualmente). Ciclos curtos
  // e limpos > inflados e corrompidos. senior fica 16 (arte premium, sem ghost).
  estagiario: 4,
  analista: 4,
  facilitador: 2,
  scrum: 6,
  coordenador: 4,
  senior: 16,
  rh: 4,
  // Bosses recolor (asBoss) — mantidos (não flagados pelo audit)
  "scrum-boss": 24,
  "coord-boss": 16,
};

export const IDLE_FRAME_COUNTS: Record<string, number> = {
  // Revertido à arte original (idle3 de estagiario/analista/facilitador era frame
  // corrompido → 3). Mesma razão do walk.
  estagiario: 3,
  analista: 3,
  facilitador: 3,
  scrum: 4,
  coordenador: 4,
  senior: 4,
  rh: 4,
  "scrum-boss": 16,
  "coord-boss": 16,
};

// Ataque animado: whitelist dos frames de arte VALIDADA (48×64). Outliers 32×48 /
// lixo de extração ficam de fora. Prefixo ausente → 1 (frame 0 estático).
// senior/rh subidos a 4: a leva de frames do Lovable ("auditou frames faltantes")
// completou ciclos COERENTES aqui (conferido no strip). As demais famílias NÃO
// foram subidas: os attack2/3 gerados por IA são um personagem DIFERENTE da base
// (musculoso/chicote/ícone de som) — ciclar quebraria a leitura.
// Ataque a 16 frames/ação (alvo do projeto): os frames-base LIMPOS (4–5 poses reais
// do personagem) foram INTERPOLADOS por gen-inbetweens (blend + trava de paleta,
// sem IA) até 16. Como a interpolação parte só dos frames CONTÍGUOS válidos a
// partir do 0, nenhum frame-lixo/foreign (o "musculoso/chicote" antigo) entra no
// ciclo — as 16 poses derivam das boas. ATTACK_MS ajustado p/ manter a duração do
// golpe (mais frames × menos ms = mesma janela).
export const ATTACK_FRAME_COUNTS: Record<string, number> = {
  estagiario: 16,
  analista: 16,
  facilitador: 16,
  scrum: 16,
  coordenador: 16,
  senior: 16,
  rh: 16,
  "scrum-boss": 16,
  "coord-boss": 16,
};

// Duração de frame (ms) por estado — afinada à "energia" de cada inimigo.
// ms POR FRAME halvado (era o dobro): os ciclos de walk foram DOBRADOS com
// in-betweens sintéticos (gen-inbetweens.mjs). Metade do ms por frame mantém a
// MESMA duração de ciclo de antes — só mais suave. (ex.: senior 32×35 ≈ 16×70.)
export const WALK_MS: Record<string, number> = {
  // Cadência ORIGINAL restaurada (com a revert dos frames): ciclos curtos e
  // snappy. senior fica 70 (16 frames × 70 ≈ 1.1s).
  estagiario: 160,
  analista: 200,
  facilitador: 180,
  scrum: 140,
  coordenador: 220,
  senior: 70,
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
  "scrum-boss": 90,
  "coord-boss": 90,
};

// Attack dobrado p/ 16 → ms por frame reduzido p/ manter a MESMA janela de golpe
// (ex.: analista 5×110 ≈ 16×34). ~30–40ms/frame ≈ 480–640ms/ciclo.
export const ATTACK_MS: Record<string, number> = {
  estagiario: 34,
  analista: 34,
  facilitador: 32,
  scrum: 36,
  coordenador: 40,
  senior: 36,
  rh: 34,
  "scrum-boss": 36,
  "coord-boss": 36,
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
