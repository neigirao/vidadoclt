/**
 * extract-all-enemies.mjs
 * Extracts individual animation frames for enemies 5-21 from the complete
 * enemy reference sheet: "ChatGPT Image 12 de jun. de 2026, 22_10_45.png"
 * (1717×916, dark background ~#0f0f0f)
 *
 * Each enemy row is ~40px tall. Frame size output: 32×48px.
 * Enemies 1-4 (estagiario, analista, facilitador, scrum, coordenador) are
 * already extracted from a previous script, so we skip them here.
 */

import { Jimp } from 'jimp';
import { copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = resolve(__dirname, '../public/assets/sprites');

const SOURCE_SHEET = resolve(
  SPRITES_DIR,
  'ChatGPT Image 12 de jun. de 2026, 22_10_45.png'
);

const CANVAS_W = 32;
const CANVAS_H = 48;

// ─── Frame X centers per animation section ───────────────────────────────────
// From the task description:
// IDLE frames (2-4): x≈ 60, 100, 140, 180
// WALK frames (2-4): x≈ 240, 280, 320, 360
// ATTACK frames (2-3): x≈ 430, 470, 510
// HURT (1): x≈ 580
// DEATH frames (2-3): x≈ 650, 690, 730

const IDLE_XS   = [60, 100, 140, 180];
const WALK_XS   = [240, 280, 320, 360];
const ATTACK_XS = [430, 470, 510];
const HURT_XS   = [580];
const DEATH_XS  = [650, 690, 730];

const ANIM_SECTIONS = [
  { name: 'idle',   xs: IDLE_XS },
  { name: 'walk',   xs: WALK_XS },
  { name: 'attack', xs: ATTACK_XS },
  { name: 'hurt',   xs: HURT_XS },
  { name: 'death',  xs: DEATH_XS },
];

// ─── Enemy definitions: prefix + Y center ────────────────────────────────────
// Enemies 1-5 from the task description are skipped.
// Row spacing: each row ~40px apart, starting at y≈70.
// We only process enemies 5-21 (0-indexed as enemies[4] through enemies[20]).
//
// From the task:
//  5. Analista Sênior Exausto:    y≈250  → prefix: enemy-senior
//  6. Coordenador de Sinergia:    y≈295  (SKIP - already done)
//  7. Telemarketer Zumbi:         y≈340  → prefix: enemy-telemarketer
//  8. Impressora Assombrada:      y≈385  → prefix: enemy-impressora
//  9. Guardião do Café:           y≈430  → prefix: enemy-guardiao-cafe  (also save alias)
// 10. Cabo de Rede Vivo:          y≈475  → prefix: enemy-cabo
// 11. Evangelista Corporativo:    y≈520  → prefix: enemy-evangelista
// 12. Segurança Corporativa:      y≈565  → prefix: enemy-seguranca
// 13. TI Suporte Nível 1:         y≈610  → prefix: enemy-ti-suporte
// 14. Coletor de Dados:           y≈655  → prefix: enemy-coletor
// 15. Notice Board Sentinela:     y≈700  → prefix: enemy-noticeboard
// 16. Drone de Vigilância:        y≈745  → prefix: enemy-drone
// 17. Carimbador Automático:      y≈790  → prefix: enemy-carimbador
// 18. Planilha Viva:              y≈835  → prefix: enemy-planilha
// 19. Arquivo Ambulante:          y≈880  → prefix: enemy-arquivo
// 20. Bateria Social:             y≈925  → prefix: enemy-bateria
// 21. Reunião Infinita:           y≈970  → prefix: enemy-reuniao  (also save alias)

const ENEMIES = [
  { prefix: 'enemy-senior',       cy: 250, alias: false },
  // enemy 6 (coordenador) skipped
  { prefix: 'enemy-telemarketer', cy: 340, alias: false },
  { prefix: 'enemy-impressora',   cy: 385, alias: false },
  { prefix: 'enemy-guardiao-cafe',cy: 430, alias: true  },
  { prefix: 'enemy-cabo',         cy: 475, alias: false },
  { prefix: 'enemy-evangelista',  cy: 520, alias: false },
  { prefix: 'enemy-seguranca',    cy: 565, alias: false },
  { prefix: 'enemy-ti-suporte',   cy: 610, alias: false },
  { prefix: 'enemy-coletor',      cy: 655, alias: false },
  { prefix: 'enemy-noticeboard',  cy: 700, alias: false },
  { prefix: 'enemy-drone',        cy: 745, alias: false },
  { prefix: 'enemy-carimbador',   cy: 790, alias: false },
  { prefix: 'enemy-planilha',     cy: 835, alias: false },
  { prefix: 'enemy-arquivo',      cy: 880, alias: false },
  { prefix: 'enemy-bateria',      cy: 925, alias: false },
  { prefix: 'enemy-reuniao',      cy: 970, alias: true  },
];

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
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// ─── Helper: crop 80×100 around center, strip dark bg, center on canvas ──────
async function extractFrame(src, cx, cy, canvasW, canvasH) {
  const CROP_W = 80;
  const CROP_H = 100;

  const cropX = Math.max(0, Math.round(cx - CROP_W / 2));
  const cropY = Math.max(0, Math.round(cy - CROP_H / 2));
  const actualW = Math.min(CROP_W, src.bitmap.width - cropX);
  const actualH = Math.min(CROP_H, src.bitmap.height - cropY);

  if (actualW <= 0 || actualH <= 0) {
    return new Jimp({ width: canvasW, height: canvasH, color: 0x00000000 });
  }

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

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n── Loading source sheet ─────────────────────────────────────');
  const src = await Jimp.read(SOURCE_SHEET);
  console.log(`  Loaded: ${src.bitmap.width}×${src.bitmap.height}`);

  for (const enemy of ENEMIES) {
    console.log(`\n  [${enemy.prefix}] cy=${enemy.cy}`);
    let idle0Path = null;

    for (const anim of ANIM_SECTIONS) {
      for (let i = 0; i < anim.xs.length; i++) {
        const cx = anim.xs[i];
        const cy = enemy.cy;
        const frame = await extractFrame(src, cx, cy, CANVAS_W, CANVAS_H);
        const filename = `${enemy.prefix}-${anim.name}${i}.png`;
        const path = await save(frame, filename);
        if (anim.name === 'idle' && i === 0) {
          idle0Path = path;
        }
      }
    }

    // Save <prefix>.png as alias of idle0 for enemies that need it
    // (enemy-senior.png already exists, but refresh it; guardiao-cafe and reuniao are new)
    if (idle0Path) {
      const destFilename = `${enemy.prefix}.png`;
      const dest = resolve(SPRITES_DIR, destFilename);
      copyFileSync(idle0Path, dest);
      process.stdout.write(`  ✓ ${destFilename} → idle0\n`);
    }
  }

  console.log('\n✓ Done.\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
