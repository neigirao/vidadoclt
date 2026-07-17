// Gera um nível de exemplo no SCHEMA de export do LDtk (https://ldtk.io) para o
// POC do pipeline híbrido (sala desenhada → código monta a fase). O editor GUI
// do LDtk não roda no sandbox; este script emite o MESMO JSON que o export do
// LDtk produz (camada IntGrid + camada Entities), então um export real do editor
// substitui este arquivo sem tocar no código do jogo (LdtkLoader/LdtkRoomScene).
//
// Uso: node scripts/gen-ldtk-poc.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "assets", "levels", "ldtk-poc.json");

const GRID = 32;
const W = 40; // 1280px de largura
const H = 14; // 448px de altura (FLOOR_Y=428 fica ~linha 13)

// IntGrid: 1 = sólido (plataforma). Plataformas em alturas ALCANÇÁVEIS (apex de
// pulo ~112px sobre FLOOR_Y=428): degraus em ~352, ~256, ~320.
const csv = new Array(W * H).fill(0);
const put = (row, c1, c2) => {
  for (let c = c1; c <= c2; c++) csv[row * W + c] = 1;
};
put(13, 0, W - 1); // CHÃO contínuo (surfY=416 ~ FLOOR_Y=428)
put(11, 6, 10); // surfY=352, x=192..
put(8, 14, 18); // surfY=256
put(10, 24, 29); // surfY=320

const ldtk = {
  // Campos mínimos do export LDtk que o LdtkLoader lê (um export real traz muito
  // mais — defs/enums/etc. — que ignoramos).
  __header__: { app: "LDtk", schemaVersion: "1.5.3", note: "POC gerado por gen-ldtk-poc.mjs" },
  levels: [
    {
      identifier: "Arquivo_Morto",
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
          entityInstances: [
            { __identifier: "PlayerStart", px: [80, 350] },
            { __identifier: "Enemy", px: [430, 384] },
            { __identifier: "Enemy", px: [900, 384] },
            { __identifier: "Exit", px: [1180, 388] },
          ],
        },
      ],
    },
  ],
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(ldtk, null, 2));
console.log(
  `✓ LDtk POC gravado: ${OUT} (${W}x${H} @ ${GRID}px, ${csv.filter(Boolean).length} tiles)`,
);
