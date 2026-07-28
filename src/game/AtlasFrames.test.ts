import { describe, expect, test } from "bun:test";
import { frameAt, frameAtOneShot, sampleForWindow } from "./systems/AtlasFrames";
import {
  attackWindowMs,
  HURT_WINDOW_MS,
  HURT_MIN_FRAME_MS,
  ATTACK_MIN_FRAME_MS,
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
