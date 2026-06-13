/**
 * extract-objects.mjs
 * Extracts 21 interactive office objects from the sprite sheet, each with 5 states.
 *
 * Source: public/assets/sprites/ChatGPT Image 12 de jun. de 2026, 22_10_34.png (1536x1024)
 * Frame size: 32x32px each
 * States: IDLE, USE, ACTIVE, BROKEN, DESTROYED
 */

import { Jimp } from 'jimp';
import { copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = resolve(__dirname, '../public/assets/sprites');
const SOURCE = resolve(SPRITES_DIR, 'ChatGPT Image 12 de jun. de 2026, 22_10_34.png');

// ─── Helper: remove dark background pixels ───────────────────────────────────
function removeDark(img) {
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hex = img.getPixelColor(x, y);
      const r = (hex >>> 24) & 0xff;
      const g = (hex >>> 16) & 0xff;
      const b = (hex >>> 8) & 0xff;
      if (r < 60 && g < 60 && b < 60) {
        img.setPixelColor(0x00000000, x, y);
      }
    }
  }
  return img;
}

// ─── Object definitions ───────────────────────────────────────────────────────
// Each entry: [slug, centerY, canvasW, canvasH]
// centerX for each state: IDLE=60, USE=160, ACTIVE=260, BROKEN=360, DESTROYED=460
const OBJECTS = [
  ['caneca',            65,  24, 24],
  ['teclado',          110,  32, 32],
  ['mouse',            155,  32, 32],
  ['monitor',          200,  40, 32],
  ['pilha-papel',      245,  32, 32],
  ['postit',           290,  24, 24],
  ['foto-familia',     335,  32, 32],
  ['cracha',           380,  20, 28],
  ['cafeteira',        425,  32, 40],
  ['porta-saida',      470,  36, 60],
  ['elevador',         515,  32, 56],
  ['impressora',       560,  36, 40],
  ['relogio',          605,  28, 28],
  ['quadro-motivacional', 650, 48, 56],
  ['lixeira',          695,  24, 32],
  ['bomba-energia',    740,  28, 36],
  ['chave-inglesa',    785,  28, 16],
  ['pen-drive',        830,  20, 12],
  ['documento',        875,  28, 36],
  ['caixa-arquivos',   920,  36, 32],
  ['planta-empresa',   965,  32, 40],
];

const STATES = [
  ['idle',      60],
  ['use',      160],
  ['active',   260],
  ['broken',   360],
  ['destroyed',460],
];

// Crop region size around each frame center
const CROP_W = 100;
const CROP_H = 80;

async function main() {
  console.log('Loading source image...');
  const src = await Jimp.read(SOURCE);
  console.log(`Source: ${src.bitmap.width}x${src.bitmap.height}`);

  for (const [slug, centerY, canvasW, canvasH] of OBJECTS) {
    for (const [state, centerX] of STATES) {
      // Crop 100x80 region centered at frame position
      const cropX = Math.max(0, centerX - CROP_W / 2);
      const cropY = Math.max(0, centerY - CROP_H / 2);
      const actualCropX = Math.min(cropX, src.bitmap.width - CROP_W);
      const actualCropY = Math.min(cropY, src.bitmap.height - CROP_H);

      const cropped = src.clone().crop({
        x: actualCropX,
        y: actualCropY,
        w: CROP_W,
        h: CROP_H,
      });

      // Remove dark background
      removeDark(cropped);

      // Resize to fit canvas (maintaining aspect ratio within canvas bounds)
      const scaleX = canvasW / CROP_W;
      const scaleY = canvasH / CROP_H;
      const scale = Math.min(scaleX, scaleY);
      const fittedW = Math.round(CROP_W * scale);
      const fittedH = Math.round(CROP_H * scale);

      cropped.resize({ w: fittedW, h: fittedH });

      // Place onto canvas
      const canvas = new Jimp({ width: canvasW, height: canvasH, color: 0x00000000 });
      const dx = Math.floor((canvasW - fittedW) / 2);
      const dy = Math.floor((canvasH - fittedH) / 2);
      canvas.composite(cropped, dx, dy);

      const outPath = resolve(SPRITES_DIR, `obj-${slug}-${state}.png`);
      await canvas.write(outPath);
      console.log(`  Saved ${outPath.split('/').pop()}`);
    }
  }

  // ─── Backward-compat aliases ────────────────────────────────────────────────
  console.log('\nCreating backward-compat aliases...');
  const aliases = [
    ['obj-impressora.png',   'obj-impressora-idle.png'],
    ['obj-porta-reuniao.png','obj-porta-saida-idle.png'],
    ['obj-elevador.png',     'obj-elevador-idle.png'],
    ['obj-cafe-machine.png', 'obj-cafeteira-idle.png'],
  ];

  for (const [alias, source] of aliases) {
    const srcPath = resolve(SPRITES_DIR, source);
    const dstPath = resolve(SPRITES_DIR, alias);
    if (existsSync(srcPath)) {
      copyFileSync(srcPath, dstPath);
      console.log(`  ${alias} → ${source}`);
    } else {
      console.warn(`  WARNING: source not found for alias ${alias}: ${source}`);
    }
  }

  console.log('\nDone! All object sprites extracted.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
