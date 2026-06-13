import { Jimp } from 'jimp';
import { copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = join(__dirname, '../public/assets/sprites/');
const SOURCE = join(SPRITES_DIR, 'ChatGPT Image 12 de jun. de 2026, 22_07_17.png');

// Frame layout from blob analysis
// Row 1: y_start=195, 16 frames — IDLE×4, WALK×6, RUN×6
const ROW1_Y = 195;
const ROW1_X_CENTERS = [62, 167, 272, 370, 492, 597, 704, 810, 917, 1031, 1187, 1297, 1406, 1520, 1637, 1754];

// Row 2: y_start=445, 12 frames — JUMP×3, FALL×2, ATTACK×4, DASH×3
const ROW2_Y = 445;
const ROW2_X_CENTERS = [62, 192, 322, 462, 591, 769, 873, 982, 1090, 1262, 1471, 1637];

// Frame extraction region size
const CROP_W = 100;
const CROP_H = 130;

// Output frame size
const OUT_W = 48;
const OUT_H = 64;

// Background removal threshold: R<55 AND G<55 AND B<55 → transparent
const BG_THRESHOLD = 55;

// Build all 28 frame definitions with output filenames
const frames = [
  // Row 1: IDLE (frames 1-4)
  { xCenter: ROW1_X_CENTERS[0],  yStart: ROW1_Y, name: 'player-idle0.png' },
  { xCenter: ROW1_X_CENTERS[1],  yStart: ROW1_Y, name: 'player-idle1.png' },
  { xCenter: ROW1_X_CENTERS[2],  yStart: ROW1_Y, name: 'player-idle2.png' },
  { xCenter: ROW1_X_CENTERS[3],  yStart: ROW1_Y, name: 'player-idle3.png' },
  // Row 1: WALK (frames 5-10)
  { xCenter: ROW1_X_CENTERS[4],  yStart: ROW1_Y, name: 'player-walk0.png' },
  { xCenter: ROW1_X_CENTERS[5],  yStart: ROW1_Y, name: 'player-walk1.png' },
  { xCenter: ROW1_X_CENTERS[6],  yStart: ROW1_Y, name: 'player-walk2.png' },
  { xCenter: ROW1_X_CENTERS[7],  yStart: ROW1_Y, name: 'player-walk3.png' },
  { xCenter: ROW1_X_CENTERS[8],  yStart: ROW1_Y, name: 'player-walk4.png' },
  { xCenter: ROW1_X_CENTERS[9],  yStart: ROW1_Y, name: 'player-walk5.png' },
  // Row 1: RUN (frames 11-16)
  { xCenter: ROW1_X_CENTERS[10], yStart: ROW1_Y, name: 'player-run0.png' },
  { xCenter: ROW1_X_CENTERS[11], yStart: ROW1_Y, name: 'player-run1.png' },
  { xCenter: ROW1_X_CENTERS[12], yStart: ROW1_Y, name: 'player-run2.png' },
  { xCenter: ROW1_X_CENTERS[13], yStart: ROW1_Y, name: 'player-run3.png' },
  { xCenter: ROW1_X_CENTERS[14], yStart: ROW1_Y, name: 'player-run4.png' },
  { xCenter: ROW1_X_CENTERS[15], yStart: ROW1_Y, name: 'player-run5.png' },
  // Row 2: JUMP (frames 17-19)
  { xCenter: ROW2_X_CENTERS[0],  yStart: ROW2_Y, name: 'player-jump0.png' },
  { xCenter: ROW2_X_CENTERS[1],  yStart: ROW2_Y, name: 'player-jump1.png' },
  { xCenter: ROW2_X_CENTERS[2],  yStart: ROW2_Y, name: 'player-jump2.png' },
  // Row 2: FALL (frames 20-21)
  { xCenter: ROW2_X_CENTERS[3],  yStart: ROW2_Y, name: 'player-fall0.png' },
  { xCenter: ROW2_X_CENTERS[4],  yStart: ROW2_Y, name: 'player-fall1.png' },
  // Row 2: ATTACK (frames 22-25)
  { xCenter: ROW2_X_CENTERS[5],  yStart: ROW2_Y, name: 'player-attack0.png' },
  { xCenter: ROW2_X_CENTERS[6],  yStart: ROW2_Y, name: 'player-attack1.png' },
  { xCenter: ROW2_X_CENTERS[7],  yStart: ROW2_Y, name: 'player-attack2.png' },
  { xCenter: ROW2_X_CENTERS[8],  yStart: ROW2_Y, name: 'player-attack3.png' },
  // Row 2: DASH (frames 26-28)
  { xCenter: ROW2_X_CENTERS[9],  yStart: ROW2_Y, name: 'player-dash0.png' },
  { xCenter: ROW2_X_CENTERS[10], yStart: ROW2_Y, name: 'player-dash1.png' },
  { xCenter: ROW2_X_CENTERS[11], yStart: ROW2_Y, name: 'player-dash2.png' },
];

async function extractFrame(src, xCenter, yStart, outPath) {
  // Crop a 100×130 region centered at xCenter
  const cropX = Math.max(0, xCenter - Math.floor(CROP_W / 2));
  const cropY = yStart;

  // Crop the region from source
  const cropped = src.clone().crop({ x: cropX, y: cropY, w: CROP_W, h: CROP_H });

  // Remove dark background: R<55 AND G<55 AND B<55 → alpha=0
  for (let py = 0; py < CROP_H; py++) {
    for (let px = 0; px < CROP_W; px++) {
      const colorInt = cropped.getPixelColor(px, py);
      // jimp color is 0xRRGGBBAA
      const r = (colorInt >>> 24) & 0xff;
      const g = (colorInt >>> 16) & 0xff;
      const b = (colorInt >>> 8)  & 0xff;
      if (r < BG_THRESHOLD && g < BG_THRESHOLD && b < BG_THRESHOLD) {
        // Set to fully transparent black
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
    return;
  }

  // Content dimensions
  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;

  // Crop to just the content
  const content = cropped.clone().crop({ x: minX, y: minY, w: contentW, h: contentH });

  // Scale to fit within 48×64, preserving aspect ratio
  const scaleX = OUT_W / contentW;
  const scaleY = OUT_H / contentH;
  const scale = Math.min(scaleX, scaleY);

  const scaledW = Math.round(contentW * scale);
  const scaledH = Math.round(contentH * scale);

  // Resize the content
  content.resize({ w: scaledW, h: scaledH });

  // Center on 48×64 canvas
  const canvas = new Jimp({ width: OUT_W, height: OUT_H, color: 0x00000000 });
  const offsetX = Math.floor((OUT_W - scaledW) / 2);
  const offsetY = Math.floor((OUT_H - scaledH) / 2);

  canvas.composite(content, offsetX, offsetY);

  await canvas.write(outPath);
}

async function main() {
  console.log('Loading source spritesheet...');
  const src = await Jimp.read(SOURCE);
  console.log(`Source size: ${src.width}×${src.height}`);

  for (const frame of frames) {
    const outPath = join(SPRITES_DIR, frame.name);
    await extractFrame(src, frame.xCenter, frame.yStart, outPath);
    console.log(`✓ ${frame.name}`);
  }

  // Backward-compatible aliases
  console.log('\nCreating backward-compatible aliases...');

  // player-idle.png = player-idle0.png
  copyFileSync(join(SPRITES_DIR, 'player-idle0.png'), join(SPRITES_DIR, 'player-idle.png'));
  console.log('✓ player-idle.png (copy of player-idle0.png)');

  // player-jump.png = player-jump1.png
  copyFileSync(join(SPRITES_DIR, 'player-jump1.png'), join(SPRITES_DIR, 'player-jump.png'));
  console.log('✓ player-jump.png (copy of player-jump1.png)');

  // player-attack.png = player-attack1.png
  copyFileSync(join(SPRITES_DIR, 'player-attack1.png'), join(SPRITES_DIR, 'player-attack.png'));
  console.log('✓ player-attack.png (copy of player-attack1.png)');

  // player-dash.png = player-dash0.png
  copyFileSync(join(SPRITES_DIR, 'player-dash0.png'), join(SPRITES_DIR, 'player-dash.png'));
  console.log('✓ player-dash.png (copy of player-dash0.png)');

  // player-fall.png = player-fall0.png
  copyFileSync(join(SPRITES_DIR, 'player-fall0.png'), join(SPRITES_DIR, 'player-fall.png'));
  console.log('✓ player-fall.png (copy of player-fall0.png)');

  console.log('\nDone! All 28 frames extracted + 5 aliases created.');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
