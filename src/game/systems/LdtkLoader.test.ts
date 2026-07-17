import { describe, expect, it } from "bun:test";

import { parseLdtk } from "./LdtkLoader";

// LdtkLoader é módulo puro (sem Phaser) → testável em bun:test. Cobre a conversão
// IntGrid → plataformas (runs horizontais) e a leitura das entidades.

const sample = {
  levels: [
    {
      layerInstances: [
        {
          __identifier: "Collisions",
          __type: "IntGrid",
          __cWid: 5,
          __cHei: 3,
          __gridSize: 32,
          // linha 0: vazia; linha 1: cols 1-3 sólidas; linha 2: chão cheio
          intGridCsv: [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1],
        },
        {
          __identifier: "Entities",
          __type: "Entities",
          __gridSize: 32,
          entityInstances: [
            { __identifier: "PlayerStart", px: [16, 60] },
            { __identifier: "Enemy", px: [100, 60] },
          ],
        },
      ],
    },
  ],
};

describe("LdtkLoader.parseLdtk", () => {
  it("lê dimensões e grid", () => {
    const lvl = parseLdtk(sample);
    expect(lvl.gridSize).toBe(32);
    expect(lvl.widthPx).toBe(160);
    expect(lvl.heightPx).toBe(96);
  });

  it("converte runs horizontais do IntGrid em plataformas [x, surfY, tiles]", () => {
    const lvl = parseLdtk(sample);
    const has = (x: number, y: number, t: number) =>
      lvl.platforms.some((p) => p[0] === x && p[1] === y && p[2] === t);
    // linha 1 (surfY=32): cols 1-3 → x=32, tiles=3 ; linha 2 (surfY=64): 0-4 → x=0, tiles=5
    expect(has(32, 32, 3)).toBe(true);
    expect(has(0, 64, 5)).toBe(true);
    expect(lvl.platforms.length).toBe(2);
  });

  it("conta as células sólidas", () => {
    const lvl = parseLdtk(sample);
    expect(lvl.solids.length).toBe(8); // 3 + 5
  });

  it("lê as entidades com posição em px", () => {
    const lvl = parseLdtk(sample);
    const find = (id: string) => lvl.entities.find((e) => e.id === id);
    expect(find("PlayerStart")).toEqual({ id: "PlayerStart", x: 16, y: 60 });
    expect(find("Enemy")).toEqual({ id: "Enemy", x: 100, y: 60 });
  });

  it("lança se não há nível", () => {
    let threw = false;
    try {
      parseLdtk({ levels: [] });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
