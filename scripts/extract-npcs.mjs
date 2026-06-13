/**
 * extract-npcs.mjs
 * Extracts NPC animation frames from the NPC spritesheet.
 *
 * Source: public/assets/sprites/ChatGPT Image 13 de jun. de 2026, 13_12_55.png
 * ~1536×1024, dark background (~#0f0f0f)
 *
 * 3 NPCs stacked vertically:
 *   FAXINEIRO       — main row y≈75,  outros y≈155
 *   ANALISTA-LINKEDIN — main row y≈335, outros y≈415
 *   VETERANO        — main row y≈595, outros y≈675
 *
 * Output: 32×48 transparent PNG per frame
 */

import { Jimp } from 'jimp';
import { copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = resolve(__dirname, '../public/assets/sprites');

const NPC_SHEET = resolve(
  SPRITES_DIR,
  'ChatGPT Image 13 de jun. de 2026, 13_12_55.png'
);

// Output canvas size
const CANVAS_W = 32;
const CANVAS_H = 48;

// Crop window around each frame center
const CROP_W = 80;
const CROP_H = 110;

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

// ─── Helper: find bounding box of non-transparent pixels ─────────────────────
function boundingBox(img) {
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hex = img.getPixelColor(x, y);
      const a = hex & 0xff;
      if (a > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // fully transparent
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// ─── Helper: crop 80×110 around center, strip dark bg, center on 32×48 canvas ─
async function extractFrame(src, cx, cy) {
  const cropX = Math.max(0, Math.round(cx - CROP_W / 2));
  const cropY = Math.max(0, Math.round(cy - CROP_H / 2));
  const actualW = Math.min(CROP_W, src.bitmap.width - cropX);
  const actualH = Math.min(CROP_H, src.bitmap.height - cropY);

  const cropped = src.clone().crop({ x: cropX, y: cropY, w: actualW, h: actualH });
  removeDark(cropped);

  const bb = boundingBox(cropped);
  const canvas = new Jimp({ width: CANVAS_W, height: CANVAS_H, color: 0x00000000 });

  if (!bb) return canvas; // blank / fully transparent frame

  // Crop to content bounding box
  const content = cropped.clone().crop({ x: bb.x, y: bb.y, w: bb.w, h: bb.h });

  // Scale down if content is larger than canvas
  if (bb.w > CANVAS_W || bb.h > CANVAS_H) {
    const scale = Math.min(CANVAS_W / bb.w, CANVAS_H / bb.h);
    content.resize({ w: Math.round(bb.w * scale), h: Math.round(bb.h * scale) });
  }

  // Center on canvas
  const dx = Math.round((CANVAS_W - content.bitmap.width) / 2);
  const dy = Math.round((CANVAS_H - content.bitmap.height) / 2);
  canvas.composite(content, dx, dy);

  return canvas;
}

// ─── Save helper ─────────────────────────────────────────────────────────────
async function save(img, filename) {
  const path = resolve(SPRITES_DIR, filename);
  await img.write(path);
  process.stdout.write(`  ✓ ${filename}\n`);
  return path;
}

// ─── NPC layout ──────────────────────────────────────────────────────────────
// X centers follow the same pattern for all 3 NPCs:
//   idle(3):    ≈60, 110, 160
//   walk(4):    ≈250, 300, 350, 400
//   attack(3):  ≈490, 540, 590
//   special(3): ≈680, 730, 780
//   hurt(2):    ≈870, 920
//   death(3):   ≈1010, 1060, 1110

const IDLE_XS    = [60,  110, 160];
const WALK_XS    = [250, 300, 350, 400];
const ATTACK_XS  = [490, 540, 590];
const SPECIAL_XS = [680, 730, 780];
const HURT_XS    = [870, 920];
const DEATH_XS   = [1010, 1060, 1110];

const NPCS = [
  { prefix: 'npc-faxineiro',        cy: 75  },
  { prefix: 'npc-analista-linkedin', cy: 335 },
  { prefix: 'npc-veterano',          cy: 595 },
];

const ANIM_SECTIONS = [
  { name: 'idle',    xs: IDLE_XS },
  { name: 'walk',    xs: WALK_XS },
  { name: 'attack',  xs: ATTACK_XS },
  { name: 'special', xs: SPECIAL_XS },
  { name: 'hurt',    xs: HURT_XS },
  { name: 'death',   xs: DEATH_XS },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n── NPC Sprites ──────────────────────────────────────────────');
  const src = await Jimp.read(NPC_SHEET);
  console.log(`  Loaded: ${src.bitmap.width}×${src.bitmap.height}`);

  for (const npc of NPCS) {
    console.log(`\n  [${npc.prefix}]`);
    let idle0Path = null;

    for (const anim of ANIM_SECTIONS) {
      for (let i = 0; i < anim.xs.length; i++) {
        const cx = anim.xs[i];
        const cy = npc.cy;
        const frame = await extractFrame(src, cx, cy);
        const filename = `${npc.prefix}-${anim.name}${i}.png`;
        const path = await save(frame, filename);
        if (anim.name === 'idle' && i === 0) {
          idle0Path = path;
        }
      }
    }

    // Backward-compat alias: npc-faxineiro.png etc → idle0
    if (idle0Path) {
      const dest = resolve(SPRITES_DIR, `${npc.prefix}.png`);
      copyFileSync(idle0Path, dest);
      process.stdout.write(`  ✓ ${npc.prefix}.png → idle0\n`);
    }
  }

  console.log('\n✓ Done.\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
