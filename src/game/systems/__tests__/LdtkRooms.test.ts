import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLdtk } from "../LdtkLoader";
import { buildGrid, findPath, type Rect } from "../Pathing";

// ─────────────────────────────────────────────────────────────────────────────
// Gate das salas LDtk — valida que TODO .json de sala (public/assets/levels) é
// JOGÁVEL/justo, do mesmo jeito que `validate:levels` faz com as fases (mas puro,
// sem browser). Autoro salas por ASCII (gen-ldtk-rooms.mjs) e antes só conferia
// por screenshot; este teste reprova uma sala impossível de vencer:
//   • saída ALCANÇÁVEL do PlayerStart (grafo de pulos, via systems/Pathing);
//   • nenhum inimigo colado no spawn (raio seguro);
//   • entidades essenciais presentes (PlayerStart + Exit).
//
// A cinemática do pulo é a mesma de Pathing (apex ~112px). Se uma sala nova
// quebra, o desenho ASCII precisa de degraus mais baixos / spawn mais folgado.
// ─────────────────────────────────────────────────────────────────────────────
const LEVELS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../public/assets/levels",
);
const SAFE_RADIUS = 120; // px — nenhum inimigo tão perto do spawn

function roomFiles(): string[] {
  return readdirSync(LEVELS_DIR).filter((f) => f.endsWith(".json"));
}

/** Converte os runs de plataforma do LDtk em Rects sólidos p/ o Pathing. */
function solidsOf(level: ReturnType<typeof parseLdtk>): { rects: Rect[]; floorY: number } {
  const g = level.gridSize;
  const rects = level.platforms.map(([x, surfY, tiles]) => ({
    x,
    y: surfY,
    w: tiles * g,
    h: g,
  }));
  // O chão é o run sólido mais baixo (maior surfY).
  const floorY = Math.max(...level.platforms.map(([, surfY]) => surfY));
  return { rects, floorY };
}

describe("Salas LDtk — jogáveis/justas (Pathing puro)", () => {
  const files = roomFiles();

  test("há pelo menos uma sala", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    describe(file, () => {
      const level = parseLdtk(JSON.parse(readFileSync(join(LEVELS_DIR, file), "utf8")));
      const start = level.entities.find((e) => e.id === "PlayerStart");
      const exit = level.entities.find((e) => e.id === "Exit");
      const enemies = level.entities.filter((e) => e.id === "Enemy");

      test("tem PlayerStart e Exit", () => {
        expect(start).toBeDefined();
        expect(exit).toBeDefined();
      });

      test("saída alcançável do spawn (grafo de pulos)", () => {
        const { rects, floorY } = solidsOf(level);
        const grid = buildGrid(rects, { width: level.widthPx, floorY, cell: level.gridSize });
        const path = findPath(grid, start!.x, start!.y, exit!.x, exit!.y);
        expect(path).not.toBeNull();
      });

      test("nenhum inimigo dentro do raio seguro do spawn", () => {
        for (const e of enemies) {
          const d = Math.hypot(e.x - start!.x, e.y - start!.y);
          expect(d).toBeGreaterThanOrEqual(SAFE_RADIUS);
        }
      });

      test("todo inimigo está sobre uma superfície (não flutua inalcançável)", () => {
        const { rects, floorY } = solidsOf(level);
        const grid = buildGrid(rects, { width: level.widthPx, floorY, cell: level.gridSize });
        for (const e of enemies) {
          // o inimigo deve estar num ponto alcançável a partir do chão do spawn
          const path = findPath(grid, start!.x, floorY - 20, e.x, e.y);
          expect(path).not.toBeNull();
        }
      });
    });
  }
});
