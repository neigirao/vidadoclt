// ─────────────────────────────────────────────────────────────────────────────
// Normaliza os frames de DEATH que foram fatiados MAIORES que os outros estados
// do mesmo personagem (slicer `inimigos1` usava death [64×64] vs [48×64] do resto
// → o inimigo "inchava" ~40% ao morrer). Reescala cada família de death para o
// canvas dos OUTROS estados (ex.: 48×64), com UMA escala única por personagem
// (calculada p/ casar a altura do conteúdo de death0 com a do idle0) aplicada a
// TODOS os death frames — preserva o movimento de colapso sem "pulsar" de tamanho.
// Alinha pelos pés (baseline). Determinístico, sem IA. Reempacota o atlas 1× no fim.
//
// Uso: node scripts/normalize-death-size.mjs [--dry]
// ─────────────────────────────────────────────────────────────────────────────
import sharp from "sharp";
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SPR = "public/assets/sprites";
const dry = process.argv.includes("--dry");

async function raw(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
function bbox(r) {
  let minx = r.w,
    maxx = -1,
    miny = r.h,
    maxy = -1;
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      if (r.data[(y * r.w + x) * 4 + 3] > 20) {
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
  return maxx < 0 ? null : { minx, maxx, miny, maxy, w: maxx - minx + 1, h: maxy - miny + 1 };
}

// Descobre personagens cujo death é MAIOR (canvas) que o idle/walk. Só esses.
function deathOutliers() {
  const files = readdirSync(SPR).filter((f) => f.endsWith(".png"));
  const re = /^(.*?)-(idle|walk|death)(\d+)\.png$/;
  const sizes = {}; // prefix -> {state -> "wxh" via first frame later}
  const first = {}; // prefix/state -> filename0
  for (const f of files) {
    const m = f.match(re);
    if (!m) continue;
    const key = `${m[1]}/${m[2]}`;
    if (m[3] === "0") first[key] = f;
    sizes[m[1]] = sizes[m[1]] || {};
  }
  return { first, prefixes: Object.keys(sizes) };
}

async function dimOf(file) {
  const meta = await sharp(`${SPR}/${file}`).metadata();
  return [meta.width, meta.height];
}

async function run() {
  const { first, prefixes } = deathOutliers();
  const targets = [];
  for (const p of prefixes) {
    const idleF = first[`${p}/idle`] || first[`${p}/walk`];
    const deathF = first[`${p}/death`];
    if (!idleF || !deathF) continue;
    const [iw, ih] = await dimOf(idleF);
    const [dw, dh] = await dimOf(deathF);
    if (dw === iw && dh === ih) continue; // já consistente
    targets.push({ prefix: p, canvas: [iw, ih], idleF, deathW: dw, deathH: dh });
  }

  console.log(`${targets.length} personagens com death fora do tamanho da família:`);
  for (const t of targets)
    console.log(
      `  ${t.prefix}: death ${t.deathW}x${t.deathH} → alvo ${t.canvas[0]}x${t.canvas[1]}`,
    );
  if (dry || targets.length === 0) return;

  for (const t of targets) {
    const [CW, CH] = t.canvas;
    // Escala única: altura do conteúdo de death0 → ~altura do conteúdo do idle0.
    const idleBB = bbox(await raw(`${SPR}/${t.idleF}`));
    const death0 = `${t.prefix}-death0.png`;
    const d0BB = bbox(await raw(`${SPR}/${death0}`));
    if (!idleBB || !d0BB) continue;
    const deathFiles = readdirSync(SPR).filter((f) =>
      new RegExp(`^${t.prefix}-death\\d+\\.png$`).test(f),
    );
    // Maior bbox entre os death frames → garante que NADA estoure o canvas.
    let maxW = 0,
      maxH = 0;
    for (const f of deathFiles) {
      const bb = bbox(await raw(`${SPR}/${f}`));
      if (bb) {
        if (bb.w > maxW) maxW = bb.w;
        if (bb.h > maxH) maxH = bb.h;
      }
    }
    // Escala ÚNICA: casa a altura de death0 com a do idle, mas nunca deixa o maior
    // frame passar do canvas (margem de 2px). min de: altura-alvo, largura-cap, altura-cap.
    const scale = Math.min((idleBB.h + 2) / d0BB.h, (CW - 2) / maxW, (CH - 2) / maxH, 1);
    for (const f of deathFiles) {
      const r = await raw(`${SPR}/${f}`);
      const bb = bbox(r);
      if (!bb) continue;
      const cropped = await sharp(`${SPR}/${f}`)
        .extract({ left: bb.minx, top: bb.miny, width: bb.w, height: bb.h })
        .toBuffer();
      const nw = Math.max(1, Math.round(bb.w * scale));
      const nh = Math.max(1, Math.round(bb.h * scale));
      const scaled = await sharp(cropped).resize(nw, nh, { kernel: "nearest" }).toBuffer();
      const left = Math.floor((CW - nw) / 2);
      const top = Math.max(0, CH - nh - 1); // alinha pés (1px de folga)
      await sharp({
        create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite([{ input: scaled, left, top }])
        .png()
        .toFile(`${SPR}/${f}`);
    }
    console.log(
      `  ✓ ${t.prefix}: ${deathFiles.length} frames → ${CW}x${CH} (escala ${scale.toFixed(2)})`,
    );
  }

  console.log("\nReempacotando atlas…");
  const pack = spawnSync("node", ["scripts/pack-atlas.mjs"], { encoding: "utf8" });
  console.log(pack.stdout.split("\n").slice(-3).join("\n"));
}
run();
