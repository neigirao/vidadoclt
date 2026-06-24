/**
 * Pathfinding — lightweight grid-based A* for enemy navigation.
 *
 * Grid cells map to the game world via `cellSize` pixels.
 * Walls (platforms, furniture bodies) are marked as blocked.
 *
 * Usage:
 *   const pf = new Pathfinding(levelWidth, levelHeight, 32);
 *   pf.markRect(x, y, w, h);             // block platforms
 *   const path = pf.findPath(sx, sy, tx, ty); // world coords → [Point, ...]
 *
 * Keep the grid persistent per scene; recalculate `markRect` only when
 * level geometry changes (not every frame).
 */

export interface Point { x: number; y: number; }

interface Node {
  x: number; y: number;
  g: number; h: number; f: number;
  parent: Node | null;
}

export class Pathfinding {
  private grid: Uint8Array;
  private cols: number;
  private rows: number;

  constructor(
    private worldWidth: number,
    private worldHeight: number,
    private cellSize = 32,
  ) {
    this.cols = Math.ceil(worldWidth / cellSize);
    this.rows = Math.ceil(worldHeight / cellSize);
    this.grid = new Uint8Array(this.cols * this.rows); // 0 = open, 1 = blocked
  }

  /** Mark a world-space rectangle as impassable. */
  markRect(wx: number, wy: number, ww: number, wh: number): void {
    const c0 = Math.max(0, Math.floor(wx / this.cellSize));
    const r0 = Math.max(0, Math.floor(wy / this.cellSize));
    const c1 = Math.min(this.cols - 1, Math.floor((wx + ww) / this.cellSize));
    const r1 = Math.min(this.rows - 1, Math.floor((wy + wh) / this.cellSize));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        this.grid[r * this.cols + c] = 1;
      }
    }
  }

  /** Reset all cells to open. */
  clearGrid(): void {
    this.grid.fill(0);
  }

  /**
   * Find a path between two world-space points.
   * Returns an array of world-space waypoints (cell centres), or [] if none found.
   * Cap `maxNodes` to prevent budget overruns on large open levels.
   */
  findPath(
    fromX: number, fromY: number,
    toX: number,   toY: number,
    maxNodes = 800,
  ): Point[] {
    const sc = this.snap(fromX, fromY);
    const ec = this.snap(toX, toY);

    if (sc.c === ec.c && sc.r === ec.r) return [];

    const key = (c: number, r: number) => r * this.cols + c;

    const open: Node[] = [];
    const closed = new Uint8Array(this.cols * this.rows);

    const start: Node = { x: sc.c, y: sc.r, g: 0, h: this.h(sc.c, sc.r, ec.c, ec.r), parent: null, f: 0 };
    start.f = start.h;
    open.push(start);

    let iterations = 0;

    while (open.length > 0 && iterations++ < maxNodes) {
      // pop lowest f
      let bestIdx = 0;
      for (let i = 1; i < open.length; i++) {
        if (open[i].f < open[bestIdx].f) bestIdx = i;
      }
      const current = open.splice(bestIdx, 1)[0];
      closed[key(current.x, current.y)] = 1;

      if (current.x === ec.c && current.y === ec.r) {
        return this.trace(current);
      }

      for (const [dc, dr] of this.neighbours) {
        const nc = current.x + dc;
        const nr = current.y + dr;
        if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) continue;
        if (this.grid[key(nc, nr)] || closed[key(nc, nr)]) continue;

        const g = current.g + (dc !== 0 && dr !== 0 ? 1.414 : 1);
        const existing = open.find(n => n.x === nc && n.y === nr);
        if (!existing) {
          open.push({ x: nc, y: nr, g, h: this.h(nc, nr, ec.c, ec.r), f: g + this.h(nc, nr, ec.c, ec.r), parent: current });
        } else if (g < existing.g) {
          existing.g = g;
          existing.f = g + existing.h;
          existing.parent = current;
        }
      }
    }

    return [];
  }

  private readonly neighbours = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];

  private h(c: number, r: number, ec: number, er: number): number {
    return Math.abs(c - ec) + Math.abs(r - er);
  }

  private snap(wx: number, wy: number) {
    return {
      c: Math.max(0, Math.min(this.cols - 1, Math.floor(wx / this.cellSize))),
      r: Math.max(0, Math.min(this.rows - 1, Math.floor(wy / this.cellSize))),
    };
  }

  private trace(node: Node): Point[] {
    const path: Point[] = [];
    let cur: Node | null = node;
    while (cur) {
      path.unshift({
        x: cur.x * this.cellSize + this.cellSize / 2,
        y: cur.y * this.cellSize + this.cellSize / 2,
      });
      cur = cur.parent;
    }
    return path;
  }
}
