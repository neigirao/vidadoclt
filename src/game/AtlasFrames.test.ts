import { describe, expect, test } from "bun:test";
import { frameAt, frameAtOneShot, sampleForWindow, resampleShape } from "./systems/AtlasFrames";
import {
  attackWindowMs,
  HURT_WINDOW_MS,
  HURT_MIN_FRAME_MS,
  ATTACK_MIN_FRAME_MS,
  attackSafeFrames,
  HOLD_IMPACT,
  HOLD_WINDUP,
} from "./systems/EnemyAnimConfig";

describe("frameAtOneShot — attack/hurt não podem entrar em frame arbitrário", () => {
  const list = [0, 1, 2, 3];

  test("começa SEMPRE no frame 0", () => {
    expect(frameAtOneShot(list, 0, 400)).toBe(0);
  });

  test("avança em ordem dentro da janela", () => {
    expect(frameAtOneShot(list, 100, 400)).toBe(1);
    expect(frameAtOneShot(list, 200, 400)).toBe(2);
    expect(frameAtOneShot(list, 300, 400)).toBe(3);
  });

  test("SEGURA o último frame depois da janela (não volta ao 0)", () => {
    expect(frameAtOneShot(list, 400, 400)).toBe(3);
    expect(frameAtOneShot(list, 99999, 400)).toBe(3);
  });

  test("respeita a lista gap-aware (devolve o índice, não a posição)", () => {
    expect(frameAtOneShot([0, 2, 5], 0, 300)).toBe(0);
    expect(frameAtOneShot([0, 2, 5], 150, 300)).toBe(2);
    expect(frameAtOneShot([0, 2, 5], 290, 300)).toBe(5);
  });

  test("lista vazia não quebra", () => {
    expect(frameAtOneShot([], 100, 400)).toBe(0);
  });

  // A regressão que motivou tudo: `frameAt` (módulo do relógio GLOBAL) fazia o
  // golpe entrar num ponto qualquer do ciclo — a pose de impacto podia aparecer
  // no windup. Este teste trava a diferença entre os dois comportamentos.
  test("frameAt CICLA (por isso não serve p/ one-shot); frameAtOneShot não", () => {
    expect(frameAt(list, 12345, 100)).not.toBe(0); // entrada arbitrária
    expect(frameAtOneShot(list, 0, 400)).toBe(0); // sempre do começo
  });
});

describe("janela one-shot cabe no golpe independentemente da contagem do atlas", () => {
  // O bug medido: `rh` tinha 25 frames de attack a 34ms fixos = 850ms, numa
  // janela real de telegraph+swing de 530ms → 9 frames nunca apareciam.
  test("todos os frames tocam dentro da janela, com 17 ou com 25", () => {
    for (const n of [17, 25]) {
      const l = Array.from({ length: n }, (_, i) => i);
      const w = attackWindowMs("rh");
      const vistos = new Set<number>();
      for (let e = 0; e < w; e += 1) vistos.add(frameAtOneShot(l, e, w));
      expect(vistos.size).toBe(n);
    }
  });

  test("hurt idem, na janela de 300ms que as Fases 2–5 usam", () => {
    const l = Array.from({ length: 17 }, (_, i) => i);
    const vistos = new Set<number>();
    for (let e = 0; e < HURT_WINDOW_MS; e += 1) vistos.add(frameAtOneShot(l, e, HURT_WINDOW_MS));
    expect(vistos.size).toBe(17);
  });
});

describe("sampleForWindow — nenhuma pose pode durar menos que um frame de tela", () => {
  const l = Array.from({ length: 17 }, (_, i) => i);

  test("17 frames de hurt em 300ms viram poucas poses seguradas", () => {
    const shown = sampleForWindow(l, HURT_WINDOW_MS, HURT_MIN_FRAME_MS);
    expect(shown.length).toBe(3); // 300 / 90 → 3
    expect(HURT_WINDOW_MS / shown.length).toBeGreaterThanOrEqual(HURT_MIN_FRAME_MS);
  });

  test("mantém primeiro e último (o arco inteiro, não só o começo)", () => {
    const shown = sampleForWindow(l, HURT_WINDOW_MS, HURT_MIN_FRAME_MS);
    expect(shown[0]).toBe(0);
    expect(shown[shown.length - 1]).toBe(16);
  });

  test("é crescente — a amostragem não embaralha o arco", () => {
    const shown = sampleForWindow(l, 544, 50);
    for (let i = 1; i < shown.length; i++) expect(shown[i]).toBeGreaterThan(shown[i - 1]);
  });

  test("não mexe quando já cabe", () => {
    expect(sampleForWindow([0, 1, 2], 600, 90)).toEqual([0, 1, 2]);
  });

  test("minFrameMs 0 desliga (walk/idle não passam por aqui)", () => {
    expect(sampleForWindow(l, 100, 0)).toEqual(l);
  });

  test("attack do rh: 25 frames em 544ms passam a durar ≥ 3 frames de tela", () => {
    const l25 = Array.from({ length: 25 }, (_, i) => i);
    const w = attackWindowMs("rh");
    const shown = sampleForWindow(l25, w, ATTACK_MIN_FRAME_MS);
    expect(w / shown.length).toBeGreaterThanOrEqual(ATTACK_MIN_FRAME_MS);
    expect(w / shown.length).toBeGreaterThanOrEqual(1000 / 60); // > 1 frame a 60fps
  });
});

