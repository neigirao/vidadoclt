// ─────────────────────────────────────────────────────────────────────────────
// Balance Simulator (CLI) — imprime o relatório de balanceamento do jogo a partir
// do modelo puro em src/game/systems/BalanceModel.ts (mesmas fontes canônicas que
// o jogo: WEAPONS/CLASSES/ENEMIES + MeleeMath).
//
// USO:
//   bun sim:balance                 relatório do loop 0 (Segunda-feira)
//   bun sim:balance --loop=3        com o escalonamento de HP de 3 loops
//   bun sim:balance --json          saída JSON (máquina/diff)
//   bun sim:balance --gate          sai !=0 se houver flag "warn" (portão de CI opt-in)
//
// Roda com bun (import de .ts direto). NÃO sobe navegador — é modelo numérico,
// instantâneo e determinístico. É um MODELO DE 1ª ORDEM: pega desproporção grossa
// e regressão, não substitui playtest (ver cabeçalho de BalanceModel.ts).
// ─────────────────────────────────────────────────────────────────────────────
import { analyzeBalance, THRESHOLDS } from "../src/game/systems/BalanceModel.ts";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const gate = args.includes("--gate");
const loopArg = args.find((a) => a.startsWith("--loop="));
const loop = loopArg ? Math.max(0, parseInt(loopArg.split("=")[1], 10) || 0) : 0;

const report = analyzeBalance(loop);

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(gate && report.flags.some((f) => f.severity === "warn") ? 1 : 0);
}

const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

console.log(`\n── Balance Simulator ── loop ${loop}${loop === 0 ? " (Segunda-feira)" : ""} ──\n`);

// Classes (DPS com arma inicial + vida efetiva).
console.log("CLASSES (arma inicial):");
console.log(`  ${pad("classe", 14)}${pad("arma", 20)}${padL("DPS", 8)}${padL("vida ef.", 10)}`);
for (const c of report.classes) {
  console.log(
    `  ${pad(c.id, 14)}${pad(c.startWeapon, 20)}${padL(c.dps.toFixed(1), 8)}${padL(c.effHp.toFixed(0), 10)}`,
  );
}
console.log(
  `  → spread de DPS: ${report.dpsSpread.toFixed(2)} (limite ${THRESHOLDS.dpsSpreadRatio})\n`,
);

// Progressão de armas (Analista neutro).
console.log("ARMAS (DPS, classe Analista, ordenado):");
console.log(`  ${pad("arma", 22)}${pad("raridade", 12)}${padL("DPS", 8)}`);
for (const w of report.weaponDpsAnalista) {
  console.log(`  ${pad(w.id, 22)}${pad(w.rarity, 12)}${padL(w.dps.toFixed(1), 8)}`);
}
console.log("");

// Inimigos por fase: TTK médio + pressão.
console.log("INIMIGOS (TTK médio p/ matar · pressão · tempo até derrubar o player):");
console.log(
  `  ${pad("inimigo", 26)}${padL("F", 3)}${padL("HP", 6)}${padL("TTK(s)", 9)}${padL("pressão", 9)}${padL("cai em(s)", 11)}`,
);
const byPhase = [...report.enemies].sort((a, b) => a.phase - b.phase || a.ttkAvg - b.ttkAvg);
for (const e of byPhase) {
  const down = e.timeToDownAvg === Infinity ? "—" : e.timeToDownAvg.toFixed(1);
  const tag = e.isMidboss ? " ★" : "";
  console.log(
    `  ${pad(e.label + tag, 26)}${padL(e.phase, 3)}${padL(e.hp.toFixed(0), 6)}${padL(e.ttkAvg.toFixed(1), 9)}${padL(e.incomingDps.toFixed(0), 9)}${padL(down, 11)}`,
  );
}
console.log("");

// Flags.
if (report.flags.length === 0) {
  console.log("✓ nenhum outlier de balanceamento sinalizado.\n");
} else {
  const warns = report.flags.filter((f) => f.severity === "warn");
  const infos = report.flags.filter((f) => f.severity === "info");
  if (warns.length) {
    console.log(`⚠ ${warns.length} aviso(s):`);
    for (const f of warns) console.log(`  ⚠ [${f.kind}] ${f.msg}`);
  }
  if (infos.length) {
    console.log(`\nℹ ${infos.length} nota(s) (não bloqueiam):`);
    for (const f of infos) console.log(`  ℹ [${f.kind}] ${f.msg}`);
  }
  console.log("");
}

process.exit(gate && report.flags.some((f) => f.severity === "warn") ? 1 : 0);
