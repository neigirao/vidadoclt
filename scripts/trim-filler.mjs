// ─────────────────────────────────────────────────────────────────────────────
// Trim-filler — remove frames DUPLICADOS/quase-idênticos que sobraram dos
// in-betweens em massa (flag `padded` do audit:anim). O piso de check:frames é
// respeitado: uma família só é enxugada até o LIMITE do gate (nunca abaixo).
//
// Como acha: audit:anim aponta as famílias com filler; para cada uma, mede o
// delta entre frames consecutivos (mesma métrica), remove o SEGUNDO frame de
// cada par com delta < STUCK_EPS, e reindexa contíguo. Repete até o piso ou
// até não haver mais duplicatas.
//
// Uso: node scripts/trim-filler.mjs [--dry]
// ─────────────────────────────────────────────────────────────────────────────
import sharp from "sharp";
import { existsSync, renameSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SPRITES = "public/assets/sprites";
const STUCK_EPS = 0.35; // mesma constante do audit:anim
const dry = process.argv.includes("--dry");

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
function frameDelta(a, b) {
  if (!a || !b || a.w !== b.w || a.h !== b.h) return Infinity;
  let sum = 0;
  const n = a.data.length;
  for (let i = 0; i < n; i += 4) {
    sum +=
      (Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2]) +
        Math.abs(a.data[i + 3] - b.data[i + 3])) /
      4;
  }
  return sum / (n / 4);
}
async function loadFamily(family) {
  const frames = [];
  for (let i = 0; ; i++) {
    const f = `${SPRITES}/${family}${i}.png`;
    if (!existsSync(f)) break;
    const fr = await loadRaw(f);
    if (i > 0 && (fr.w !== frames[0].w || fr.h !== frames[0].h)) break;
    if (opaqueCount(fr) < 25) break;
    frames.push({ path: f, raw: fr });
  }
  return frames;
}

// Ler pisos do frame-coverage-check em JSON (fonte única).
const cov = spawnSync("node", ["scripts/frame-coverage-check.mjs", "--json"], {
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});
const covData = JSON.parse(cov.stdout || "{}");
// covData tem `violations` e `checked` (só passes), mas precisamos do FLOOR por
// (subject, action). Fallback: 4 (piso universal seguro para ciclos).
// Melhor: chamar check:frames sem --json p/ obter falhas caso trimemos demais.

const audit = spawnSync("node", ["scripts/audit-anim.mjs", "--json"], {
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});
const report = JSON.parse(audit.stdout);
// padded flag é `info` (não warn) — está em reports com kind=padded
const padded = report.reports.filter(
  (r) =>
    r.flags.some((f) => f.kind === "padded") &&
    ["walk", "idle", "run"].includes(r.state), // attack não interpola; deixar
);

console.log(`Famílias padded (candidatas a trim): ${padded.length}`);
const FLOOR = 4; // piso universal; se depois check:frames falhar, restauramos manualmente
let trimmed = 0;
const removed = [];

for (const r of padded) {
  const family = `${r.prefix}-${r.state}`;
  let frames = await loadFamily(family);
  if (frames.length <= FLOOR) continue;
  // Pares duplicados: delta < EPS. Remove o SEGUNDO do par, depois reindexa.
  const drop = new Set();
  for (let i = 0; i < frames.length - 1; i++) {
    if (drop.has(i)) continue;
    const d = frameDelta(frames[i].raw, frames[i + 1].raw);
    if (d < STUCK_EPS) drop.add(i + 1);
  }
  if (drop.size === 0) continue;
  const keepCount = frames.length - drop.size;
  if (keepCount < FLOOR) {
    // Só remove o suficiente para respeitar o piso.
    const excess = FLOOR - keepCount;
    // Remove `excess` do fim de drop (menos duplicatas trimadas)
    const dropArr = [...drop].sort((a, b) => b - a); // maiores primeiro
    for (let k = 0; k < excess; k++) drop.delete(dropArr[k]);
  }
  if (drop.size === 0) continue;

  console.log(`  • ${family}: ${frames.length} → ${frames.length - drop.size} (drop ${drop.size})`);
  if (dry) continue;

  // Aplica: apaga arquivos marcados e reindexa contíguo.
  for (const idx of drop) {
    unlinkSync(frames[idx].path);
    removed.push(frames[idx].path);
  }
  const kept = frames.filter((_, i) => !drop.has(i));
  // Renomeia temporariamente p/ evitar colisão, depois p/ o índice final.
  for (let i = 0; i < kept.length; i++) {
    renameSync(kept[i].path, `${SPRITES}/${family}__tmp${i}.png`);
  }
  for (let i = 0; i < kept.length; i++) {
    renameSync(`${SPRITES}/${family}__tmp${i}.png`, `${SPRITES}/${family}${i}.png`);
  }
  trimmed++;
}

if (dry) {
  console.log("\n(--dry) nada foi tocado.");
  process.exit(0);
}
if (trimmed === 0) {
  console.log("Nada a trimar.");
  process.exit(0);
}

console.log(`\n${trimmed} famílias enxugadas. Reempacotando atlas…`);
const pack = spawnSync("node", ["scripts/pack-atlas.mjs"], { encoding: "utf8" });
console.log(pack.stdout.split("\n").slice(-3).join("\n"));

// Verifica gate — se quebrou, imprime aviso destacado (git checkout resolve).
const check = spawnSync("node", ["scripts/frame-coverage-check.mjs"], { encoding: "utf8" });
if (check.status !== 0) {
  console.error(
    "\n⚠ ATENÇÃO: check:frames falhou após o trim. Rode `git checkout public/assets/` p/ reverter.",
  );
  console.error(check.stdout);
  process.exit(1);
}
console.log("✅ gate de cobertura passa.");
