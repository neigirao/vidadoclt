import Phaser from "phaser";
import seedrandom from "seedrandom";

// Thematic seed prefixes — corporate Brazilian slang
const PREFIXES = [
  "CLT",
  "FGTS",
  "META",
  "KPIS",
  "JIRA",
  "HORA",
  "MEMO",
  "MGMT",
  "PGTO",
  "AGIL",
  "PJBT",
  "CNPJ",
];

// Entropia NATIVA capturada no load do módulo, ANTES de qualquer `applyRunSeed`
// clobbar `Math.random`. Geração de seed/ids NÃO pode herdar o PRNG semeado da
// run (senão dois jogadores na mesma seed geram a MESMA "próxima" seed e o mesmo
// id de sessão de telemetria). Gameplay determinístico segue usando o global.
const nativeRandom: () => number =
  typeof crypto !== "undefined" && crypto.getRandomValues
    ? () => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000
    : Math.random.bind(Math);

/** Aleatório NÃO-semeado (não afetado por `applyRunSeed`). Para seeds/ids. */
export function unseededRandom(): number {
  return nativeRandom();
}

/**
 * Generates a human-readable, thematic seed string for a new run.
 * Format: PREFIX-NNNN  (e.g. "FGTS-4821", "META-3319")
 */
export function generateSeed(): string {
  const prefix = PREFIXES[Math.floor(unseededRandom() * PREFIXES.length)];
  const num = String(Math.floor(unseededRandom() * 9000) + 1000);
  return `${prefix}-${num}`;
}

/**
 * Seeds all RNG sources for a run.
 * Call once at the start of each new run (ClassSelectScene.create).
 *
 * Seeds:
 * - Phaser.Math.RND — covers Phaser.Math.Between, Utils.Array.Shuffle/GetRandom
 * - Math.random     — covers all other game code (Shop, Enemies, etc.)
 */
export function applyRunSeed(seed: string): void {
  Phaser.Math.RND.sow([seed]);
  Math.random = seedrandom(seed);
}
