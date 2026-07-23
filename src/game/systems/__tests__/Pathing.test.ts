import { describe, expect, test } from "bun:test";
import { buildGrid, findPath, nextDirX, type Rect } from "../Pathing";

// Mundo de teste: chão em y=448, 960 de largura (números da Fase 1).
const OPTS = { width: 960, floorY: 448, cell: 16, maxJumpPx: 120 };

describe("Pathing (rot-js A* — núcleo puro)", () => {
  test("chão aberto: rota existe e aponta pro alvo", () => {
    const grid = buildGrid([], OPTS);
    expect(findPath(grid, 100, 440, 800, 440)).not.toBeNull();
    expect(nextDirX(grid, 100, 440, 800, 440)).toBe(1);
    expect(nextDirX(grid, 800, 440, 100, 440)).toBe(-1);
  });

  test("mesa baixa (pulável): rota passa por cima", () => {
    // mesa 40px de altura no meio do caminho (topo 408, dentro do pulo de 120)
    const mesa: Rect = { x: 400, y: 408, w: 96, h: 40 };
    const grid = buildGrid([mesa], OPTS);
    expect(findPath(grid, 100, 440, 800, 440)).not.toBeNull();
    expect(nextDirX(grid, 100, 440, 800, 440)).toBe(1);
  });

  test("parede alta (intransponível): sem rota → null (dar meia-volta, não pular)", () => {
    // pilha do chão até y=100 (348px de altura >> pulo de 120)
    const parede: Rect = { x: 400, y: 100, w: 64, h: 348 };
    const grid = buildGrid([parede], OPTS);
    expect(findPath(grid, 100, 440, 800, 440)).toBeNull();
    expect(nextDirX(grid, 100, 440, 800, 440)).toBeNull();
  });

  test("alvo em cima de móvel pulável: rota sobe", () => {
    const mesa: Rect = { x: 400, y: 400, w: 96, h: 48 };
    const grid = buildGrid([mesa], OPTS);
    // alvo parado no TOPO da mesa
    expect(findPath(grid, 100, 440, 448, 390)).not.toBeNull();
  });

  test("encostado na borda do móvel: snap acha célula vizinha (o momento do hop)", () => {
    const mesa: Rect = { x: 400, y: 408, w: 96, h: 40 };
    const grid = buildGrid([mesa], OPTS);
    // centro do sprite caiu na célula de borda do sólido — sem o snap seria null
    expect(nextDirX(grid, 402, 430, 800, 440)).toBe(1);
  });

  test("no MIOLO de um sólido alto: sem rota (snap de raio 1 não salva)", () => {
    const parede: Rect = { x: 400, y: 100, w: 96, h: 348 };
    const grid = buildGrid([parede], OPTS);
    expect(findPath(grid, 448, 300, 800, 440)).toBeNull();
  });

  test("já na coluna do alvo: dir 0", () => {
    const grid = buildGrid([], OPTS);
    expect(nextDirX(grid, 500, 440, 500, 400)).toBe(0);
  });

  test("alvo em pleno ar acima do pulo: inalcançável (null)", () => {
    const grid = buildGrid([], OPTS);
    expect(findPath(grid, 500, 440, 500, 100)).toBeNull();
  });
});
