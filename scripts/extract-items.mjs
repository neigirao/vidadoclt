/**
 * extract-items.mjs
 * Extracts 6 collectible item sprites from the sprite sheet, each with 4 states × 3 frames.
 *
 * Source: public/assets/sprites/ChatGPT Image 13 de jun. de 2026, 13_08_31.png (~960x720)
 * Background: very dark (~#0f0f0f)
 *
 * Layout (rows top-to-bottom):
 *   1. VR-COIN    centerY≈55,  frameSize ~40x40
 *   2. COFFEE-CUP centerY≈160, frameSize ~32x40
 *   3. POSTIT      centerY≈265, frameSize ~32x32
 *   4. CONVITE     centerY≈370, frameSize ~40x28
 *   5. EMAIL       centerY≈475, frameSize ~36x28
 *   6. CAFÉ (mug)  centerY≈580, frameSize ~36x36
 *
 * State columns (4 states × 3 frames each):
 *   State 1 (index 0): x centers ≈ 80, 140, 200
 *   State 2 (index 1): x centers ≈ 310, 370, 430
 *   State 3 (index 2): x centers ≈ 540, 600, 660
 *   State 4 (index 3): x centers ≈ 760, 820, 880
 */

import { Jimp } from 'jimp';
import { copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = resolve(__dirname, '../public/assets/sprites');
const SOURCE = resolve(SPRITES_DIR, 'ChatGPT Image 13 de jun. de 2026, 13_08_31.png');

// ─── Helper: remove dark background pixels ────────────────────────────────────
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

// ─── Item definitions ─────────────────────────────────────────────────────────
// [slug, centerY, canvasW, canvasH, [state0Name, state1Name, state2Name, state3Name]]
const ITEMS = [
  ['vr-coin',    55,  40, 40, ['idle', 'active', 'used',     'broken']],
  ['coffee-cup', 160, 32, 40, ['idle', 'active', 'empty',    'broken']],
  ['postit',     265, 32, 32, ['idle', 'active', 'expired',  'torn']],
  ['convite',    370, 40, 28, ['idle', 'accepted','expired', 'rejected']],
  ['email',      475, 36, 28, ['idle', 'unread',  'read',    'deleted']],
  ['cafe',       580, 36, 36, ['idle', 'hot',     'cold',    'empty']],
];

// X centers for each frame within each state group
const STATE_X_CENTERS = [
  [80,  140, 200],  // state 0
  [310, 370, 430],  // state 1
  [540, 600, 660],  // state 2
  [760, 820, 880],  // state 3
];

// Crop region size around each frame center
const CROP_W = 80;
const CROP_H = 80;

async function main() {
  console.log('Loading source image...');
  const src = await Jimp.read(SOURCE);
  console.log(`Source: ${src.bitmap.width}x${src.bitmap.height}`);

  for (const [slug, centerY, canvasW, canvasH, stateNames] of ITEMS) {
    console.log(`\nExtracting item: ${slug}`);

    for (let stateIdx = 0; stateIdx < 4; stateIdx++) {
      const stateName = stateNames[stateIdx];
      const xCenters = STATE_X_CENTERS[stateIdx];

      for (let frameIdx = 0; frameIdx < 3; frameIdx++) {
        const centerX = xCenters[frameIdx];

        // Crop 80x80 region centered at frame position, clamped to image bounds
        const cropX = Math.max(0, Math.min(centerX - CROP_W / 2, src.bitmap.width - CROP_W));
        const cropY = Math.max(0, Math.min(centerY - CROP_H / 2, src.bitmap.height - CROP_H));

        const cropped = src.clone().crop({
          x: cropX,
          y: cropY,
          w: CROP_W,
          h: CROP_H,
        });

        // Remove dark background
        removeDark(cropped);

        // Find content bounding box
        let minX = CROP_W, minY = CROP_H, maxX = 0, maxY = 0;
        let hasContent = false;
        for (let py = 0; py < CROP_H; py++) {
          for (let px = 0; px < CROP_W; px++) {
            const hex = cropped.getPixelColor(px, py);
            const alpha = hex & 0xff;
            if (alpha > 0) {
              if (px < minX) minX = px;
              if (px > maxX) maxX = px;
              if (py < minY) minY = py;
              if (py > maxY) maxY = py;
              hasContent = true;
            }
          }
        }

        // Place content onto appropriately-sized canvas
        const canvas = new Jimp({ width: canvasW, height: canvasH, color: 0x00000000 });

        if (hasContent) {
          const contentW = maxX - minX + 1;
          const contentH = maxY - minY + 1;

          // Crop to content bounding box
          const content = cropped.clone().crop({
            x: minX,
            y: minY,
            w: contentW,
            h: contentH,
          });

          // Scale to fit within canvas while preserving aspect ratio
          const scaleX = canvasW / contentW;
          const scaleY = canvasH / contentH;
          const scale = Math.min(scaleX, scaleY, 1.5); // cap upscale at 1.5x
          const fittedW = Math.round(contentW * scale);
          const fittedH = Math.round(contentH * scale);

          content.resize({ w: fittedW, h: fittedH });

          const dx = Math.floor((canvasW - fittedW) / 2);
          const dy = Math.floor((canvasH - fittedH) / 2);
          canvas.composite(content, dx, dy);
        } else {
          console.warn(`    WARNING: no content found for ${slug}-${stateName}${frameIdx}`);
        }

        const outPath = resolve(SPRITES_DIR, `item-${slug}-${stateName}${frameIdx}.png`);
        await canvas.write(outPath);
        console.log(`  Saved item-${slug}-${stateName}${frameIdx}.png`);
      }
    }

    // Backward-compat alias: item-<slug>.png = idle0
    const aliasSrc = resolve(SPRITES_DIR, `item-${slug}-idle0.png`);
    const aliasDst = resolve(SPRITES_DIR, `item-${slug}.png`);
    copyFileSync(aliasSrc, aliasDst);
    console.log(`  Created alias: item-${slug}.png → item-${slug}-idle0.png`);
  }

  // ─── Additional backward-compat aliases ──────────────────────────────────────
  console.log('\nCreating additional backward-compat aliases...');

  // item-vr.png = item-vr-coin-idle0.png
  copyFileSync(
    resolve(SPRITES_DIR, 'item-vr-coin-idle0.png'),
    resolve(SPRITES_DIR, 'item-vr.png')
  );
  console.log('  item-vr.png → item-vr-coin-idle0.png');

  // item-inkproj.png = item-cafe-idle0.png (placeholder)
  copyFileSync(
    resolve(SPRITES_DIR, 'item-cafe-idle0.png'),
    resolve(SPRITES_DIR, 'item-inkproj.png')
  );
  console.log('  item-inkproj.png → item-cafe-idle0.png');

  console.log('\nDone! All collectible item sprites extracted.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
