// Image processing script for game background images
// Uses sharp to resize/crop source images to target dimensions

import sharp from '/home/user/vidadoclt/node_modules/sharp/dist/index.mjs';
import { existsSync } from 'fs';

const SPRITES = '/home/user/vidadoclt/public/assets/sprites';
const OUT = '/home/user/vidadoclt/public/assets';

async function resize(input, output, width, height) {
  console.log(`Processing: ${input.split('/').pop()} → ${output.split('/').pop()} (${width}x${height})`);
  await sharp(input)
    .resize(width, height, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toFile(output);
  console.log(`  Done → ${output.split('/').pop()}`);
}

async function extractFromGrid(input, output, width, height, gridCols, gridRows, col, row) {
  const meta = await sharp(input).metadata();
  const cellW = Math.floor(meta.width / gridCols);
  const cellH = Math.floor(meta.height / gridRows);
  const left = col * cellW;
  const top = row * cellH;
  console.log(`Extracting from grid: col=${col}, row=${row}, cell=${cellW}x${cellH} at (${left},${top}) → ${output.split('/').pop()} (${width}x${height})`);
  await sharp(input)
    .extract({ left, top, width: cellW, height: cellH })
    .resize(width, height, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toFile(output);
  console.log(`  Done → ${output.split('/').pop()}`);
}

async function main() {
  // 1. bg-menu.png: 1672×941 → 960×540 (cover crop)
  const menuSrc = `${SPRITES}/ChatGPT Image 12 de jun. de 2026, 22_07_25.png`;
  await resize(menuSrc, `${OUT}/bg-menu.png`, 960, 540);

  // 2. bg-openspace.png: 1536×1024 → 1920×480 (cover crop, landscape)
  const openspaceSrc = `${SPRITES}/ChatGPT Image 13 de jun. de 2026, 13_19_08.png`;
  await resize(openspaceSrc, `${OUT}/bg-openspace.png`, 1920, 480);

  // 3. Grid image: 1536×1024 containing all phase backgrounds
  // The grid image is described as showing "all 10 phase backgrounds"
  // Inspect the actual grid layout. With 1536x1024 and 10 images:
  // A 5x2 grid gives cells of 307x512 each
  // A 2x5 grid gives cells of 768x204 each
  // Most likely layout: let's try 5 cols x 2 rows (landscape cells)
  const gridSrc = `${SPRITES}/ChatGPT Image 12 de jun. de 2026, 22_08_25.png`;
  const gridMeta = await sharp(gridSrc).metadata();
  console.log(`\nGrid image dimensions: ${gridMeta.width}x${gridMeta.height}`);

  // Try 2 cols x 5 rows layout (each cell: 768x204) - landscape
  // Or 5 cols x 2 rows (each cell: 307x512) - portrait
  // Since these are game backgrounds, landscape is more likely
  // Let's try multiple configurations and check aspect ratio
  // With 1536x1024 and 10 images → 2x5 = cells 768x204 (very wide), or 5x2 = 307x512 (portrait)
  // Neither is ideal. Could be a 3x4 or 4x3 grid with some padding.
  // Most sensible for "10 backgrounds": 2 rows x 5 cols
  const GRID_COLS = 2;
  const GRID_ROWS = 5;

  // Phase backgrounds to extract from grid (in order: rows then cols)
  // Map of (col, row) to output filename
  // We need: bg-atendimento, bg-comercial, bg-produto, bg-tecnologia, bg-rh,
  //          bg-compliance, bg-diretoria, bg-presidencia, bg-cobertura, bg-copa
  const phaseBackgrounds = [
    { col: 0, row: 0, name: 'bg-atendimento' },
    { col: 1, row: 0, name: 'bg-comercial' },
    { col: 0, row: 1, name: 'bg-produto' },
    { col: 1, row: 1, name: 'bg-tecnologia' },
    { col: 0, row: 2, name: 'bg-rh' },
    { col: 1, row: 2, name: 'bg-compliance' },
    { col: 0, row: 3, name: 'bg-diretoria' },
    { col: 1, row: 3, name: 'bg-presidencia' },
    { col: 0, row: 4, name: 'bg-cobertura' },
    { col: 1, row: 4, name: 'bg-copa' },
  ];

  console.log('\nExtracting phase backgrounds from grid...');
  for (const { col, row, name } of phaseBackgrounds) {
    const isCopa = name === 'bg-copa';
    const outW = isCopa ? 960 : 1920;
    const outH = 480;
    await extractFromGrid(gridSrc, `${OUT}/${name}.png`, outW, outH, GRID_COLS, GRID_ROWS, col, row);
  }

  console.log('\nAll done!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
