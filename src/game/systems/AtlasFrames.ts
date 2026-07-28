// `import type`: o Phaser aqui é só TIPO (o namespace não é usado em runtime).
// Assim o módulo não carrega o Phaser e as funções puras ficam testáveis no
// bun:test — mesma convenção de CulturaSystem/PerkSystem.
import type Phaser from "phaser";
import { runtimeFrameAddition, type AnimState as OverrideState } from "./EnemyAnimConfig";

// ─────────────────────────────────────────────────────────────────────────────
// FONTE ÚNICA de contagem de frames de animação: o ATLAS.
//
// Aprendizado do commit do Lovable no animPhase (Fases 2–5): em vez de contagens
// HARDCODED (que podiam divergir do atlas → "config diz N, atlas tem M" — o bug
// do sênior 16 e dos bosses recolor), a contagem sai da varredura do atlas. E é
// GAP-AWARE: guarda a LISTA de índices presentes (não só a contagem contígua),
// então `walk0,1,2,3,_,5,6` cicla os 6 frames existentes pulando o buraco, em vez
// de parar no 5 (perdendo 5 e 6). Um warn 1×/prefixo/estado sinaliza o gap ao dev.
//
// O que NÃO sai do atlas: o MS (ms por frame) — é valor de DESIGN (energia de cada
// inimigo), fica em EnemyAnimConfig. Aqui só a QUANTIDADE/índices.
// ─────────────────────────────────────────────────────────────────────────────

const ATLAS = "sprites";
const MAX_SCAN = 64;

export type FrameState = "idle" | "walk" | "run" | "attack" | "hurt" | "death";

const _lists: Record<string, number[]> = {};
const _gapWarned = new Set<string>();

/** Lista de índices EXISTENTES de `enemy-<prefix>-<state>N` (ou `<prefix>-<state>N`)
 *  no atlas, gap-aware e cacheada. Vazia se nenhum frame existe. */
export function atlasFrames(
  tex: Phaser.Textures.Texture | undefined,
  prefix: string,
  state: FrameState,
): number[] {
  const key = `${prefix}/${state}`;
  const cached = _lists[key];
  if (cached) return cached;
  const list: number[] = [];
  if (tex) {
    let last = -1;
    for (let i = 0; i < MAX_SCAN; i++) {
      if (tex.has(`enemy-${prefix}-${state}${i}`) || tex.has(`${prefix}-${state}${i}`)) {
        list.push(i);
        last = i;
      }
    }
    if (last >= 0 && list.length !== last + 1 && !_gapWarned.has(key)) {
      _gapWarned.add(key);
      const missing: number[] = [];
      for (let i = 0; i <= last; i++) if (!list.includes(i)) missing.push(i);
      console.warn(
        `[AtlasFrames] gap em ${prefix}-${state}: faltam ${missing.join(",")} (ciclando ${list.length} frames existentes)`,
      );
    }
  }
  _lists[key] = list;
  return list;
}

/** Como `atlasFrames`, mas anexa os frames extras de um override de RUNTIME do LAB
 *  (frames aprovados por IA que persistem como override sem reempacotar o atlas —
 *  `registerFrameAddition`). Só p/ os estados que o LAB rastreia (walk/idle/attack). */
export function atlasFramesWithOverride(
  tex: Phaser.Textures.Texture | undefined,
  prefix: string,
  state: FrameState,
): number[] {
  const base = atlasFrames(tex, prefix, state);
  if (state !== "walk" && state !== "idle" && state !== "attack") return base;
  const add = runtimeFrameAddition(state as OverrideState, prefix);
  const last = base.length ? base[base.length - 1] : -1;
  if (add <= last + 1) return base;
  const extras: number[] = [];
  for (let i = last + 1; i < add; i++) extras.push(i);
  return base.concat(extras);
}

/** Índice a exibir no tempo `t` (com ms por frame). 0 se a lista está vazia.
 *  CICLA — use só em estados que de fato repetem (walk/idle/run). */
export function frameAt(list: number[], t: number, ms: number): number {
  if (list.length === 0) return 0;
  return list[Math.floor(t / ms) % list.length];
}

/** Índice de uma animação ONE-SHOT (attack/hurt/death): os `list.length` frames
 *  são espalhados na JANELA `windowMs` e o último é SEGURADO no fim.
 *
 *  Por que existe: `frameAt` é módulo do relógio GLOBAL, então um golpe entrava
 *  num ponto ARBITRÁRIO do ciclo — a pose de impacto podia aparecer no windup e
 *  a de windup no instante da hitbox. Ancorado no início do estado, o golpe lê
 *  sempre na mesma ordem. E como o passo sai de `windowMs / n`, a animação cabe
 *  na janela real do golpe independentemente de quantos frames o atlas tem
 *  (medido antes: o `rh` tinha 25 frames de attack numa janela de 530ms e 9
 *  deles NUNCA apareciam no jogo). */
