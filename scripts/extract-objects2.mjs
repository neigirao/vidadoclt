/**
 * extract-objects2.mjs
 * Extracts interactive office objects with state animations from the new sprite sheet.
 *
 * Source: public/assets/sprites/ChatGPT Image 13 de jun. de 2026, 13_11_00.png (~1536x1024)
 * Background: very dark (~#0f0f0f) — pixels with R<60 AND G<60 AND B<60 become transparent.
 *
 * Crop region: 100x120 centered at each frame's (centerX, centerY)
 * Objects are arranged in a grid with multiple state frames per row.
 */

import { Jimp } from 'jimp';
import { copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = resolve(__dirname, '../public/assets/sprites');
const SOURCE = resolve(SPRITES_DIR, 'ChatGPT Image 13 de jun. de 2026, 13_11_00.png');

// Crop region size around each frame center
const CROP_W = 100;
const CROP_H = 120;

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
// Format: [slug, centerY, canvasW, canvasH, [[stateName, centerX], ...]]

const OBJECTS = [
  // Row 1 (y≈70)
  [
    'bebedouro', 70, 32, 48,
    [
      ['idle',      60],
      ['uso',      110],
      ['vazio',    160],
      ['quebrado', 210],
      ['destruido',260],
    ],
  ],
  [
    'cafe-machine', 70, 32, 40,
    [
      ['idle',       360],
      ['preparando', 410],
      ['pronto',     460],
      ['sem-cafe',   510],
      ['quebrada',   560],
    ],
  ],

  // Row 2 (y≈160)
  [
    'impressora', 160, 36, 40,
    [
      ['idle',       60],
      ['imprimindo', 115],
      ['atascada',   170],
      ['sem-papel',  225],
      ['quebrada',   280],
    ],
  ],
  [
    'porta-saida', 160, 32, 56,
    [
      ['fechada',   380],
      ['aberta',    430],
      ['bloqueada', 480],
      ['alarme',    530],
      ['manutencao',580],
      ['cadeado',   630],
    ],
  ],

  // Row 3 (y≈275)
  [
    'elevador', 275, 32, 56,
    [
      ['idle',      60],
      ['abrindo',  110],
      ['aberto',   160],
      ['subindo',  210],
      ['descendo', 260],
    ],
  ],
  [
    'monitor', 275, 44, 32,
    [
      ['idle',          380],
      ['ativo',         440],
      ['luz',           500],
      ['desligado',     560],
      ['tela-azul',     620],
      ['desconectado',  680],
    ],
  ],

  // Row 4 (y≈370)
  [
    'mesa', 370, 64, 40,
    [
      ['idle',           70],
      ['ocupada',       150],
      ['baguncada',     230],
      ['muito-baguncada',310],
      ['destruida',     390],
    ],
  ],
  [
    'quadro-branco', 370, 48, 40,
    [
      ['idle',       510],
      ['escrevendo', 570],
      ['cheio',      630],
      ['apagando',   690],
      ['destruido',  750],
    ],
  ],

  // Row 5 (y≈455)
  [
    'lixeira', 455, 24, 32,
    [
      ['idle',          60],
      ['com-papel',    100],
      ['cheia',        140],
      ['transbordando',180],
      ['destruida',    220],
    ],
  ],
  [
    'arquivo', 455, 36, 44,
    [
      ['idle',      320],
      ['aberto',    375],
      ['vazio',     430],
      ['baguncado', 485],
      ['destruido', 540],
    ],
  ],

  // Row 6 (y≈540) — ficheiro only (porta variant skipped, duplicates row 2)
  [
    'ficheiro', 540, 28, 36,
    [
      ['idle',      420],
      ['digitando', 470],
      ['acesso',    520],
      ['bloqueado', 570],
      ['destruido', 620],
    ],
  ],
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Loading source image...');
  const src = await Jimp.read(SOURCE);
  console.log(`Source: ${src.bitmap.width}x${src.bitmap.height}`);

  for (const [slug, centerY, canvasW, canvasH, states] of OBJECTS) {
    for (const [state, centerX] of states) {
      // Crop 100x120 centered at frame position, clamped to image bounds
      const rawCropX = centerX - Math.floor(CROP_W / 2);
      const rawCropY = centerY - Math.floor(CROP_H / 2);
      const cropX = Math.max(0, Math.min(rawCropX, src.bitmap.width  - CROP_W));
      const cropY = Math.max(0, Math.min(rawCropY, src.bitmap.height - CROP_H));

      const cropped = src.clone().crop({ x: cropX, y: cropY, w: CROP_W, h: CROP_H });

      // Remove dark background
      removeDark(cropped);

      // Scale to fit canvas (preserve aspect ratio)
      const scale = Math.min(canvasW / CROP_W, canvasH / CROP_H);
      const fittedW = Math.round(CROP_W * scale);
      const fittedH = Math.round(CROP_H * scale);
      cropped.resize({ w: fittedW, h: fittedH });

      // Center onto transparent canvas
      const canvas = new Jimp({ width: canvasW, height: canvasH, color: 0x00000000 });
      const dx = Math.floor((canvasW - fittedW) / 2);
      const dy = Math.floor((canvasH - fittedH) / 2);
      canvas.composite(cropped, dx, dy);

      const outPath = resolve(SPRITES_DIR, `obj-${slug}-${state}.png`);
      await canvas.write(outPath);
      console.log(`  Saved obj-${slug}-${state}.png`);
    }
  }

  // ─── Backward-compat aliases ────────────────────────────────────────────────
  console.log('\nCreating backward-compat aliases...');
  const aliases = [
    ['obj-bebedouro.png',    'obj-bebedouro-idle.png'],
    ['obj-cafe-machine.png', 'obj-cafe-machine-idle.png'],
    ['obj-impressora.png',   'obj-impressora-idle.png'],
    ['obj-porta-reuniao.png','obj-porta-saida-fechada.png'],
    ['obj-elevador.png',     'obj-elevador-idle.png'],
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
