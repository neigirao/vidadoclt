// ─────────────────────────────────────────────────────────────────────────────
// Pós-processo do render do Blender → PIXEL-ART da casa.
//
// O Blender entrega geometria limpa em cores chapadas; o que falta é a
// LINGUAGEM do sprite existente: paleta travada na arte da casa e CONTORNO
// escuro (a arte de referência tem outline forte — sem ele o render parece
// "3D de brinquedo" colado num jogo pixel-art).
//
// Uso: node scripts/blender/post-pixelate.mjs <in_dir> <out_prefix> [--apply]
//   sem --apply grava em <in_dir>/out/ (inspeção); com --apply grava direto em
//   public/assets/sprites/<out_prefix><N>.png e re-empacota o atlas.
// ─────────────────────────────────────────────────────────────────────────────
import sharp from "sharp";
import { readdirSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const [inDir, outPrefix] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const apply = process.argv.includes("--apply");
if (!inDir || !outPrefix) {
  console.error("uso: node scripts/blender/post-pixelate.mjs <in_dir> <out_prefix> [--apply]");
  process.exit(2);
}

// Paleta extraída da arte REAL do player (top cores do walk existente) — manter
// o render dentro dela é o que faz o sprite novo "pertencer" ao mesmo jogo.
const PALETTE = [
  [0x10, 0x18, 0x20], // azul-noite (contorno/sombra)
  [0x00, 0x00, 0x00],
  [0x08, 0x08, 0x10],
  [0x20, 0x28, 0x30],
  [0x38, 0x28, 0x20], // marrom escuro (calça/cabelo)
  [0x48, 0x38, 0x30],
  [0x60, 0x48, 0x38],
  [0x78, 0x58, 0x40],
  [0x90, 0x68, 0x50], // pele média
  [0xa8, 0x80, 0x60],
  [0xc0, 0x98, 0x78], // pele clara
  [0x50, 0x58, 0x68], // camisa sombra
  [0x90, 0x98, 0xa8],
  [0xb8, 0xc0, 0xc8], // camisa luz
];
const OUTLINE = [0x10, 0x18, 0x20];

const nearest = (r, g, b) => {
  let best = PALETTE[0],
    bd = Infinity;
  for (const c of PALETTE) {
    const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
};

const files = readdirSync(inDir)
  .filter((f) => /^raw\d+\.png$/.test(f))
  .sort();
if (files.length === 0) {
  console.error(`✖ nenhum raw*.png em ${inDir}`);
  process.exit(1);
}

const OUT = apply ? resolve("public/assets/sprites") : join(inDir, "out");
mkdirSync(OUT, { recursive: true });

let n = 0;
for (const f of files) {
  const { data, info } = await sharp(join(inDir, f))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width,
    H = info.height;
  const src = Buffer.from(data);
  const dst = Buffer.alloc(data.length, 0);
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && src[(y * W + x) * 4 + 3] > 128;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (src[i + 3] > 128) {
        // pixel do corpo → trava na paleta
        const [r, g, b] = nearest(src[i], src[i + 1], src[i + 2]);
        dst[i] = r;
        dst[i + 1] = g;
        dst[i + 2] = b;
        dst[i + 3] = 255;
      } else if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        // vizinho de corpo → CONTORNO (a linguagem visual da arte da casa)
        dst[i] = OUTLINE[0];
        dst[i + 1] = OUTLINE[1];
        dst[i + 2] = OUTLINE[2];
        dst[i + 3] = 255;
      }
    }
  }

  const name = `${outPrefix}${n}.png`;
  await sharp(dst, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile(join(OUT, name));
  n++;
}

console.log(`✓ ${n} frame(s) → ${OUT}/${outPrefix}N.png (paleta travada + contorno)`);
if (apply) {
  console.log("re-empacotando atlas…");
  const r = spawnSync("node", ["scripts/pack-atlas.mjs"], { stdio: "inherit" });
  process.exit(r.status ?? 0);
}