export function frameAtOneShot(
  list: number[],
  elapsed: number,
  windowMs: number,
  minFrameMs = 0,
  hold?: HoldShape,
): number {
  if (list.length === 0) return 0;
  if (windowMs <= 0) return list[list.length - 1];

  if (!hold || hold.length < 2) {
    const shown = sampleForWindow(list, windowMs, minFrameMs);
    const step = windowMs / shown.length;
    const i = Math.floor(Math.max(0, elapsed) / step);
    return shown[Math.min(i, shown.length - 1)];
  }

  // HOLDS DESIGUAIS. Todo frame durando o mesmo é o que faz animação de poucos
  // frames parecer robótica. O princípio (Disney, e repetido em todo guia de
  // pixel art) é o oposto: segure as poses EXTREMAS e passe voando pelo meio —
  // "uneven hold times make four frames feel like twelve".
  //
  // Hold desigual só existe se sobrar FOLGA na janela. Com o número máximo de
  // poses, o piso de tempo de tela consome a janela inteira e todas as fatias
  // ficam iguais de novo — medido: 6 poses × 50ms = os 300ms do golpe do player,
  // zero folga. Por isso a curva usa MENOS poses: é a troca clássica de
  // quantidade por tempo ("pick the right frames and let them breathe"). Cada
  // pose recebe o piso e o resto da janela é dividido pelos pesos, então nenhuma
  // fatia fica abaixo do piso e a soma bate exatamente com a janela.
  const max = sampleForWindow(list, windowMs, minFrameMs).length;
  // Animação já curta NÃO perde pose: com 3 poses, cortar para 2 tira informação
  // de um estado que já é mínimo (foi o que aconteceu com o hurt). A troca de
  // quantidade por tempo só vale quando há quantidade sobrando.
  const n = max <= 3 ? max : Math.max(3, Math.round(max * HOLD_POSE_RATIO));
  const shown = sampleForWindow(list, windowMs, windowMs / n);
  const pesos = resampleShape(hold, shown.length);
  const soma = pesos.reduce((a, b) => a + b, 0) || 1;
  const folga = Math.max(0, windowMs - shown.length * minFrameMs);
  const piso = folga > 0 ? minFrameMs : windowMs / shown.length;

  const e = Math.max(0, elapsed);
  let acc = 0;
  for (let i = 0; i < shown.length; i++) {
    acc += piso + folga * (pesos[i] / soma);
    if (e < acc) return shown[i];
  }
  return shown[shown.length - 1];
}

/** Quantas poses usar quando há curva de hold, como fração do máximo que caberia.
 *  Menos poses = mais folga para o hold ser perceptível. 0.7 foi escolhido por
 *  medida: mantém 4 das 6 poses do golpe do player e 7 das 10 do inimigo, com
 *  folga suficiente para a pose mais lenta durar ~1.7× a mais rápida. */
const HOLD_POSE_RATIO = 0.7;

/** Curva de duração relativa por pose (o valor é PESO, não ms). Reamostrada para
 *  a quantidade de poses que couber na janela, então a mesma curva serve para
 *  uma animação de 3 poses e uma de 8. */
export type HoldShape = readonly number[];

/** Reamostra a curva para `n` pontos por interpolação linear. Preserva as pontas. */
export function resampleShape(shape: HoldShape, n: number): number[] {
  if (n <= 1) return [1];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = (i * (shape.length - 1)) / (n - 1);
    const lo = Math.floor(u);
    const hi = Math.min(shape.length - 1, lo + 1);
    out.push(shape[lo] + (shape[hi] - shape[lo]) * (u - lo));
  }
  return out;
}

/** Reduz `list` ao MÁXIMO de frames que ainda dá `minFrameMs` de tela a cada um,
 *  amostrando ao longo do arco (mantém primeiro e último).
 *
 *  Por que: medido, o `hurt` tinha 17 frames numa janela de 300ms = 17.6ms por
 *  frame — MENOS que um frame de tela a 60fps. Na prática o motor pulava frames
 *  conforme onde o relógio caísse: a arte "existia" e não era vista, e o resultado
 *  variava a cada golpe. O `attack` do rh/senior tinha o mesmo problema (25 frames
 *  em 544ms ≈ 21.8ms). Amostrar de forma DETERMINÍSTICA cobre o mesmo arco com
 *  timing estável e legível, em vez de sortear quais poses aparecem. */
export function sampleForWindow(list: number[], windowMs: number, minFrameMs: number): number[] {
  if (minFrameMs <= 0 || list.length === 0) return list;
  const max = Math.max(1, Math.floor(windowMs / minFrameMs));
  if (list.length <= max) return list;
  if (max === 1) return [list[0]];
  const out: number[] = [];
  for (let i = 0; i < max; i++) out.push(list[Math.round((i * (list.length - 1)) / (max - 1))]);
  return out;
}

/** Limpa o cache (testes; ou ao trocar o atlas por override em runtime). */
export function resetAtlasFrames(): void {
  for (const k in _lists) delete _lists[k];
  _gapWarned.clear();
}
