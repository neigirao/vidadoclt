/**
 * extract-enemies.mjs
 * Extracts individual animation frames from enemy spritesheets.
 *
 * Source spritesheets:
 *   - Phase 1 enemies (1536×1024): 5 enemies, 32×48 output frames
 *   - Boss Gerente (1536×1024): 64×64 output frames
 */

import { Jimp } from 'jimp';
import { copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = resolve(__dirname, '../public/assets/sprites');

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

// ─── Helper: crop 90×130 around center, strip dark bg, center on canvas ──────
async function extractFrame(src, cx, cy, canvasW, canvasH) {
  const CROP_W = 90;
  const CROP_H = 130;

  const cropX = Math.max(0, Math.round(cx - CROP_W / 2));
  const cropY = Math.max(0, Math.round(cy - CROP_H / 2));
  const actualW = Math.min(CROP_W, src.bitmap.width - cropX);
  const actualH = Math.min(CROP_H, src.bitmap.height - cropY);

  const cropped = src.clone().crop({ x: cropX, y: cropY, w: actualW, h: actualH });
  removeDark(cropped);

  const bb = boundingBox(cropped);
  const canvas = new Jimp({ width: canvasW, height: canvasH, color: 0x00000000 });

  if (!bb) return canvas; // blank frame

  // Crop to content bounding box
  const content = cropped.clone().crop({ x: bb.x, y: bb.y, w: bb.w, h: bb.h });

  // Scale down if content is larger than canvas
  if (bb.w > canvasW || bb.h > canvasH) {
    const scale = Math.min(canvasW / bb.w, canvasH / bb.h);
    content.resize({ w: Math.round(bb.w * scale), h: Math.round(bb.h * scale) });
  }

  // Center on canvas
  const dx = Math.round((canvasW - content.bitmap.width) / 2);
  const dy = Math.round((canvasH - content.bitmap.height) / 2);
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

// ─── Phase 1 enemies spritesheet ─────────────────────────────────────────────
// 1536×1024, frame size 32×48
// Layout (approximate centers):
//   IDLE×4: x≈60,145,230,315  WALK×4: x≈430,515,600,685
//   ATTACK×3: x≈790,875,960   HURT×1: x≈1065  DEATH×3: x≈1175,1260,1345

const ENEMY_SHEET = resolve(
  SPRITES_DIR,
  'ChatGPT Image 12 de jun. de 2026, 22_07_15.png'
);

const ENEMY_FRAME_W = 32;
const ENEMY_FRAME_H = 48;

// X centers for each animation section
const IDLE_XS   = [60, 145, 230, 315];
const WALK_XS   = [430, 515, 600, 685];
const ATTACK_XS = [790, 875, 960];
const HURT_XS   = [1065];
const DEATH_XS  = [1175, 1260, 1345];

const ENEMIES = [
  { prefix: 'enemy-estagiario', cy: 120 },
  { prefix: 'enemy-analista',   cy: 290 },
  { prefix: 'enemy-facilitador', cy: 460 },
  { prefix: 'enemy-scrum',      cy: 630 },
  { prefix: 'enemy-coordenador', cy: 800 },
];

const ANIM_SECTIONS = [
  { name: 'idle',   xs: IDLE_XS },
  { name: 'walk',   xs: WALK_XS },
  { name: 'attack', xs: ATTACK_XS },
  { name: 'hurt',   xs: HURT_XS },
  { name: 'death',  xs: DEATH_XS },
];

async function extractEnemies() {
  console.log('\n── Phase 1 Enemies ──────────────────────────────────────────');
  const src = await Jimp.read(ENEMY_SHEET);
  console.log(`  Loaded: ${src.bitmap.width}×${src.bitmap.height}`);

  const idlePaths = {}; // track idle0 for aliases

  for (const enemy of ENEMIES) {
    console.log(`\n  [${enemy.prefix}]`);
    for (const anim of ANIM_SECTIONS) {
      for (let i = 0; i < anim.xs.length; i++) {
        const cx = anim.xs[i];
        const cy = enemy.cy;
        const frame = await extractFrame(src, cx, cy, ENEMY_FRAME_W, ENEMY_FRAME_H);
        const filename = `${enemy.prefix}-${anim.name}${i}.png`;
        const path = await save(frame, filename);
        if (anim.name === 'idle' && i === 0) {
          idlePaths[enemy.prefix] = path;
        }
      }
    }
  }

  // Backward-compat aliases (copy idle0)
  console.log('\n  [aliases]');
  for (const enemy of ENEMIES) {
    const src0 = idlePaths[enemy.prefix];
    const dest = resolve(SPRITES_DIR, `${enemy.prefix}.png`);
    copyFileSync(src0, dest);
    process.stdout.write(`  ✓ ${enemy.prefix}.png → idle0\n`);
  }
}

// ─── Boss Gerente spritesheet ─────────────────────────────────────────────────
// 1536×1024, frame size 64×64 (canvas 44×56)
//
// Row 1 y≈100: IDLE(2), WALK(4), RUN(4), RUN-CHARGE(3)
// Row 2 y≈270: ATTACK-DEADLINE(4), ATTACK-ESCOPO(4), ATTACK-SPRINT(3)
// Row 3 y≈430: HURT(3), DEATH(3)
// Row 4 y≈590: PROVOCANDO(3), VICTORY(4), APONTANDO(3), USANDO-TABLET(3)
//
// Frames are 64px wide, spaced ~85px apart horizontally (similar to enemies)
// Start near x=60, step ~85px

const BOSS_SHEET = resolve(
  SPRITES_DIR,
  'ChatGPT Image 12 de jun. de 2026, 22_09_24.png'
);

const BOSS_CANVAS_W = 44;
const BOSS_CANVAS_H = 56;

// Build x-center sequences for the boss sheet
// Each frame ~85px apart, starting at ~60
function bossXs(count, startIndex = 0) {
  const xs = [];
  for (let i = 0; i < count; i++) {
    xs.push(60 + (startIndex + i) * 85);
  }
  return xs;
}

// Row 1 (y≈100): IDLE(2) WALK(4) RUN(4) RUN-CHARGE(3) — 13 frames total
// Row 2 (y≈270): ATTACK-DEADLINE(4) ATTACK-ESCOPO(4) ATTACK-SPRINT(3) — 11 frames
// Row 3 (y≈430): HURT(3) DEATH(3) — 6 frames
// Row 4 (y≈590): PROVOCANDO(3) VICTORY(4) APONTANDO(3) USANDO-TABLET(3) — 13 frames

const BOSS_ANIMS = [
  // Row 1
  { name: 'idle',        cy: 100, xs: bossXs(2, 0) },
  { name: 'walk',        cy: 100, xs: bossXs(4, 2) },
  { name: 'run',         cy: 100, xs: bossXs(4, 6) },
  { name: 'run-charge',  cy: 100, xs: bossXs(3, 10) },
  // Row 2
  { name: 'attack-deadline', cy: 270, xs: bossXs(4, 0) },
  { name: 'attack-escopo',   cy: 270, xs: bossXs(4, 4) },
  { name: 'attack-sprint',   cy: 270, xs: bossXs(3, 8) },
  // Row 3
  { name: 'hurt',  cy: 430, xs: bossXs(3, 0) },
  { name: 'death', cy: 430, xs: bossXs(3, 3) },
];

async function extractBoss() {
  console.log('\n── Boss Gerente ─────────────────────────────────────────────');
  const src = await Jimp.read(BOSS_SHEET);
  console.log(`  Loaded: ${src.bitmap.width}×${src.bitmap.height}`);

  let idle0Path = null;

  for (const anim of BOSS_ANIMS) {
    console.log(`\n  [enemy-gerente-${anim.name}]`);
    for (let i = 0; i < anim.xs.length; i++) {
      const cx = anim.xs[i];
      const cy = anim.cy;
      const frame = await extractFrame(src, cx, cy, BOSS_CANVAS_W, BOSS_CANVAS_H);
      const filename = `enemy-gerente-${anim.name}${i}.png`;
      const path = await save(frame, filename);
      if (anim.name === 'idle' && i === 0) {
        idle0Path = path;
      }
    }
  }

  // Backward-compat alias
  if (idle0Path) {
    const dest = resolve(SPRITES_DIR, 'enemy-gerente.png');
    copyFileSync(idle0Path, dest);
    process.stdout.write(`  ✓ enemy-gerente.png → idle0\n`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await extractEnemies();
  await extractBoss();
  console.log('\n✓ Done.\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
