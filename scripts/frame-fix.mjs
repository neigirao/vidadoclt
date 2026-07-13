// ─────────────────────────────────────────────────────────────────────────────
// Conserto determinístico de UM frame de sprite, preservando o design (reusa os
// pixels do próprio frame / dos vizinhos da família). Chamado pelo botão
// "CORRIGIR FRAME" do LAB (via endpoint do vite) e testável direto por node.
//
//   node scripts/frame-fix.mjs <frame> rescale   → reescala o personagem p/ a
//        mediana de altura da família (conserta "pulo de tamanho"/encolhimento),
//        pés na baseline mediana, centrado. Mantém a arte, só corrige a escala.
//   node scripts/frame-fix.mjs <frame> copy-nearest → copia o vizinho bom mais
//        próximo (conserta frame quase-vazio/quebrado).
//
// Não faz redesenho criativo — pra isso, o LAB exporta o contexto pro agente/IA.
// ─────────────────────────────────────────────────────────────────────────────
import sharp from "sharp";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve(process.cwd(), "public/assets/sprites");
const ALPHA = 24;

async function bbox(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let minX = 1e9,
    minY = 1e9,
    maxX = -1,
    maxY = -1,
    opaque = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * c + 3] > ALPHA) {
        opaque++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  if (maxY < 0) return { w, h, empty: true };
  return {
    w,
    h,
    minX,
    minY,
    bw: maxX - minX + 1,
    bh: maxY - minY + 1,
    fromBottom: h - 1 - maxY,
    opaque,
  };
}

function siblingsOf(frame) {
  const base = frame.replace(/\d+$/, "");
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".png") && new RegExp(`^${base}\\d+\\.png$`).test(f))
    .map((f) => f.replace(/\.png$/, ""));
}
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[s.length >> 1] : 0;
};

async function rescale(frame) {
  const file = `${DIR}/${frame}.png`;
  const target = await bbox(file);
  const sibs = siblingsOf(frame).filter((s) => s !== frame);
  if (!sibs.length) throw new Error("sem irmãos na família p/ calcular a mediana");
  const boxes = [];
  for (const s of sibs) {
    const bb = await bbox(`${DIR}/${s}.png`);
    if (!bb.empty) boxes.push(bb);
  }
  const medH = median(boxes.map((b) => b.bh));
  const medFB = median(boxes.map((b) => b.fromBottom));
  if (target.empty) throw new Error("frame vazio — use copy-nearest");
  const scale = medH / target.bh;
  const sw = Math.max(1, Math.round(target.bw * scale)),
    sh = Math.max(1, Math.round(target.bh * scale));
  // recorta o personagem, reescala p/ a altura mediana, corta largura excedente
  let charBuf = await sharp(file)
    .extract({ left: target.minX, top: target.minY, width: target.bw, height: target.bh })
    .resize(sw, sh, { kernel: "lanczos3" })
    .png()
    .toBuffer();
  let cw = sw;
  if (sw > target.w) {
    const cx = Math.floor((sw - target.w) / 2);
    charBuf = await sharp(charBuf)
      .extract({ left: cx, top: 0, width: target.w, height: sh })
      .png()
      .toBuffer();
    cw = target.w;
  }
  const left = Math.round((target.w - cw) / 2);
  const top = Math.max(0, target.h - medFB - sh);
  await sharp({
    create: {
      width: target.w,
      height: target.h,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: charBuf, left, top }])
    .png()
    .toFile(file);
  return {
    mode: "rescale",
    frame,
    beforeH: target.bh,
    afterH: medH,
    medFromBottom: medFB,
    siblings: sibs.length,
  };
}

async function copyNearest(frame) {
  const file = `${DIR}/${frame}.png`;
  const idx = parseInt(frame.match(/(\d+)$/)?.[1] ?? "0", 10);
  const sibs = siblingsOf(frame)
    .filter((s) => s !== frame)
    .map((s) => ({ s, i: parseInt(s.match(/(\d+)$/)?.[1] ?? "0", 10) }));
  let best = null;
  for (const { s, i } of sibs) {
    const bb = await bbox(`${DIR}/${s}.png`);
    if (bb.empty) continue;
    const d = Math.abs(i - idx);
    if (!best || d < best.d) best = { s, d };
  }
  if (!best) throw new Error("sem vizinho bom p/ copiar");
  const buf = readFileSync(`${DIR}/${best.s}.png`);
  await sharp(buf).toFile(file);
  return { mode: "copy-nearest", frame, copiedFrom: best.s };
}

const [frame, mode = "rescale"] = process.argv.slice(2);
if (!frame) {
  console.error("uso: node scripts/frame-fix.mjs <frame> [rescale|copy-nearest]");
  process.exit(2);
}
try {
  const r = mode === "copy-nearest" ? await copyNearest(frame) : await rescale(frame);
  console.log(JSON.stringify({ ok: true, ...r }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: String(e.message ?? e) }));
  process.exit(1);
}
