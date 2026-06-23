/**
 * Extracts CEO boss frames from the chefao/ spritesheet collection.
 *
 * Source sheets (2400×1599):
 *   78gc1a  — CORRENDO (run): 6 cols × 2 rows
 *   j4ttvej  — ATAQUE DEADLINE CANNON: 4 cols × 4 rows
 *   jpma0n  — DADOS + ESPECIAL RELATÓRIOS: 4 cols × 3 rows
 *
 * Output: boss-ceo-run0..5, boss-ceo-attack0..3, boss-ceo-special0..3
 * Outputs to public/assets/sprites/ (same dir as rest of atlas sources).
 */

import { Jimp } from 'jimp';
import { join } from 'path';

const CHEFAO = 'public/assets/sprites/chefao';
const OUT    = 'public/assets/sprites';
const OUT_PX = 128; // CEO is larger than regular enemies (player is 80px)

// Remove near-black background pixels (sheets have dark bg)
function removeDark(img) {
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    if (r < 55 && g < 55 && b < 55) {
      this.bitmap.data[idx + 3] = 0;
    }
  });
  return img;
}

async function extractRow(srcPath, prefix, cols, topY, rowH, row = 0) {
  const src = await Jimp.read(srcPath);
  const W   = src.bitmap.width;
  const fW  = Math.floor(W / cols);
  const y0  = topY + row * rowH;

  for (let col = 0; col < cols; col++) {
    const x0 = col * fW;
    const cropped = src.clone().crop({ x: x0, y: y0, w: fW, h: rowH });
    removeDark(cropped);

    // Scale to fit OUT_PX × OUT_PX keeping aspect ratio
    const ratio = Math.min(OUT_PX / fW, OUT_PX / rowH);
    const dstW  = Math.round(fW  * ratio);
    const dstH  = Math.round(rowH * ratio);
    cropped.resize({ w: dstW, h: dstH });

    // Place on transparent OUT_PX × OUT_PX canvas (bottom-centred)
    const canvas = new Jimp({ width: OUT_PX, height: OUT_PX, color: 0x00000000 });
    const dx = Math.floor((OUT_PX - dstW) / 2);
    const dy = OUT_PX - dstH; // align feet to bottom
    canvas.composite(cropped, dx, dy);

    const outFile = join(OUT, `${prefix}${col}.png`);
    await canvas.write(outFile);
    console.log('  wrote', outFile);
  }
}

// ─── Run animation (78gc1a, 6×2 grid) ──────────────────────────────────────
// Row 0: y≈110, height≈695; Row 1: y≈890, height≈700
console.log('\n[1/3] Extracting run frames…');
const RUN_SRC = `${CHEFAO}/Gemini_Generated_Image_78gc1a78gc1a78gc-Photoroom.png`;
await extractRow(RUN_SRC, 'boss-ceo-run', 6, 110, 695, 0);

// ─── Deadline Cannon attack (j4ttvej, 4×4 grid) ────────────────────────────
// Row 0 (windup frames): y≈100, height≈375
console.log('\n[2/3] Extracting attack frames…');
const ATK_SRC = `${CHEFAO}/Gemini_Generated_Image_j4ttvej4ttvej4tt-Photoroom.png`;
await extractRow(ATK_SRC, 'boss-ceo-attack', 4, 100, 375, 0);

// ─── Special attack / Dados (jpma0n, 4×3 grid) ─────────────────────────────
// Row 0 (dados presentation): y≈80, height≈420
console.log('\n[3/3] Extracting special frames…');
const SPL_SRC = `${CHEFAO}/Gemini_Generated_Image_jpma0njpma0njpma-Photoroom.png`;
await extractRow(SPL_SRC, 'boss-ceo-special', 4, 80, 420, 0);

console.log('\nDone! Repack atlas with: node scripts/pack-atlas.mjs');
