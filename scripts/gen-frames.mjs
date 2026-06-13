import sharp from '/home/user/vidadoclt/node_modules/sharp/dist/index.mjs';
import { readFileSync, writeFileSync } from 'fs';

const DIR = '/home/user/vidadoclt/public/assets/sprites/';

async function shiftSprite(inputFile, outputFile, shiftX, shiftY) {
  const buf = readFileSync(inputFile);
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.alloc(data.length, 0);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const srcX = ((px - shiftX) + width) % width;
      const srcY = ((py - shiftY) + height) % height;
      const srcIdx = (srcY * width + srcX) * channels;
      const dstIdx = (py * width + px) * channels;
      for (let c = 0; c < channels; c++) out[dstIdx + c] = data[srcIdx + c];
    }
  }

  await sharp(out, { raw: { width, height, channels } }).png().toFile(outputFile);
  console.log('Generated:', outputFile);
}

// walk2 = walk0 with legs slightly shifted (simulate mid-stride)
await shiftSprite(DIR + 'player-walk0.png', DIR + 'player-walk2.png', 1, 0);
// walk3 = walk1 with legs slightly shifted
await shiftSprite(DIR + 'player-walk1.png', DIR + 'player-walk3.png', -1, 0);
