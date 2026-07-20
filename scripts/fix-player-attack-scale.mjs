// One-off: os frames de player-attack foram cortados da folha-fonte em escala
// MAIOR que idle/walk → o personagem "crescia" ao atacar. Reescala cada frame
// inteiro por SCALE, alinhado à base (bottom-center), preservando a composição.
// Determinístico, sem IA. Reempacota o atlas ao fim.
import sharp from "sharp";
import { PNG } from "pngjs";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SPR = "public/assets/sprites";
const SCALE = 0.65;

const files = readdirSync(SPR).filter((f) => /^player-attack\d+\.png$/.test(f));
console.log(`Reescalando ${files.length} frames de player-attack por ${SCALE}…`);

for (const f of files) {
  const src = readFileSync(`${SPR}/${f}`);
  const png = PNG.sync.read(src);
  const W = png.width,
    H = png.height;
  const nw = Math.round(W * SCALE),
    nh = Math.round(H * SCALE);
  const small = PNG.sync.read(
    await sharp(src).resize(nw, nh, { kernel: "nearest" }).ensureAlpha().png().toBuffer(),
  );
  const out = new PNG({ width: W, height: H });
  out.data.fill(0);
  const ox = Math.round((W - nw) / 2),
    oy = H - nh; // bottom-center
  for (let j = 0; j < nh; j++)
    for (let i = 0; i < nw; i++) {
      const s = (j * nw + i) * 4;
      const dx = ox + i,
        dy = oy + j;
      if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue;
      const d = (dy * W + dx) * 4;
      for (let k = 0; k < 4; k++) out.data[d + k] = small.data[s + k];
    }
  writeFileSync(`${SPR}/${f}`, PNG.sync.write(out));
}

console.log("Reempacotando atlas…");
const pack = spawnSync("node", ["scripts/pack-atlas.mjs"], { encoding: "utf8" });
console.log(pack.stdout.split("\n").slice(-2).join("\n"));
