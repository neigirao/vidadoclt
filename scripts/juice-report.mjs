// ─────────────────────────────────────────────────────────────────────────────
// Juice Report — imprime o "orçamento de feel" do jogo (squash & stretch, hit-stop,
// shake) a partir da fonte única em src/game/systems/Juice.ts. É a foto de tuning:
// um lugar só pra ver/ajustar o game feel, como o sim:balance faz com os números.
//
// Roda com bun (import de .ts direto), determinístico, sem navegador.
// Uso: bun juice:report   |   bun juice:report --json
// ─────────────────────────────────────────────────────────────────────────────
import { JUICE } from "../src/game/systems/Juice.ts";

const asJson = process.argv.includes("--json");
if (asJson) {
  console.log(JSON.stringify(JUICE, null, 2));
  process.exit(0);
}

const pct = (v) => `${v > 1 ? "+" : ""}${Math.round((v - 1) * 100)}%`;
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

console.log(`\n── Juice Report ── orçamento de feel (fonte: systems/Juice.ts) ──\n`);

console.log("SQUASH & STRETCH (escala no pico · ida→volta com yoyo):");
console.log(
  `  ${pad("evento", 10)}${padL("larg.", 8)}${padL("alt.", 8)}${padL("ida", 7)}${padL("total", 8)}  ease`,
);
for (const [name, s] of Object.entries(JUICE.squash)) {
  console.log(
    `  ${pad(name, 10)}${padL(pct(s.sx), 8)}${padL(pct(s.sy), 8)}${padL(`${s.ms}ms`, 7)}${padL(`${s.ms * 2}ms`, 8)}  ${s.ease}`,
  );
}

console.log(`\nHIT-STOP (pausa de física no impacto):`);
for (const [name, ms] of Object.entries(JUICE.hitStop)) {
  console.log(`  ${pad(name, 10)}${padL(`${ms}ms`, 7)}`);
}

console.log(`\nSCREEN SHAKE (duração · amplitude):`);
console.log(`  ${pad("preset", 10)}${padL("dur", 8)}${padL("amp", 9)}`);
for (const [name, s] of Object.entries(JUICE.shake)) {
  console.log(`  ${pad(name, 10)}${padL(`${s.ms}ms`, 8)}${padL(s.amp.toFixed(3), 9)}`);
}

console.log(`\nℹ Ajuste o feel em src/game/systems/Juice.ts (uma edição afeta o jogo todo).\n`);
process.exit(0);
