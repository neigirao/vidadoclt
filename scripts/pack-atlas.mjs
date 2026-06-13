import sharp from '/home/user/vidadoclt/node_modules/sharp/dist/index.mjs';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const SPRITES_DIR = new URL('../public/assets/sprites/', import.meta.url).pathname;
const OUT_PNG = new URL('../public/assets/atlas.png', import.meta.url).pathname;
const OUT_JSON = new URL('../public/assets/atlas.json', import.meta.url).pathname;

const PAD = 2; // padding between sprites

async function main() {
  const files = readdirSync(SPRITES_DIR).filter(f => f.endsWith('.png')).sort();

  // Read all sprites and get dimensions
  const sprites = await Promise.all(files.map(async f => {
    const path = join(SPRITES_DIR, f);
    const buf = readFileSync(path);
    const meta = await sharp(buf).metadata();
    return { name: f.replace('.png', ''), path, buf, w: meta.width, h: meta.height };
  }));

  // Simple row packing: sort by height descending, fit into rows
  const ATLAS_W = 512;
  let x = PAD, y = PAD, rowH = 0;
  const frames = {};

  // Skip sprites that are too large to fit in the atlas (e.g. sprite sheets)
  const packable = sprites.filter(s => s.w <= ATLAS_W);
  const skipped = sprites.filter(s => s.w > ATLAS_W);
  if (skipped.length > 0) {
    console.log(`Skipping ${skipped.length} oversized sprite(s): ${skipped.map(s => s.name).join(', ')}`);
  }

  for (const s of packable.sort((a, b) => b.h - a.h)) {
    if (x + s.w + PAD > ATLAS_W) {
      x = PAD;
      y += rowH + PAD;
      rowH = 0;
    }
    frames[s.name] = { frame: { x, y, w: s.w, h: s.h }, sourceSize: { w: s.w, h: s.h } };
    s.atlasX = x;
    s.atlasY = y;
    x += s.w + PAD;
    rowH = Math.max(rowH, s.h);
  }

  const ATLAS_H = y + rowH + PAD;

  // Composite all packable sprites onto the atlas
  const composites = packable.map(s => ({
    input: s.buf,
    left: s.atlasX,
    top: s.atlasY,
  }));

  await sharp({
    create: { width: ATLAS_W, height: ATLAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(OUT_PNG);

  // Write Phaser atlas JSON
  const atlasJson = {
    textures: [{
      image: 'atlas.png',
      format: 'RGBA8888',
      size: { w: ATLAS_W, h: ATLAS_H },
      scale: 1,
      frames: Object.entries(frames).map(([filename, f]) => ({
        filename,
        rotated: false,
        trimmed: false,
        sourceSize: f.sourceSize,
        spriteSourceSize: { x: 0, y: 0, ...f.sourceSize },
        frame: f.frame,
      }))
    }],
    meta: { app: 'pack-atlas.mjs', version: '1.0', scale: '1' }
  };

  writeFileSync(OUT_JSON, JSON.stringify(atlasJson, null, 2));

  const totalOrig = packable.reduce((a, s) => a + readFileSync(s.path).length, 0);
  const atlasSize = readFileSync(OUT_PNG).length;
  console.log(`Packed ${packable.length} sprites → atlas.png (${ATLAS_W}×${ATLAS_H})`);
  console.log(`Total original: ${(totalOrig/1024).toFixed(1)}KB  Atlas: ${(atlasSize/1024).toFixed(1)}KB`);
}

main().catch(console.error);
