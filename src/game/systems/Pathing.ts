import { Path } from "rot-js";

// ─────────────────────────────────────────────────────────────────────────────
// PATHING — pathfinding 2D coarse com rot-js (A*) para o side-scroller.
//
// POR QUE: os perseguidores de chão "encalham" atrás de móveis e ficam dando o
// pulinho cego do hopOverFurniture — mesmo quando o obstáculo é INTRANSPONÍVEL
// (pilha alta). Este módulo responde "existe rota até o alvo?" e "qual o próximo
// passo?", pra o pulinho só acontecer quando faz sentido (e o inimigo dar meia-
// volta quando não faz).
//
// MODELO (aproximação de 1ª ordem, não simula o arco do pulo): grade de células
// `cell` px. Uma célula é passável se (a) não está dentro de um sólido e (b) está
// ao alcance de pulo da superfície de apoio da coluna (chão ou topo de móvel) —
// ou seja, o "ar" muito acima do apoio é parede. A* 4-dir do rot-js sobre isso
// aproxima bem o alcance real de um perseguidor de chão com pulo limitado.
//
// PURO (sem Phaser) — testável em bun:test. O consumidor Phaser monta os Rects a
// partir dos StaticGroups e cacheia a grade (os móveis são estáticos).
// ─────────────────────────────────────────────────────────────────────────────

export type Rect = { x: number; y: number; w: number; h: number };

export interface PathGrid {
  cols: number;
  rows: number;
  cell: number;
  originY: number; // topo do mundo coberto pela grade (px)
  passable: Uint8Array; // [row*cols+col] = 1 se passável
}

export interface GridOpts {
  width: number; // largura do mundo (px)
  floorY: number; // Y da superfície do chão (px)
  ceilingY?: number; // topo útil (px) — default 0
  cell?: number; // tamanho da célula (px) — default 16
  maxJumpPx?: number; // teto de pulo acima do apoio — default 120 (apex ~112 do jogo + folga)
}

/** Monta a grade de passabilidade a partir dos sólidos (móveis/plataformas). */
export function buildGrid(solids: Rect[], opts: GridOpts): PathGrid {
  const cell = opts.cell ?? 16;
  const originY = opts.ceilingY ?? 0;
  const maxJump = opts.maxJumpPx ?? 120;
  const cols = Math.ceil(opts.width / cell);
  // Linhas cobrem originY..floorY EXCLUSIVO: a última linha termina na superfície
  // do chão. Sem isso existia uma linha "dentro do chão" (abaixo da superfície)
  // por onde o A* passava POR BAIXO da base dos móveis.
  const rows = Math.ceil((opts.floorY - originY) / cell);
  const passable = new Uint8Array(cols * rows);

  // 1. Altura de apoio por coluna: o topo do sólido mais alto que "sustenta"
  //    aquela coluna (ou o chão). Pulo só alcança até maxJump acima do apoio.
  const supportY = new Array<number>(cols).fill(opts.floorY);
  for (const r of solids) {
    const c0 = Math.max(0, Math.floor(r.x / cell));
    const c1 = Math.min(cols - 1, Math.floor((r.x + r.w - 1) / cell));
    for (let c = c0; c <= c1; c++) supportY[c] = Math.min(supportY[c], r.y);
  }

  // 2. Passável = fora de sólido E dentro do alcance de pulo do apoio da coluna.
  for (let row = 0; row < rows; row++) {
    const y = originY + row * cell;
    for (let col = 0; col < cols; col++) {
      const x = col * cell;
      const insideSolid = solids.some(
        (r) => x + cell > r.x && x < r.x + r.w && y + cell > r.y && y < r.y + r.h,
      );
      const reachable = y + cell > supportY[col] - maxJump;
      passable[row * cols + col] = insideSolid || !reachable ? 0 : 1;
    }
  }
  return { cols, rows, cell, originY, passable };
}

const toCol = (g: PathGrid, x: number) => Math.max(0, Math.min(g.cols - 1, Math.floor(x / g.cell)));
const toRow = (g: PathGrid, y: number) =>
  Math.max(0, Math.min(g.rows - 1, Math.floor((y - g.originY) / g.cell)));

/** Caminho A* (4-dir) entre dois pontos do mundo. `null` = sem rota. */
export function findPath(
  grid: PathGrid,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Array<[number, number]> | null {
  const pass = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < grid.cols && y < grid.rows && grid.passable[y * grid.cols + x] === 1;
  // Endpoint em célula sólida → "snap" pra vizinha passável (raio 1 célula).
  // Necessário porque o CONSUMIDOR consulta no exato momento do encosto no
  // móvel (o centro do sprite pode cair na célula de borda do sólido); sem o
  // snap, todo hop viraria "sem rota". Raio pequeno de propósito: um ponto no
  // MIOLO de um sólido continua sem rota (comportamento correto).
  const snap = (c: number, r: number): [number, number] | null => {
    if (pass(c, r)) return [c, r];
    for (const [dc, dr] of [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
      [-1, -1],
      [1, -1],
    ] as const) {
      if (pass(c + dc, r + dr)) return [c + dc, r + dr];
    }
    return null;
  };
  const from = snap(toCol(grid, fromX), toRow(grid, fromY));
  const to = snap(toCol(grid, toX), toRow(grid, toY));
  if (!from || !to) return null;
  const [fc, fr] = from;
  const [tc, tr] = to;
  const astar = new Path.AStar(tc, tr, pass, { topology: 4 });
  const out: Array<[number, number]> = [];
  astar.compute(fc, fr, (x, y) => out.push([x, y]));
  return out.length > 0 ? out : null;
}

/**
 * Direção X do próximo passo rumo ao alvo: -1/0/+1, ou `null` se NÃO há rota
 * (obstáculo intransponível → o consumidor deve dar meia-volta, não pular).
 */
export function nextDirX(
  grid: PathGrid,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): -1 | 0 | 1 | null {
  const path = findPath(grid, fromX, fromY, toX, toY);
  if (!path) return null;
  // Referência = a ORIGEM DO CAMINHO (já snapada), não a coluna crua do ponto —
  // senão o próprio snap lateral contava como "primeiro passo" e invertia o dir.
  const fc = path[0][0];
  // primeiro nó do caminho que muda de coluna (os primeiros podem ser verticais)
  for (const [c] of path) {
    if (c !== fc) return c > fc ? 1 : -1;
  }
  return 0; // já na coluna do alvo
}
