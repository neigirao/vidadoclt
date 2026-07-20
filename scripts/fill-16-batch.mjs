// ─────────────────────────────────────────────────────────────────────────────
// Batch: leva TODA família|ação abaixo de 16 frames a >=16 via gen-inbetweens
// (interpolação GRÁTIS, determinística, sem IA). Reempacota o atlas 1x no fim.
//
// - CÍCLICAS (walk/idle/run): --cyclic (loop fechado).
// - NÃO-CÍCLICAS (attack/hurt/death/jump/fall/dash): --no-cyclic.
// - Itens (item-*) e single-frame (dash de 1 frame) são PULADOS: renderizam frame
//   estático, não ciclam — 16 frames ali é bloat sem reflexo no jogo.
//
// Uso: node scripts/fill-16-batch.mjs [--dry]
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SPRITES = "public/assets/sprites";
const TARGET = 16;
const dry = process.argv.includes("--dry");

const CYCLIC = new Set(["walk", "idle", "run"]);
// Ações que o motor NÃO cicla p/ nenhum sujeito → pular (sem reflexo no jogo).
// player jump/fall/dash: single/curtas, tratadas à parte. Mantemos attack/hurt/death.
const SKIP_ACTIONS = new Set(["jump", "fall", "dash"]);

const re = /^(.*?)-(idle|walk|run|attack|hurt|death)(\d+)$/;

function countContiguous() {
  const files = new Set(
    readdirSync(SPRITES)
      .filter((f) => f.endsWith(".png"))
      .map((f) => f.slice(0, -4)),
  );
  const fam = {};
  for (const n of files) {
    const m = n.match(re);
    if (!m) continue;
    fam[`${m[1]}-${m[2]}`] = true;
  }
  const cont = {};
  for (const key of Object.keys(fam)) {
    let c = 0;
    while (files.has(`${key}${c}`)) c++;
    cont[key] = c;
  }
  return cont;
}

const cont = countContiguous();
const targets = Object.entries(cont)
  .filter(([key, c]) => {
    if (c >= TARGET) return false;
    if (c < 2) return false; // precisa de >=2 p/ interpolar
    if (key.startsWith("item-")) return false; // itens: estáticos
    const action = key.split("-").pop();
    if (SKIP_ACTIONS.has(action)) return false;
    return true;
  })
  .sort();

console.log(`${targets.length} famílias|ação abaixo de ${TARGET}:`);
for (const [key, c] of targets) console.log(`  ${String(c).padStart(2)} → ${key}`);
if (dry) process.exit(0);

let ran = 0;
for (const [key] of targets) {
  const action = key.split("-").pop();
  const flag = CYCLIC.has(action) ? "--cyclic" : "--no-cyclic";
  // Dobrar até >=16, re-lendo a contagem do dir a cada passo.
  for (let guard = 0; guard < 5; guard++) {
    const cur = countContiguous()[key] ?? 0;
    if (cur >= TARGET) break;
    const r = spawnSync("node", ["scripts/gen-inbetweens.mjs", key, flag, "--no-pack"], {
      encoding: "utf8",
    });
    if (r.status !== 0) {
      console.error(`FALHOU ${key}:`, r.stderr || r.stdout);
      break;
    }
    ran++;
  }
}

console.log(`\n${ran} passes de interpolação. Reempacotando atlas 1x…`);
const pack = spawnSync("node", ["scripts/pack-atlas.mjs"], { encoding: "utf8" });
console.log(pack.stdout.split("\n").slice(-3).join("\n"));
