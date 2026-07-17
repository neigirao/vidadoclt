import sharp from "sharp";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, basename } from "path";

const SPRITES_DIR = new URL("../public/assets/sprites/", import.meta.url).pathname;
const OUT_PNG = new URL("../public/assets/atlas.png", import.meta.url).pathname;
const OUT_JSON = new URL("../public/assets/atlas.json", import.meta.url).pathname;

const PAD = 2; // padding between sprites

async function main() {
  const files = readdirSync(SPRITES_DIR)
    .filter((f) => f.endsWith(".png"))
    .sort();

  // Read all sprites and get dimensions
  const sprites = await Promise.all(
    files.map(async (f) => {
      const path = join(SPRITES_DIR, f);
      const buf = readFileSync(path);
      const meta = await sharp(buf).metadata();
      return { name: f.replace(".png", ""), path, buf, w: meta.width, h: meta.height };
    }),
  );

  // Simple row packing: sort by height descending, fit into rows
  // 1024 (era 512): a coluna estreita deixava o atlas MUITO alto (7251px já
  // beirava o teto de textura de GPUs mais fracas). Mais largo → mais baixo →
  // headroom p/ mais frames (in-betweens). Transparente ao jogo (carrega por nome).
  const ATLAS_W = 1024;
  let x = PAD,
    y = PAD,
    rowH = 0;
  const frames = {};

  // Skip sprites that are too large to fit in the atlas (e.g. sprite sheets)
  const packable = sprites.filter((s) => s.w <= ATLAS_W);
  const skipped = sprites.filter((s) => s.w > ATLAS_W);
  if (skipped.length > 0) {
    console.log(
      `Skipping ${skipped.length} oversized sprite(s): ${skipped.map((s) => s.name).join(", ")}`,
    );
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
  const composites = packable.map((s) => ({
    input: s.buf,
    left: s.atlasX,
    top: s.atlasY,
  }));

  await sharp({
    create: {
      width: ATLAS_W,
      height: ATLAS_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(OUT_PNG);

  // Write Phaser atlas JSON
  const atlasJson = {
    textures: [
      {
        image: "atlas.png",
        format: "RGBA8888",
        size: { w: ATLAS_W, h: ATLAS_H },
        scale: 1,
        frames: Object.entries(frames).map(([filename, f]) => ({
          filename,
          rotated: false,
          trimmed: false,
          sourceSize: f.sourceSize,
          spriteSourceSize: { x: 0, y: 0, ...f.sourceSize },
          frame: f.frame,
        })),
      },
    ],
    meta: { app: "pack-atlas.mjs", version: "1.0", scale: "1" },
  };

  writeFileSync(OUT_JSON, JSON.stringify(atlasJson, null, 2));

  const totalOrig = packable.reduce((a, s) => a + readFileSync(s.path).length, 0);
  const atlasSize = readFileSync(OUT_PNG).length;
  console.log(`Packed ${packable.length} sprites → atlas.png (${ATLAS_W}×${ATLAS_H})`);
  console.log(
    `Total original: ${(totalOrig / 1024).toFixed(1)}KB  Atlas: ${(atlasSize / 1024).toFixed(1)}KB`,
  );

  // ── Validação de qualidade (root-cause #1: assets mal-extraídos) ────────────
  // Roda a cada empacotamento e AVISA sobre frames suspeitos, para que extrações
  // ruins (frames vazios / tamanho inconsistente numa animação) sejam pegas aqui
  // e não cheguem ao jogo como "bloco" / sprite encolhendo.
  const empties = [];
  const groups = {};
  for (const s of packable) {
    try {
      const { data, info } = await sharp(s.buf)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let op = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 30) op++;
      if (op < 25) empties.push(s.name);
      if (/^(enemy|player|boss|npc)-/.test(s.name)) {
        const gkey = s.name.replace(/[0-9]+$/, "");
        (groups[gkey] = groups[gkey] || []).push(`${info.width}x${info.height}`);
      }
    } catch {
      /* ignore */
    }
  }
  const sizeIssues = Object.entries(groups)
    .filter(([, sizes]) => sizes.length >= 3 && new Set(sizes).size > 1)
    .map(([g, sizes]) => `${g}: ${JSON.stringify([...new Set(sizes)])}`);
  if (empties.length || sizeIssues.length) {
    console.log("\n⚠️  VALIDAÇÃO DE ASSETS — revise estes frames:");
    if (empties.length) console.log("   vazios/quase-vazios:", empties.join(", "));
    if (sizeIssues.length) {
      console.log('   tamanho inconsistente numa animação (pode causar "encolhimento"):');
      sizeIssues.forEach((s) => console.log("     - " + s));
    }
    console.log("   (aviso apenas; frames não-usados podem ser ignorados)");
  } else {
    console.log("✓ Validação de assets: nenhum frame suspeito.");
  }
}

main().catch(console.error);
