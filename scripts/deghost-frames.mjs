// ─────────────────────────────────────────────────────────────────────────────
// De-ghost de frames — conserta os frames FANTASMADOS (dois personagens sobrepostos)
// que a geração de in-betweens por blend produziu na cauda de vários ciclos.
//
// DETECTOR (específico, validado): um frame fantasmado tem MUITO mais pixels
// opacos que os limpos da família (o 2º personagem soma cobertura). Flaga frames
// cujo opaque-count > FACTOR × mediana da família E que têm um vizinho limpo.
//
// CONSERTO (opção "de-ghost", determinístico): copia o PNG do vizinho LIMPO mais
// próximo por cima do frame fantasmado (copy-nearest). Troca o fantasma por uma
// micro-repetição de pose — pior que arte nova, muito melhor que imagem dupla.
//
// Fonte = public/assets/sprites/*.png (o atlas é empacotado disso). Reempacota 1×
// no fim. `--dry` só imprime o plano (nada é tocado).
//
// Uso: node scripts/deghost-frames.mjs [--dry] [--factor=1.28]
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PNG } from "pngjs";

const dry = process.argv.includes("--dry");
const factorArg = process.argv.find((a) => a.startsWith("--factor="));
const FACTOR = factorArg ? parseFloat(factorArg.split("=")[1]) : 1.28;
const SPRITES = "public/assets/sprites";

// Estados CÍCLICOS que renderizam em movimento (onde o fantasma aparece andando).
const STATES = ["walk", "run"];

const atlas = JSON.parse(readFileSync("public/assets/atlas.json"));
const png = PNG.sync.read(readFileSync("public/assets/atlas.png"));
const map = {};
for (const t of atlas.textures) for (const f of t.frames) map[f.filename] = f;

/** Pixels opacos (alpha>40) de um frame do atlas. */
function opaque(name) {
  const fr = map[name]?.frame;
  if (!fr) return -1;
  const { x, y, w, h } = fr;
  let op = 0;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) if (png.data[((y + j) * png.width + (x + i)) * 4 + 3] > 40) op++;
  return op;
}
function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Agrupa por família|estado (frames contíguos a partir do 0).
const anims = {};
const re = /^(.*?)-(walk|run)(\d+)$/;
for (const name of Object.keys(map)) {
  const m = name.match(re);
  if (!m || !STATES.includes(m[2])) continue;
  const key = `${m[1]}-${m[2]}`;
  (anims[key] = anims[key] || []).push({ n: +m[3], name });
}

const plan = [];
for (const [key, frames] of Object.entries(anims)) {
  frames.sort((a, b) => a.n - b.n);
  const seq = [];
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].n !== i) break;
    seq.push(frames[i]);
  }
  if (seq.length < 4) continue;
  const counts = seq.map((f) => opaque(f.name));
  const med = median(counts);
  if (med <= 0) continue;
  // Só famílias com VARIÂNCIA (algum frame claramente mais "cheio"): evita
  // famílias uniformemente densas (sem fantasma, só arte cheia).
  const ghosts = seq.filter((_, i) => counts[i] > med * FACTOR);
  if (ghosts.length === 0) continue;
  // Guard: se MAIS da metade da família é "fantasma", provavelmente não é
  // fantasma — é a família toda densa. Pula (não confia no detector aí).
  if (ghosts.length > seq.length / 2) continue;
  // Índices limpos (não-fantasma).
  const cleanIdx = seq.map((_, i) => i).filter((i) => counts[i] <= med * FACTOR);
  if (cleanIdx.length === 0) continue;
  for (let i = 0; i < seq.length; i++) {
    if (counts[i] <= med * FACTOR) continue;
    // vizinho limpo mais próximo por índice.
    const nearest = cleanIdx.reduce((a, b) => (Math.abs(b - i) < Math.abs(a - i) ? b : a));
    plan.push({
      family: key,
      ghost: seq[i].name,
      clean: seq[nearest].name,
      ratio: (counts[i] / med).toFixed(2),
    });
  }
}

if (plan.length === 0) {
  console.log(`\n✓ nenhum frame fantasmado detectado (factor ${FACTOR}).\n`);
  process.exit(0);
}

console.log(`\n── De-ghost ── ${plan.length} frame(s) fantasmado(s) (factor ${FACTOR}) ──\n`);
const byFam = {};
for (const p of plan) (byFam[p.family] = byFam[p.family] || []).push(p);
for (const [fam, ps] of Object.entries(byFam)) {
  console.log(`  ${fam} (${ps.length}):`);
  for (const p of ps) console.log(`    ${p.ghost} (${p.ratio}×) ← ${p.clean}`);
}

if (dry) {
  console.log(
    `\n[dry] nada tocado. Rode sem --dry para aplicar (${plan.length} cópias + repack).\n`,
  );
  process.exit(0);
}

let applied = 0;
for (const p of plan) {
  const src = `${SPRITES}/${p.clean}.png`;
  const dst = `${SPRITES}/${p.ghost}.png`;
  if (!existsSync(src) || !existsSync(dst)) {
    console.warn(`  ⚠ pulado (PNG ausente): ${p.ghost}`);
    continue;
  }
  copyFileSync(src, dst);
  applied++;
}
console.log(`\n${applied} frame(s) substituído(s). Reempacotando o atlas…`);
const r = spawnSync("node", ["scripts/pack-atlas.mjs"], { stdio: "inherit" });
process.exit(r.status ?? 0);
