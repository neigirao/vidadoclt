import { Jimp } from 'jimp';
import { copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = join(__dirname, '../public/assets/sprites/');
const SOURCE = join(SPRITES_DIR, 'ChatGPT Image 12 de jun. de 2026, 22_07_12.png');

// Frame extraction region size (centered on each frame)
const CROP_W = 110;
const CROP_H = 140;

// Output frame size
const OUT_W = 48;
const OUT_H = 64;

// Background removal threshold: R<60 AND G<60 AND B<60 → transparent
const BG_THRESHOLD = 60;

// ── Row Y starts (top of the 140px crop window) ──────────────────────────────
// Row 1: y≈155 (IDLE×6, WALK×8, RUN×8)
const ROW1_Y = 155;
// Row 2: y≈320 (JUMP×4, FALL×3, ATTACK×6, DASH×4)
const ROW2_Y = 320;
// Row 3: y≈490 (HURT×2, INTERACT×3, BURNOUT×4)
const ROW3_Y = 490;

// ── Approximate frame X-center positions ─────────────────────────────────────
// Row 1 x-centers (spaced ~77px, section gaps after idle and walk)
const ROW1_X = [
  // IDLE×6
  55, 132, 209, 287, 365, 442,
  // WALK×8  (gap ~106 before first walk)
  548, 625, 703, 780, 858, 935, 1012, 1090,
  // RUN×8   (gap ~106 before first run)
  1196, 1274, 1351, 1429, 1506, 1583, 1661, 1738,
];

// Row 2 x-centers
const ROW2_X = [
  // JUMP×4
  55, 132, 209, 287,
  // FALL×3  (gap)
  393, 470, 548,
  // ATTACK×6  (gap)
  654, 731, 809, 886, 964, 1041,
  // DASH×4  (gap)
  1147, 1224, 1302, 1379,
];

// Row 3 x-centers
const ROW3_X = [
  // HURT×2
  55, 132,
  // INTERACT×3  (gap)
  238, 316, 393,
  // BURNOUT×4  (gap)
  499, 577, 654, 731,
];

// Build full frame list: { xCenter, yStart, name }
const frames = [
  // ── Row 1 ──────────────────────────────────────────────────────────────────
  // IDLE (6 frames)
  ...Array.from({ length: 6 }, (_, i) => ({ xCenter: ROW1_X[i],    yStart: ROW1_Y, name: `player-idle${i}.png` })),
  // WALK (8 frames)
  ...Array.from({ length: 8 }, (_, i) => ({ xCenter: ROW1_X[6+i],  yStart: ROW1_Y, name: `player-walk${i}.png` })),
  // RUN  (8 frames)
  ...Array.from({ length: 8 }, (_, i) => ({ xCenter: ROW1_X[14+i], yStart: ROW1_Y, name: `player-run${i}.png`  })),

  // ── Row 2 ──────────────────────────────────────────────────────────────────
  // JUMP (4 frames)
  ...Array.from({ length: 4 }, (_, i) => ({ xCenter: ROW2_X[i],    yStart: ROW2_Y, name: `player-jump${i}.png`    })),
  // FALL (3 frames)
  ...Array.from({ length: 3 }, (_, i) => ({ xCenter: ROW2_X[4+i],  yStart: ROW2_Y, name: `player-fall${i}.png`    })),
  // ATTACK (6 frames)
  ...Array.from({ length: 6 }, (_, i) => ({ xCenter: ROW2_X[7+i],  yStart: ROW2_Y, name: `player-attack${i}.png`  })),
  // DASH (4 frames)
  ...Array.from({ length: 4 }, (_, i) => ({ xCenter: ROW2_X[13+i], yStart: ROW2_Y, name: `player-dash${i}.png`    })),

  // ── Row 3 ──────────────────────────────────────────────────────────────────
  // HURT (2 frames)
  ...Array.from({ length: 2 }, (_, i) => ({ xCenter: ROW3_X[i],    yStart: ROW3_Y, name: `player-hurt${i}.png`     })),
  // INTERACT (3 frames)
  ...Array.from({ length: 3 }, (_, i) => ({ xCenter: ROW3_X[2+i],  yStart: ROW3_Y, name: `player-interact${i}.png` })),
  // BURNOUT (4 frames)
  ...Array.from({ length: 4 }, (_, i) => ({ xCenter: ROW3_X[5+i],  yStart: ROW3_Y, name: `player-burnout${i}.png`  })),
];

async function extractFrame(src, xCenter, yStart, outPath) {
  // Crop a CROP_W × CROP_H region centered at xCenter
  const cropX = Math.max(0, xCenter - Math.floor(CROP_W / 2));
  const cropY = yStart;

  // Clone before mutating
  const cropped = src.clone().crop({ x: cropX, y: cropY, w: CROP_W, h: CROP_H });

  // Remove dark background: R<60 AND G<60 AND B<60 → alpha=0
  for (let py = 0; py < CROP_H; py++) {
    for (let px = 0; px < CROP_W; px++) {
      const colorInt = cropped.getPixelColor(px, py);
      // jimp color is 0xRRGGBBAA
      const r = (colorInt >>> 24) & 0xff;
      const g = (colorInt >>> 16) & 0xff;
      const b = (colorInt >>> 8)  & 0xff;
      if (r < BG_THRESHOLD && g < BG_THRESHOLD && b < BG_THRESHOLD) {
        cropped.setPixelColor(0x00000000, px, py);
      }
    }
  }

  // Find bounding box of non-transparent pixels
  let minX = CROP_W, minY = CROP_H, maxX = -1, maxY = -1;
  for (let py = 0; py < CROP_H; py++) {
    for (let px = 0; px < CROP_W; px++) {
      const colorInt = cropped.getPixelColor(px, py);
      const a = colorInt & 0xff;
      if (a > 0) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
  }

  // If no content found, create empty 48×64
  if (maxX < 0) {
    console.warn(`  WARNING: No content found for ${outPath}, saving blank`);
    const blank = new Jimp({ width: OUT_W, height: OUT_H, color: 0x00000000 });
    await blank.write(outPath);
    return 0; // 0 opaque pixels
  }

  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;

  // Crop to just the content
  const content = cropped.clone().crop({ x: minX, y: minY, w: contentW, h: contentH });

  // Scale to fit within OUT_W × OUT_H, preserving aspect ratio
  const scaleX = OUT_W / contentW;
  const scaleY = OUT_H / contentH;
  const scale = Math.min(scaleX, scaleY, 1); // never upscale beyond 1× if content already fits

  const scaledW = Math.max(1, Math.round(contentW * scale));
  const scaledH = Math.max(1, Math.round(contentH * scale));

  content.resize({ w: scaledW, h: scaledH });

  // Center on OUT_W × OUT_H transparent canvas
  const canvas = new Jimp({ width: OUT_W, height: OUT_H, color: 0x00000000 });
  const offsetX = Math.floor((OUT_W - scaledW) / 2);
  const offsetY = Math.floor((OUT_H - scaledH) / 2);

  canvas.composite(content, offsetX, offsetY);
  await canvas.write(outPath);

  // Count opaque pixels for verification
  let opaqueCount = 0;
  const totalPixels = OUT_W * OUT_H;
  for (let py = 0; py < OUT_H; py++) {
    for (let px = 0; px < OUT_W; px++) {
      const c = canvas.getPixelColor(px, py);
      if ((c & 0xff) > 0) opaqueCount++;
    }
  }
  return opaqueCount;
}

async function main() {
  console.log('Loading source spritesheet...');
  const src = await Jimp.read(SOURCE);
  console.log(`Source size: ${src.width}×${src.height}`);
  console.log(`Extracting ${frames.length} frames...\n`);

  let nonTrivialCount = 0;
  const totalPixels = OUT_W * OUT_H;

  for (const frame of frames) {
    const outPath = join(SPRITES_DIR, frame.name);
    const opaquePixels = await extractFrame(src, frame.xCenter, frame.yStart, outPath);
    const transparentPct = ((totalPixels - opaquePixels) / totalPixels * 100).toFixed(1);
    const trivial = opaquePixels / totalPixels < 0.05; // <5% opaque = >95% transparent
    if (!trivial) nonTrivialCount++;
    console.log(`${trivial ? '⚠' : '✓'} ${frame.name}  (${opaquePixels} opaque px, ${transparentPct}% transparent)`);
  }

  // ── Backward-compatible aliases ─────────────────────────────────────────────
  console.log('\nCreating backward-compatible aliases...');

  const aliases = [
    ['player-idle0.png',    'player-idle.png'],
    ['player-jump1.png',    'player-jump.png'],
    ['player-fall0.png',    'player-fall.png'],
    ['player-attack2.png',  'player-attack.png'],
    ['player-dash0.png',    'player-dash.png'],
  ];

  for (const [src_file, dst_file] of aliases) {
    copyFileSync(join(SPRITES_DIR, src_file), join(SPRITES_DIR, dst_file));
    console.log(`✓ ${dst_file} (copy of ${src_file})`);
  }

  // ── Verification ─────────────────────────────────────────────────────────────
  console.log(`\n── Verification ────────────────────────────────────────────────`);
  console.log(`Total frames extracted: ${frames.length}`);
  console.log(`Non-trivially transparent (<95% transparent): ${nonTrivialCount}`);
  if (nonTrivialCount >= 10) {
    console.log('✓ PASS: at least 10 frames have meaningful content');
  } else {
    console.warn(`⚠ WARN: only ${nonTrivialCount} frames have meaningful content (expected ≥10)`);
  }
  console.log('\nDone!');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
