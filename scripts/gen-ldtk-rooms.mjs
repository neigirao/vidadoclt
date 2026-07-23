// ─────────────────────────────────────────────────────────────────────────────
// SALAS LDtk AUTORADAS EM ASCII — evolução do gen-ldtk-poc: cada sala é um
// desenho ASCII (1 caractere = 1 célula de 32px), compilado pro SCHEMA de
// export do LDtk que o LdtkLoader/LdtkRoomScene já consomem. Vantagens:
//   • a sala é DESENHADA de verdade (e o diff do PR mostra o desenho);
//   • um export real do editor LDtk (https://ldtk.io) substitui o .json gerado
//     sem tocar em código — os dois caminhos de autoria coexistem.
//
// Legenda: '#' sólido · 'P' player · 'E' inimigo · 'X' saída · 'D' mesa ·
//          'C' computador (desenhar na linha ACIMA da mesa) · 'L' lâmpada.
// Toda entidade fica ancorada ao PÉ da própria célula — desenhe-a na linha
// imediatamente acima do chão/plataforma onde ela "pisa".
// Regra de alcance: apex de pulo ~112px = 3,5 células; degraus de ≤3 linhas.
//
// Uso: node scripts/gen-ldtk-rooms.mjs   (regenera todos os .json de sala)
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTDIR = join(ROOT, "public", "assets", "levels");
const GRID = 32;

// ── ARQUIVO MORTO (layout do POC original, agora desenhado) ──────────────────
const ARQUIVO = `
........................................
...........L...........L...........L...
........................................
........................................
........................................
........................................
........................................
........................................
..............#####.....................
........................................
........................######..........
......#####.........C...................
..P..........E......D.........E....X....
########################################
`;

// ── DEPÓSITO (sala nova): escada de caixotes sobe até a prateleira alta (um
// inimigo a guarda — subir recompensa); mureta de caixas pulável antes da saída.
const DEPOSITO = `
........................................
....L............L.............L........
........................................
........................................
........................................
.....................E..................
....................######..............
........................................
.............E..........................
............#####.......................
........................................
...#####..C.....................##......
.P........D.......E.........D...##..X...
########################################
`;

function compile(name, ascii) {
  const rows = ascii.split("\n").filter((l) => l.length > 0);
  const H = rows.length;
  const W = Math.max(...rows.map((r) => r.length));
  const csv = new Array(W * H).fill(0);
  const entities = [];
  for (let cy = 0; cy < H; cy++) {
    for (let cx = 0; cx < W; cx++) {
      const ch = rows[cy][cx] ?? ".";
      const x = cx * GRID + GRID / 2;
      const foot = (cy + 1) * GRID; // pé da célula (= topo da linha de baixo)
      if (ch === "#") csv[cy * W + cx] = 1;
      else if (ch === "P") entities.push({ __identifier: "PlayerStart", px: [x, foot - 66] });
      else if (ch === "E") entities.push({ __identifier: "Enemy", px: [x, foot - 32] });
      else if (ch === "X") entities.push({ __identifier: "Exit", px: [x, foot - 28] });
      else if (ch === "D") entities.push({ __identifier: "Desk", px: [x, foot] });
      else if (ch === "C") entities.push({ __identifier: "Computer", px: [x, foot] });
      else if (ch === "L") entities.push({ __identifier: "Lamp", px: [x, cy * GRID + 28] });
    }
  }
  return {
    __header__: {
      app: "LDtk",
      schemaVersion: "1.5.3",
      note: `gerado por gen-ldtk-rooms.mjs (${name})`,
    },
    levels: [
      {
        identifier: name,
        layerInstances: [
          {
            __identifier: "Collisions",
            __type: "IntGrid",
            __cWid: W,
            __cHei: H,
            __gridSize: GRID,
            intGridCsv: csv,
          },
          {
            __identifier: "Entities",
            __type: "Entities",
            __gridSize: GRID,
            entityInstances: entities,
          },
        ],
      },
    ],
  };
}

mkdirSync(OUTDIR, { recursive: true });
const ROOMS = [
  ["Arquivo_Morto", "ldtk-poc.json", ARQUIVO],
  ["Deposito", "ldtk-deposito.json", DEPOSITO],
];
for (const [id, file, ascii] of ROOMS) {
  const ldtk = compile(id, ascii);
  const solids = ldtk.levels[0].layerInstances[0].intGridCsv.filter(Boolean).length;
  const ents = ldtk.levels[0].layerInstances[1].entityInstances.length;
  writeFileSync(join(OUTDIR, file), JSON.stringify(ldtk, null, 2));
  console.log(`✓ ${file}: ${id} (${solids} tiles, ${ents} entidades)`);
}
