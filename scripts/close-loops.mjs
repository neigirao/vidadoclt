// ─────────────────────────────────────────────────────────────────────────────
// Close-loops — fecha os LOOP-POPs sinalizados por audit:anim. Determinístico,
// sem IA. Roda o auditor em JSON, seleciona famílias walk/idle/run com flag
// `loop-pop`, e para cada uma gera 1 frame extra AO FINAL: o in-between entre
// o último frame e o primeiro (mesmo motor de blend + trava-de-paleta do
// gen-inbetweens.mjs). Isso suaviza o wrap → o ciclo deixa de "estalar" quando
// repete. Reempacota o atlas 1× no fim.
//
// Uso: node scripts/close-loops.mjs [--dry] [--include-attack]
// ─────────────────────────────────────────────────────────────────────────────
import sharp from "sharp";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SPRITES = "public/assets/sprites";
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const includeAttack = args.includes("--include-attack");
const CYCLIC = new Set(["walk", "idle", "run", ...(includeAttack ? ["attack"] : [])]);

async function loadRaw(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
function opaqueCount(fr) {
  let op = 0;
  for (let i = 3; i < fr.data.length; i += 4) if (fr.data[i] > 30 && ++op >= 25) return op;
  return op;
}
// Frames contíguos e válidos (mesma regra do gen-inbetweens).
async function loadFamily(family) {
  const frames = [];
  for (let i = 0; ; i++) {
    const f = `${SPRITES}/${family}${i}.png`;
    if (!existsSync(f)) break;
    const fr = await loadRaw(f);
    if (i > 0 && (fr.w !== frames[0].w || fr.h !== frames[0].h)) break;
    if (opaqueCount(fr) < 25) break;
    frames.push(fr);
  }
  return frames;
}
function paletteOf(frames) {
  const pal = new Map();
  for (const fr of frames) {
    for (let i = 0; i < fr.data.length; i += 4) {
      if (fr.data[i + 3] > 128) {
        const key = (fr.data[i] << 16) | (fr.data[i + 1] << 8) | fr.data[i + 2];
        pal.set(key, [fr.data[i], fr.data[i + 1], fr.data[i + 2]]);
      }
    }
  }
  return [...pal.values()];
}
function nearest(pal, r, g, b) {
  let best = pal[0],
    bd = Infinity;
  for (const c of pal) {
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}
function tween(A, B) {
  const pal = paletteOf([A, B]);
  const out = Buffer.alloc(A.data.length);
  for (let i = 0; i < A.data.length; i += 4) {
    const aA = A.data[i + 3],
      aB = B.data[i + 3];
    const oA = aA > 128,
      oB = aB > 128;
    if (!oA && !oB) continue;
    let r, g, b;
    if (oA && oB) {
      r = (A.data[i] + B.data[i]) >> 1;
      g = (A.data[i + 1] + B.data[i + 1]) >> 1;
      b = (A.data[i + 2] + B.data[i + 2]) >> 1;
    } else if (oA) {
      [r, g, b] = [A.data[i], A.data[i + 1], A.data[i + 2]];
    } else {
      [r, g, b] = [B.data[i], B.data[i + 1], B.data[i + 2]];
    }
    const [nr, ng, nb] = nearest(pal, r, g, b);
    out[i] = nr;
    out[i + 1] = ng;
    out[i + 2] = nb;
    out[i + 3] = 255;
  }
  return { data: out, w: A.w, h: A.h };
}
const rawToPng = (fr) => sharp(fr.data, { raw: { width: fr.w, height: fr.h, channels: 4 } }).png();

// Rodar audit:anim em modo JSON e coletar famílias com loop-pop.
const audit = spawnSync("node", ["scripts/audit-anim.mjs", "--json"], {
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});
if (audit.status !== 0 && audit.status !== null) {
  console.error("audit-anim falhou:", audit.stderr);
  process.exit(2);
}
const report = JSON.parse(audit.stdout);
const targets = report.reports.filter(
  (r) => CYCLIC.has(r.state) && r.flags.some((f) => f.kind === "loop-pop"),
);

console.log(`Loop-pops a fechar: ${targets.length}`);
for (const r of targets) console.log(`  • ${r.prefix}-${r.state} (${r.frames} frames)`);
if (dry || targets.length === 0) process.exit(0);

let fixed = 0;
for (const r of targets) {
  const family = `${r.prefix}-${r.state}`;
  const frames = await loadFamily(family);
  if (frames.length < 2) {
    console.warn(`  ↳ ${family}: <2 frames, pulado`);
    continue;
  }
  const last = frames[frames.length - 1];
  const first = frames[0];
  const t = tween(last, first);
  const outPath = `${SPRITES}/${family}${frames.length}.png`;
  await rawToPng(t).toFile(outPath);
  fixed++;
}
console.log(`\n${fixed} loops fechados. Reempacotando atlas…`);
const pack = spawnSync("node", ["scripts/pack-atlas.mjs"], { encoding: "utf8" });
console.log(pack.stdout.split("\n").slice(-3).join("\n"));
process.exit(pack.status ?? 0);
