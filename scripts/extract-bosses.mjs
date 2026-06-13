import { Jimp } from 'jimp';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const SRC_FILE = 'public/assets/sprites/ChatGPT Image 12 de jun. de 2026, 22_13_52.png';
const OUT_DIR = 'public/assets/sprites';

// Ensure output dir exists
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Boss definitions: name and approximate row Y center
const bosses = [
  // row 1 (Gerente) at y≈75 is skipped — already extracted from 22_09_24
  { name: 'coordenador',    y: 170 },
  { name: 'cacador-metas',  y: 265 },
  { name: 'product-owner',  y: 360 },
  { name: 'arquiteto',      y: 455 },
  { name: 'rh-predador',    y: 550 },
  { name: 'guardiao-ordem', y: 645 },
  { name: 'diretor',        y: 740 },
  { name: 'vice-presidente',y: 835 },
  { name: 'ceo',            y: 930 },
];

// Frame layout: state -> array of x center positions
// IDLE(2): x≈60,130 | WALK(2): x≈230,300 | ATTACK(2): x≈400,470
// SPECIAL(2): x≈570,640 | HURT(1): x≈750 | DEATH(2): x≈860,930
const frameGroups = [
  { state: 'idle',    xs: [60, 130] },
  { state: 'walk',    xs: [230, 300] },
  { state: 'attack',  xs: [400, 470] },
  { state: 'special', xs: [570, 640] },
  { state: 'hurt',    xs: [750] },
  { state: 'death',   xs: [860, 930] },
];

const CROP_SIZE = 130; // crop 130x130 around center
const OUT_SIZE = 64;   // final output size
const HALF = Math.floor(CROP_SIZE / 2);

// Remove very dark background pixels
function removeDarkBg(img) {
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    if (r < 60 && g < 60 && b < 60) {
      this.bitmap.data[idx + 3] = 0; // set alpha to 0
    }
  });
  return img;
}

console.log(`Reading source image: ${SRC_FILE}`);
const source = await Jimp.read(SRC_FILE);
console.log(`Source size: ${source.bitmap.width}x${source.bitmap.height}`);

let totalWritten = 0;

for (const boss of bosses) {
  const { name, y: cy } = boss;

  // Track idle0 for copying as boss-{name}.png
  let idle0Path = null;

  for (const { state, xs } of frameGroups) {
    for (let i = 0; i < xs.length; i++) {
      const cx = xs[i];

      // Clamp crop region to image bounds
      const cropX = Math.max(0, cx - HALF);
      const cropY = Math.max(0, cy - HALF);
      const cropW = Math.min(CROP_SIZE, source.bitmap.width - cropX);
      const cropH = Math.min(CROP_SIZE, source.bitmap.height - cropY);

      // Crop from source
      const cropped = source.clone().crop({ x: cropX, y: cropY, w: cropW, h: cropH });

      // Remove dark background
      removeDarkBg(cropped);

      // Resize to fit within 64x64 maintaining aspect ratio
      cropped.resize({ w: OUT_SIZE, h: OUT_SIZE });

      // Create 64x64 transparent canvas
      const canvas = new Jimp({ width: OUT_SIZE, height: OUT_SIZE, color: 0x00000000 });

      // Composite cropped onto canvas (centered)
      const dx = Math.floor((OUT_SIZE - cropped.bitmap.width) / 2);
      const dy = Math.floor((OUT_SIZE - cropped.bitmap.height) / 2);
      canvas.composite(cropped, dx, dy);

      const outName = `boss-${name}-${state}${i}.png`;
      const outPath = join(OUT_DIR, outName);
      await canvas.write(outPath);
      totalWritten++;

      if (state === 'idle' && i === 0) {
        idle0Path = outPath;
        // Also save as boss-{name}.png (copy of idle0)
        const copyPath = join(OUT_DIR, `boss-${name}.png`);
        await canvas.write(copyPath);
        totalWritten++;
        console.log(`  boss-${name}.png (copy of idle0)`);
      }

      console.log(`  ${outName}`);
    }
  }
}

console.log(`\nDone! Wrote ${totalWritten} files to ${OUT_DIR}`);
