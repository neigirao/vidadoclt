// ─────────────────────────────────────────────────────────────────────────────
// Auto-fill de cobertura: roda o GATE (`frame-coverage-check --json`), pega as
// violações e resolve cada uma DETERMINISTICAMENTE via `gen-inbetweens.mjs`
// (dobra o ciclo intercalando in-betweens — mesma técnica do fix manual). No
// fim, reempacota o atlas UMA VEZ (os inbetweens rodam com --no-pack em lote).
//
// Uso:
//   node scripts/frame-coverage-fill.mjs           # aplica e reempacota
//   node scripts/frame-coverage-fill.mjs --dry     # só imprime o plano
//
// Notas:
// - Só resolve violações que o gen-inbetweens SABE resolver: ações cíclicas
//   (walk/idle/run) e attack (não-cíclico). hurt/death/jump/fall/dash com
//   piso violado ficam de fora (loops curtos exigem arte nova, não interp) e
//   são REPORTADOS pra decisão humana.
// - Uma família pode precisar de MAIS de uma passada (dobrar 4→8 pode ainda
//   ficar abaixo de 16). Itera até o gate PASSAR ou estabilizar (sem progresso).
// ─────────────────────────────────────────────────────────────────────────────
import { spawnSync } from "node:child_process";

const DRY = process.argv.includes("--dry");
const MAX_PASSES = 4; // 4 → 8 → 16 → 32 → 64: suficiente pra qualquer piso realista
const INTERP_ACTIONS = new Set(["walk", "idle", "run", "attack"]);

function runCoverage() {
  const r = spawnSync("node", ["scripts/frame-coverage-check.mjs", "--json"], { encoding: "utf8" });
  // exit 1 = há violações; 0 = ok. Ambos com JSON no stdout.
  return JSON.parse(r.stdout);
}

function runInbetween(family, extraFlags = []) {
  const args = ["scripts/gen-inbetweens.mjs", family, "--no-pack", ...extraFlags];
  const r = spawnSync("node", args, { encoding: "utf8", stdio: "inherit" });
  return r.status === 0;
}

function repack() {
  const r = spawnSync("node", ["scripts/pack-atlas.mjs"], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("pack-atlas falhou");
}

// ── Passada 1: colher plano ──────────────────────────────────────────────────
let report = runCoverage();
if (report.ok) {
  console.log("✅ cobertura já está OK — nada a fazer.");
  process.exit(0);
}

const solvable = report.violations.filter((v) => INTERP_ACTIONS.has(v.action));
const unsolvable = report.violations.filter((v) => !INTERP_ACTIONS.has(v.action));

console.log(`Plano: ${solvable.length} família(s) via gen-inbetweens; ${unsolvable.length} pulada(s) (ação sem interp).`);
for (const v of solvable) console.log(`  ↳ ${v.subject}-${v.action}: tem ${v.have}, min ${v.min}`);
if (unsolvable.length) {
  console.log("Pulados (precisam de arte nova, não interpolação):");
  for (const v of unsolvable) console.log(`  · ${v.subject}/${v.action}: tem ${v.have}, min ${v.min}`);
}

if (DRY) {
  console.log("\n(--dry) nada foi alterado.");
  process.exit(unsolvable.length ? 2 : 0);
}

// ── Loop: gera in-betweens em lote e re-avalia; para se não houve progresso ──
let pass = 0;
let prevPending = -1;
while (pass < MAX_PASSES) {
  pass++;
  const pending = report.violations.filter((v) => INTERP_ACTIONS.has(v.action));
  if (pending.length === 0) break;
  if (pending.length === prevPending) {
    console.warn(`⚠ nenhuma progressão na passada ${pass} — abortando loop.`);
    break;
  }
  prevPending = pending.length;

  console.log(`\n── passada ${pass}: gerando in-betweens para ${pending.length} família(s) ──`);
  for (const v of pending) {
    const family = `${v.subject}-${v.action}`;
    const flags = v.action === "attack" ? ["--no-cyclic"] : [];
    const ok = runInbetween(family, flags);
    if (!ok) console.warn(`  ⚠ falha em ${family} (segue adiante)`);
  }

  // Reempacota ANTES do próximo check (gate lê atlas.json).
  repack();
  report = runCoverage();
  if (report.ok) {
    console.log(`\n✅ cobertura OK após ${pass} passada(s).`);
    process.exit(unsolvable.length ? 2 : 0);
  }
}

// Estado final
if (!report.ok) {
  const stillSolvable = report.violations.filter((v) => INTERP_ACTIONS.has(v.action));
  if (stillSolvable.length) {
    console.error(`❌ ainda faltam ${stillSolvable.length} violação(ões) interpoláveis após ${MAX_PASSES} passadas.`);
    for (const v of stillSolvable) console.error(`  · ${v.subject}/${v.action}: tem ${v.have}, min ${v.min}`);
  }
  if (unsolvable.length) {
    console.error(`ℹ ${unsolvable.length} violação(ões) exigem arte nova (não interpoláveis).`);
  }
  process.exit(1);
}
