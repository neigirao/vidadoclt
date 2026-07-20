// ─────────────────────────────────────────────────────────────────────────────
// Consistência de PALETA por personagem — pega arte *mismatched* (frame de OUTRO
// personagem com a dimensão certa e conteúdo não-trivial), que o check:frames
// (quantidade/tamanho) e o audit:sprites (vazio/chapado/faltando) não veem.
//
// IDEIA: cada personagem tem uma paleta canônica (as cores dos estados "limpos"
// idle+walk). Um estado cujo conteúdo usa MUITAS cores fora dessa paleta (além de
// uma tolerância de distância RGB) provavelmente é arte trocada. Reportamos a
// "% de pixels estrangeiros" por frame.
//
// Estático (lê atlas.png/json, sem navegador). Determinístico. Modo relatório por
// padrão; `--gate` sai com código 1 acima do teto (hoje NÃO ligado no CI —
// calibrando primeiro, igual visual regression começou como observação).
//
// Uso: node scripts/palette-consistency.mjs [--gate] [--top=N]
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";

const gate = process.argv.includes("--gate");
const topN = Number((process.argv.find((a) => a.startsWith("--top=")) || "--top=30").split("=")[1]);

// Calibração: pixel é "estrangeiro" se a distância² p/ a cor mais próxima da paleta
// de referência > DIST2. Frame é suspeito se >FOREIGN_PCT dos pixels opacos são
// estrangeiros. Ref = idle+walk (estados que raramente vêm trocados).
const DIST2 = 60 * 60; // ~60 de distância RGB por canal combinado
const FOREIGN_PCT = 35; // acima disso, provável arte trocada
const REF_STATES = ["idle", "walk"];
const CHECK_STATES = ["attack", "hurt", "death", "run"];

const atlas = JSON.parse(readFileSync(new URL("../public/assets/atlas.json", import.meta.url)));
const png = PNG.sync.read(readFileSync(new URL("../public/assets/atlas.png", import.meta.url)));
const map = {};
for (const t of atlas.textures) for (const f of t.frames) map[f.filename] = f;

const re = /^(.*?)-(idle|walk|run|attack|hurt|death)(\d+)$/;
const chars = {}; // prefix -> { state -> [filenames] }
for (const name of Object.keys(map)) {
  const m = name.match(re);
  if (!m) continue;
  ((chars[m[1]] = chars[m[1]] || {})[m[2]] = chars[m[1]][m[2]] || []).push({ name, n: +m[3] });
}

function pixels(frameName) {
  const fr = map[frameName];
  if (!fr) return [];
  const { x, y, w, h } = fr.frame;
  const out = [];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const s = ((y + j) * png.width + (x + i)) * 4;
      if (png.data[s + 3] > 40) out.push([png.data[s], png.data[s + 1], png.data[s + 2]]);
    }
  return out;
}

// Paleta de referência: cores DISTINTAS (quantizadas a passo 8) de idle+walk.
function refPalette(prefix) {
  const set = new Set();
  const list = [];
  for (const st of REF_STATES)
    for (const fr of chars[prefix]?.[st] ?? []) {
      for (const [r, g, b] of pixels(fr.name)) {
        const key = (r >> 3) + "," + (g >> 3) + "," + (b >> 3);
        if (!set.has(key)) {
          set.add(key);
          list.push([r, g, b]);
        }
      }
    }
  return list;
}

function foreignPct(px, pal) {
  if (px.length === 0 || pal.length === 0) return 0;
  let foreign = 0;
  for (const [r, g, b] of px) {
    let best = Infinity;
    for (const [pr, pg, pb] of pal) {
      const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (d < best) {
        best = d;
        if (best <= DIST2) break;
      }
    }
    if (best > DIST2) foreign++;
  }
  return (foreign / px.length) * 100;
}

const rows = [];
for (const prefix of Object.keys(chars)) {
  if (prefix.startsWith("item-") || prefix.startsWith("obj-")) continue;
  const pal = refPalette(prefix);
  if (pal.length < 4) continue; // sem referência confiável
  for (const st of CHECK_STATES)
    for (const fr of chars[prefix]?.[st] ?? []) {
      const pct = foreignPct(pixels(fr.name), pal);
      if (pct >= 20) rows.push({ prefix, st, n: fr.n, name: fr.name, pct });
    }
}
rows.sort((a, b) => b.pct - a.pct);

console.log(`Consistência de paleta — ${rows.length} frame(s) com ≥20% de cor estrangeira:`);
for (const r of rows.slice(0, topN)) console.log(`  ${r.pct.toFixed(0).padStart(3)}%  ${r.name}`);

const suspects = rows.filter((r) => r.pct >= FOREIGN_PCT);
console.log(`\n${suspects.length} suspeito(s) acima do teto (${FOREIGN_PCT}%).`);
if (gate && suspects.length) process.exit(1);
