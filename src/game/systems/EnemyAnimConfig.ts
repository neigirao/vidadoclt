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
  // Bosses recolor (asBoss). Enxugados pelo undo:inbetweens junto com o resto:
  // os ímpares eram in-betweens de blend e o ciclo par fecha o loop.
  "scrum-boss": 12,
  "coord-boss": 9,
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
  "scrum-boss": 8,
  "coord-boss": 9,
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
// Contagens ALINHADAS ao atlas depois do `undo:inbetweens` em attack (os frames
// de blend inseridos entre os originais foram removidos). NÃO dirigem o runtime —
// `setEnemyTex` lê do atlas via `atlasFrames`; isto é referência do LAB e do gate
// de coerência. Mantê-las em 16 fazia o gate reprovar arte SÃ dizendo "o jogo
// cicla mais do que existe", quando o jogo nunca ciclou por esta tabela.
export const ATTACK_FRAME_COUNTS: Record<string, number> = {
  estagiario: 17,
  analista: 9,
  facilitador: 17,
  scrum: 13,
  coordenador: 17,
  senior: 25,
  rh: 25,
  "scrum-boss": 13,
  "coord-boss": 13,
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

// ── JANELA das animações ONE-SHOT (attack/hurt) ──────────────────────────────
// `ATTACK_MS` acima é ms POR FRAME calibrado para 16 frames (ver comentário). Mas
// a contagem de frames passou a sair do ATLAS (17–25 hoje), então "ms por frame"
// fixo fazia o ciclo ESTOURAR a janela real do golpe: o `rh` tinha 25×34=850ms de
// animação numa janela de telegraph+swing de 530ms → 9 frames desenhados nunca
// apareciam. O que é DESIGN aqui é a JANELA (quanto tempo o golpe dura), não o
// passo. O passo vira `janela / n_frames_do_atlas` e o golpe cabe por construção,
// não importa quantos frames a arte ganhe ou perca.
const ATTACK_CALIBRATED_FRAMES = 16;
export function attackWindowMs(prefix: string): number {
  return (ATTACK_MS[prefix] ?? DEFAULT_ATTACK_MS) * ATTACK_CALIBRATED_FRAMES;
}

// ── WHITELIST de attack: quantos frames o RUNTIME pode ciclar ────────────────
// REGRESSÃO QUE ISTO CONSERTA: `ATTACK_FRAME_COUNTS` não era só uma contagem —
// era uma WHITELIST de frames validados à mão ("senior 3, rh/facilitador/analista
// 2"), porque o lote de attack gerado por IA vira OUTRO PERSONAGEM a partir de um
// certo índice (ver docs/ART_GAPS.md, "arte de attack incoerente"). Quando a
// contagem passou a sair do ATLAS (fonte única), a whitelist foi silenciosamente
// perdida e o jogo voltou a ciclar a arte estrangeira: o Analista, o Facilitador e
// o Coordenador TROCAM DE PESSOA ao atacar, e scrum/scrum-boss/coord-boss
// degradam em caixa branca → borrão → um sujeito musculoso que não é o inimigo.
// Confirmado olhando os frames do atlas ampliados, um por um.
//
// Contagem continua vindo do atlas; isto é só um TETO de segurança. 0 = nenhum
// frame de attack aprovado → o motor cai na textura base (o inimigo não muda de
// pose no golpe, mas o telegraph de "!!"/glow segue comunicando). Não animar é
// muito melhor que virar outra pessoa.
//
// Para SUBIR um número aqui: olhar os frames no LAB SPRITES e confirmar que é o
// mesmo personagem. Some quando houver arte de attack coerente (ART_GAPS.md P5).
export const ATTACK_SAFE_FRAMES: Record<string, number> = {
  analista: 0, // todos os frames são outro personagem (polo azul + caneca)
  facilitador: 0, // todos são outro personagem (camisa roxa + pilha colorida)
  coordenador: 0, // todos são outro personagem (jaqueta verde + barba)
  scrum: 1, // attack0 ok; 1–4 com caixa branca, 5 borrão, 6+ musculoso
  "scrum-boss": 1, // recolor do scrum — mesmo defeito
  "coord-boss": 1, // recolor do scrum — mesmo defeito
  // estagiario / senior / rh: arte coerente, sem teto (ciclam o atlas inteiro).
};

/** Teto de frames de attack aprovados para `prefix` (Infinity = sem teto). */
export function attackSafeFrames(prefix: string): number {
  return ATTACK_SAFE_FRAMES[prefix] ?? Infinity;
}

/** Janela do flash de dano. Casa com o `hurtT` de 300ms usado pelas Fases 2–5. */
export const HURT_WINDOW_MS = 300;

// Tempo MÍNIMO de tela por frame de animação one-shot. A 60fps um frame de tela
// dura 16.7ms — abaixo disso a pose simplesmente não é vista, e QUAIS poses
// aparecem passa a depender de onde o relógio cai (varia a cada golpe). Acima da
// janela / este valor, `sampleForWindow` amostra o arco de forma determinística.
//   attack: 3 frames de tela por pose (≈20fps) — cadência padrão de pixel-art.
//   hurt:   é um FLASH de dano; poucas poses seguradas leem melhor que 17 borrões.
export const ATTACK_MIN_FRAME_MS = 50;
export const HURT_MIN_FRAME_MS = 90;

// ── HOLDS DESIGUAIS (curvas de duração por pose) ─────────────────────────────
// Todo frame durando o mesmo é o que faz animação de poucos frames parecer
// robótica. O princípio clássico é segurar as poses EXTREMAS e passar voando
// pelo meio. Os números são PESOS relativos, não ms — a curva é reamostrada para
// a quantidade de poses que couber na janela.
//
// POR QUE PLAYER E INIMIGO TÊM CURVAS OPOSTAS: a antecipação de um golpe é
// informação para QUEM APANHA, não para quem bate. O inimigo TEM que telegrafar
// (o windup é metade da janela dele por design — 350–650ms de telegraph antes do
// swing), então segurar as primeiras poses reforça a leitura de ameaça. O player
// é o contrário: segurar o windup dele adiaria a pose de impacto para DEPOIS da
// hitbox, que fica ativa só nos primeiros 120ms (MELEE_ACTIVE_MS) — viraria
// input lag visual. O golpe do player sai rápido e o peso fica onde a pose de
// impacto está.
/** Inimigo: segura o windup (telegrafa), acelera no golpe, alivia na saída. */
export const HOLD_WINDUP: readonly number[] = [1.9, 1.6, 0.6, 0.5, 0.9, 1.3];
/** Player: sai rápido (responsivo) e segura a pose de impacto. */
export const HOLD_IMPACT: readonly number[] = [0.45, 0.8, 1.35, 1.5, 1.15, 0.85];
// NÃO existe HOLD para `hurt`: a curva foi implementada, MEDIDA e descartada. Com
// piso de 90ms numa janela de 300ms sobram 30ms para distribuir → 94/100/106ms
// contra 100/100/100 uniformes. Imperceptível. Um botão que não faz nada é pior
// que a ausência dele.

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
