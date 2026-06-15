#!/usr/bin/env node
/**
 * Valida sprites antes do build:
 *   1. Todo PNG em public/assets/sprites/ DEVE ter canal alpha (color type 4 ou 6).
 *   2. Os 4 cantos de cada sprite DEVEM ser totalmente transparentes (alpha=0).
 *      Caso contrário, é sinal de fundo opaco residual reaparecendo.
 *
 * Falha o build (exit 1) listando os arquivos problemáticos.
 *
 * Allowlist: sprites cujo design legitimamente toca os 4 cantos (ex.: tiles
 * full-bleed) podem ser listados em ALLOW_OPAQUE_CORNERS.
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const DIR = path.resolve("public/assets/sprites");
// Apenas arquivos que entram no atlas (resto é asset bruto/screenshot ignorado).
const SPRITE_RE = /^(player|enemy|boss|obj|item|npc|tile|bg)[-_].+\.png$/;
const ALLOW_OPAQUE_CORNERS = new Set([
  // Tiles full-bleed legítimos (chão/plataforma cobrem o frame inteiro).
  "tile-floor",
  "tile-platform",
]);

if (!fs.existsSync(DIR)) {
  console.log(`[check-sprites] dir ausente: ${DIR} — pulando`);
  process.exit(0);
}

const files = fs.readdirSync(DIR).filter((f) => SPRITE_RE.test(f));
const missingAlpha = [];
const opaqueCorners = [];

for (const f of files) {
  const full = path.join(DIR, f);
  const buf = fs.readFileSync(full);
  let png;
  try {
    png = PNG.sync.read(buf);
  } catch (e) {
    console.error(`[check-sprites] PNG inválido: ${f} — ${e.message}`);
    process.exitCode = 1;
    continue;
  }
  // pngjs sempre expande para RGBA, então checamos o color type cru do IHDR:
  // bytes 24 (bit depth) e 25 (color type). 2=RGB sem alpha, 0=greyscale.
  const colorType = buf[25];
  if (colorType !== 4 && colorType !== 6) {
    missingAlpha.push(`${f} (colorType=${colorType})`);
    continue;
  }
  const base = f.replace(/\.png$/, "");
  if (ALLOW_OPAQUE_CORNERS.has(base)) continue;
  const { width: w, height: h, data } = png;
  const cornerAlpha = (x, y) => data[(y * w + x) * 4 + 3];
  const corners = [
    cornerAlpha(0, 0),
    cornerAlpha(w - 1, 0),
    cornerAlpha(0, h - 1),
    cornerAlpha(w - 1, h - 1),
  ];
  if (corners.every((a) => a > 0)) {
    opaqueCorners.push(`${f} (alphas=${corners.join(",")})`);
  }
}

if (missingAlpha.length || opaqueCorners.length) {
  console.error("\n❌ Sprite validation FAILED\n");
  if (missingAlpha.length) {
    console.error(`PNGs sem canal alpha (${missingAlpha.length}):`);
    missingAlpha.forEach((m) => console.error("  - " + m));
    console.error("  → Reexporte como RGBA ou rode scripts/strip-bg.py\n");
  }
  if (opaqueCorners.length) {
    console.error(`PNGs com cantos opacos / fundo residual (${opaqueCorners.length}):`);
    opaqueCorners.forEach((m) => console.error("  - " + m));
    console.error(
      "  → Adicione o basename em scripts/strip-bg.py:FILES, rode o script,\n" +
        "    e reempacote: python3 scripts/pack-atlas.py\n" +
        "  → Tile full-bleed legítimo? adicione em ALLOW_OPAQUE_CORNERS em scripts/check-sprites.mjs\n",
    );
  }
  process.exit(1);
}

console.log(`[check-sprites] OK — ${files.length} PNGs validados (alpha + cantos transparentes).`);