describe("whitelist de attack — arte estrangeira não pode entrar no ciclo", () => {
  // REGRESSÃO REAL: `ATTACK_FRAME_COUNTS` não era só contagem, era uma whitelist
  // de frames validados à mão. Quando a contagem passou a sair do atlas, a
  // whitelist se perdeu e o jogo voltou a ciclar arte que é OUTRO PERSONAGEM —
  // o Analista virava um sujeito de polo azul com caneca ao atacar. Confirmado
  // olhando os frames ampliados do atlas, um a um.
  test("os prefixos com arte incoerente têm teto declarado", () => {
    expect(attackSafeFrames("analista")).toBe(0);
    expect(attackSafeFrames("facilitador")).toBe(0);
    expect(attackSafeFrames("coordenador")).toBe(0);
    expect(attackSafeFrames("scrum")).toBe(1);
    expect(attackSafeFrames("scrum-boss")).toBe(1);
    expect(attackSafeFrames("coord-boss")).toBe(1);
  });

  test("quem tem arte coerente NÃO ganha teto (cicla o atlas inteiro)", () => {
    for (const p of ["estagiario", "senior", "rh"]) {
      expect(attackSafeFrames(p)).toBe(Infinity);
    }
  });

  test("o teto realmente CORTA a lista do atlas", () => {
    const doAtlas = Array.from({ length: 25 }, (_, i) => i);
    expect(doAtlas.slice(0, attackSafeFrames("scrum"))).toEqual([0]);
    expect(doAtlas.slice(0, attackSafeFrames("analista"))).toEqual([]);
    expect(doAtlas.slice(0, attackSafeFrames("rh"))).toEqual(doAtlas);
  });
});

describe("holds desiguais — fluidez vem do TIMING, não da quantidade de frames", () => {
  const attack = Array.from({ length: 17 }, (_, i) => i);

  /** Duração de cada pose, medida varrendo a função ms a ms (como o jogo a usa). */
  function duracoes(list: number[], win: number, min: number, hold?: readonly number[]) {
    const out: { frame: number; ms: number }[] = [];
    let cur: number | null = null;
    let ini = 0;
    for (let t = 0; t <= win; t++) {
      const f = frameAtOneShot(list, t, win, min, hold);
      if (f !== cur) {
        if (cur !== null) out.push({ frame: cur, ms: t - ini });
        cur = f;
        ini = t;
      }
    }
    out.push({ frame: cur as number, ms: win - ini });
    return out;
  }

  test("sem curva, todas as poses duram o mesmo (comportamento antigo intacto)", () => {
    const d = duracoes(attack, 300, 50);
    for (const p of d) expect(p.ms).toBe(300 / d.length);
  });

  test("com curva, as durações passam a ser desiguais", () => {
    const d = duracoes(attack, 300, 50, HOLD_IMPACT);
    const ms = d.map((p) => p.ms);
    expect(Math.max(...ms) / Math.min(...ms)).toBeGreaterThan(1.3);
  });

  test("NENHUMA pose fica abaixo do piso de tempo de tela", () => {
    for (const [win, min, hold] of [
      [300, 50, HOLD_IMPACT],
      [544, 50, HOLD_WINDUP],
    ] as const) {
      for (const p of duracoes(attack, win, min, hold)) {
        expect(p.ms).toBeGreaterThanOrEqual(min - 1); // -1: arredondamento da varredura
      }
    }
  });

  test("a soma das durações é exatamente a janela do golpe", () => {
    const d = duracoes(attack, 544, 50, HOLD_WINDUP);
    expect(d.reduce((a, p) => a + p.ms, 0)).toBe(544);
  });

  test("HOLD_WINDUP segura o começo (telegrafa) e acelera no meio", () => {
    const ms = duracoes(attack, 544, 50, HOLD_WINDUP).map((p) => p.ms);
    expect(ms[0]).toBeGreaterThan(Math.min(...ms) * 1.3);
    expect(Math.min(...ms)).toBe(ms[Math.floor(ms.length / 2)]);
  });

  test("HOLD_IMPACT começa RÁPIDO — senão a pose de impacto sai depois da hitbox", () => {
    const d = duracoes(attack, 300, 50, HOLD_IMPACT);
    // a 1ª pose não pode ser a mais longa: o golpe do player precisa sair na hora
    expect(d[0].ms).toBeLessThan(Math.max(...d.map((p) => p.ms)));
  });

  test("animação já curta (3 poses) não perde pose para ganhar hold", () => {
    expect(duracoes(attack, 300, 90, HOLD_IMPACT).length).toBe(3);
  });

  test("resampleShape estica/encolhe a curva preservando as pontas", () => {
    const s = [1, 5, 2] as const;
    expect(resampleShape(s, 3)).toEqual([1, 5, 2]);
    const r = resampleShape(s, 5);
    expect(r[0]).toBe(1);
    expect(r[r.length - 1]).toBe(2);
    expect(r.length).toBe(5);
  });
});
