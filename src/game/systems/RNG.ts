import Phaser from "phaser";
// seedrandom is a transitive dependency — declare types inline
declare function seedrandom(seed: string): () => number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _seedrandom = require("seedrandom") as typeof seedrandom;

// Thematic seed prefixes — corporate Brazilian slang
const PREFIXES = [
  "CLT", "FGTS", "META", "KPIS", "JIRA", "HORA",
  "MEMO", "MGMT", "PGTO", "AGIL", "PJBT", "CNPJ",
];

/**
 * Generates a human-readable, thematic seed string for a new run.
 * Format: PREFIX-NNNN  (e.g. "FGTS-4821", "META-3319")
 */
export function generateSeed(): string {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const num = String(Math.floor(Math.random() * 9000) + 1000);
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
  Math.random = _seedrandom(seed);
}
