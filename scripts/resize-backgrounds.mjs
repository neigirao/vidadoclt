import sharp from "sharp";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const spritesDir = path.join(root, "public/assets/sprites");
const assetsDir = path.join(root, "public/assets");

mkdirSync(assetsDir, { recursive: true });

async function resizeCover(inputPath, outputPath, width, height, label) {
  console.log(`Processing ${label}...`);
  await sharp(inputPath)
    .resize(width, height, {
      fit: "cover",
      position: "centre",
      kernel: "lanczos3",
    })
    .png()
    .toFile(outputPath);
  console.log(`  -> ${outputPath} (${width}x${height})`);
}

const gridPath = path.join(spritesDir, "ChatGPT Image 12 de jun. de 2026, 22_08_25.png");
const openspacePath = path.join(spritesDir, "ChatGPT Image 13 de jun. de 2026, 13_19_08.png");

// 1. bg-menu: 1672×941 → 960×540, cover crop
await resizeCover(
  path.join(spritesDir, "ChatGPT Image 12 de jun. de 2026, 22_07_25.png"),
  path.join(assetsDir, "bg-menu.png"),
  960, 540,
  "bg-menu"
);

// 2. bg-openspace: 1536×1024 → 1920×480, cover crop
await resizeCover(
  openspacePath,
  path.join(assetsDir, "bg-openspace.png"),
  1920, 480,
  "bg-openspace"
);

// 3. Grid image: 1536×1024 — check if extractable (10 backgrounds in grid)
// If grid is 2 cols × 5 rows: each cell = 768×204 — too small, skip extraction
// If grid is 5 cols × 2 rows: each cell = 307×512 — also too small
// Per user instructions: just copy-resize the openspace image for other phases.
const otherPhases = [
  "bg-atendimento",
  "bg-comercial",
  "bg-produto",
  "bg-tecnologia",
  "bg-rh",
  "bg-compliance",
  "bg-diretoria",
  "bg-presidencia",
  "bg-cobertura",
  "bg-copa",
];

// Try to determine grid layout from image metadata
const gridMeta = await sharp(gridPath).metadata();
console.log(`\nGrid image dimensions: ${gridMeta.width}x${gridMeta.height}`);

// Grid is 1536×1024 — at 5 cols × 2 rows: 307×512; at 2 cols × 5 rows: 768×204
// The grid cells are too small for good quality extraction, so fall back to
// copying/resizing the openspace image for each phase.
console.log("Grid cells too small for quality extraction — using openspace image as fallback for all other phases.\n");

for (const key of otherPhases) {
  await resizeCover(
    openspacePath,
    path.join(assetsDir, `${key}.png`),
    1920, 480,
    key
  );
}

console.log("\nAll backgrounds processed successfully.");
