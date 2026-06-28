#!/usr/bin/env node
/**
 * unify-style.mjs
 *
 * Unifica o visual dos sprites de entidades em duas passadas:
 *
 *   1) Quantização para uma paleta-mestre de ~32 cores
 *      (cinzas corporativos frios + acentos quentes).
 *      Reduz dissonância entre sprites de fontes diferentes
 *      (Gemini, ChatGPT, Photoroom, manual).
 *
 *   2) Outline preto 1px nas bordas alpha de cada entidade.
 *      Aplicado APENAS em pixels totalmente transparentes que
 *      tocam um pixel opaco vizinho (N/S/L/O) — não engorda
 *      o desenho, só desenha o contorno.
 *
 * Escopo: apenas `player-*`, `enemy-*`, `boss-*`, `npc-*` em
 * public/assets/sprites/ (NÃO mexe em items, objetos, tiles,
 * UI ou _sources). Ignora spritesheets > 200px.
 *
 * Flags:
 *   --dry         não escreve, só loga
 *   --no-outline  só quantiza paleta
 *   --no-palette  só adiciona outline
 *   --verbose     loga cada arquivo
 *
 * Uso:
 *   node scripts/unify-style.mjs
 *   node scripts/pack-atlas.mjs   # re-empacota o atlas
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = "public/assets/sprites";
const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry");
const SKIP_OUTLINE = args.has("--no-outline");
const SKIP_PALETTE = args.has("--no-palette");
const VERBOSE = args.has("--verbose");

// ---------- PALETA-MESTRE (32 cores) ----------
// Filosofia: escritório corporativo opressor.
// 12 cinzas frios (estrutura) + 8 tons de pele/uniforme (entidades)
// + 6 acentos quentes (sangue, alerta, lanyards) + 6 acentos frios
// (telas, neon, vidro).
const MASTER_PALETTE = [
  // Cinzas frios / pretos
  [10, 12, 16],     [22, 26, 33],     [38, 44, 54],     [58, 66, 78],
  [82, 92, 105],    [110, 122, 138],  [148, 158, 172],  [184, 192, 204],
  [212, 218, 226],  [232, 236, 242],  [246, 248, 252],  [255, 255, 255],
  // Pele / uniformes (tons quebrados, dessaturados)
  [60,  42,  34],   [102, 72,  56],   [148, 108, 84],   [196, 156, 124],
  [228, 196, 168],  [76,  60,  52],   [124, 92,  68],   [168, 132, 96],
  // Acentos quentes — vermelhos/laranjas/amarelos (alerta, sangue, lanyard RH)
  [120, 28,  32],   [186, 52,  48],   [228, 96,  64],   [242, 168, 72],
  [218, 188, 92],   [156, 116, 40],
  // Acentos frios — verdes/azuis (monitores, neon CPD, telas)
  [34,  78,  68],   [56,  132, 116],  [44,  92,  148],  [86,  152, 204],
  [132, 96,  168],  [72,  48,  108],
];

// Pré-calcula paleta como Uint8 + sq components
const PALETTE = MASTER_PALETTE.map(([r, g, b]) => ({ r, g, b }));

function nearestPaletteColor(r, g, b) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < PALETTE.length; i++) {
    const p = PALETTE[i];
    const dr = r - p.r, dg = g - p.g, db = b - p.b;
    // Distância perceptual leve (peso verde maior)
    const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
    if (d < bestD) { bestD = d; best = i; }
  }
  return PALETTE[best];
}

function quantize(png) {
  const { width: w, height: h, data } = png;
  const cache = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 16) continue; // pixel transparente — não quantiza
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = (r << 16) | (g << 8) | b;
    let pc = cache.get(key);
    if (!pc) {
      pc = nearestPaletteColor(r, g, b);
      cache.set(key, pc);
    }
    data[i] = pc.r; data[i + 1] = pc.g; data[i + 2] = pc.b;
  }
}

function addOutline(png) {
  const { width: w, height: h, data } = png;
  // Snapshot alpha original (para não detectar bordas geradas por nós mesmos)
  const alpha = new Uint8Array(w * h);
  for (let i = 0, j = 3; i < alpha.length; i++, j += 4) alpha[i] = data[j];

  const isOpaque = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return alpha[y * w + x] >= 32;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (alpha[idx] >= 16) continue; // já é opaco, ignora
      if (
        isOpaque(x - 1, y) || isOpaque(x + 1, y) ||
        isOpaque(x, y - 1) || isOpaque(x, y + 1)
      ) {
        const di = idx * 4;
        data[di] = 0;
        data[di + 1] = 0;
        data[di + 2] = 0;
        data[di + 3] = 255;
      }
    }
  }
}

// ---------- Seleção de arquivos ----------
const ENTITY_RE = /^(player|enemy|boss|npc)-/;
const files = fs.readdirSync(ROOT)
  .filter((f) => f.endsWith(".png"))
  .filter((f) => ENTITY_RE.test(f))
  .filter((f) => {
    const stat = fs.statSync(path.join(ROOT, f));
    return stat.isFile();
  });

console.log(`Encontradas ${files.length} entidades para processar.`);
if (DRY) console.log("(dry-run — nenhum arquivo será escrito)");

let processed = 0, skipped = 0;
for (const f of files) {
  const full = path.join(ROOT, f);
  let png;
  try {
    png = PNG.sync.read(fs.readFileSync(full));
  } catch (e) {
    console.warn(`SKIP ${f}: ${e.message}`);
    skipped++;
    continue;
  }
  if (png.width > 200 || png.height > 200) {
    // spritesheets — pulam (já foram fatiados)
    skipped++;
    continue;
  }

  if (!SKIP_PALETTE) quantize(png);
  if (!SKIP_OUTLINE) addOutline(png);

  if (!DRY) fs.writeFileSync(full, PNG.sync.write(png));
  processed++;
  if (VERBOSE) console.log(`  OK ${f}`);
}

console.log(`\nDone: ${processed} processados, ${skipped} pulados.`);
console.log(`\nPróximo passo: node scripts/pack-atlas.mjs`);
