// ─────────────────────────────────────────────────────────────────────────────
// DESFAZ os in-betweens por blend (`bun undo:inbetweens`)
//
// O PROBLEMA: a meta antiga de "16 frames em toda ação" foi cumprida rodando o
// `gen-inbetweens` (interpolação por blend) em massa. Medido depois: animações
// com ≥16 frames têm 3,6× mais defeitos que as com menos (1,20 vs 0,33 por
// animação) e 98% do atlas está em ≥16. O in-between comprou DEFEITO, não
// suavidade — o `walk` (a animação mais visível do jogo) é a pior de todas.
//
// POR QUE AS OUTRAS FERRAMENTAS NÃO RESOLVIAM: `trim:filler` procura frames
// PARADOS (delta < 0.35 do vizinho). Frame de blend não está parado — ele é
// diferente e sem sentido. Medido: os `hurt` sinalizados têm delta mediano
// 0.5–2.2, bem acima do limiar, então o trim reportava "nada a trimar". E
// `close:loops` (mais ponte por blend) PIORAVA: loop-pop 50→62.
//
// COMO ESTE FUNCIONA: o `gen-inbetweens` insere um frame interpolado ENTRE cada
// par de frames originais, então os ORIGINAIS ficam nos índices PARES.
// Descartar os ÍMPARES restaura o ciclo autoral exato — não é redesenho nem
// aproximação, é remover o que foi inserido.
//
// MEDIDO em 4 famílias antes de construir isto (irregularidade / wrap do loop):
//   enemy-estagiario|walk  0.86 → 0.32   |  2.32 → 0.55
//   enemy-analista|walk    0.86 → 0.33   |  4.51 → 0.91
//   enemy-bateria|idle     1.10 → 0.44   | 10.00 → 0.97
// wrap abaixo de 1× a mediana = o loop FECHA (fim do loop-pop).
//
// GUARDA CONTRA ESTRAGO: nem toda família de 16 veio de doubling — algumas podem
// ser arte autoral longa. Por isso a decisão é POR FAMÍLIA e baseada em MEDIDA:
// só corta quando o subconjunto par é comprovadamente um ciclo melhor
// (irregularidade E fechamento de loop ambos melhoram). Caso contrário, deixa.
//
// Uso: node scripts/undo-inbetweens.mjs [--dry] [--states=walk,idle,run]
// ─────────────────────────────────────────────────────────────────────────────
import sharp from "sharp";
import { existsSync, renameSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SPRITES = "public/assets/sprites";
const dry = process.argv.includes("--dry");
const statesArg = process.argv.find((a) => a.startsWith("--states="));
// Só estados que CICLAM por padrão: o fechamento do loop é a evidência mais
// forte de que o corte está certo. hurt/death não ciclam (o wrap não diz nada).
const STATES = (statesArg ? statesArg.split("=")[1] : "walk,idle,run").split(",");

/** Piso absoluto: abaixo disto o ciclo perde legibilidade. */
const MIN_FRAMES = 4;

async function raw(f) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function delta(a, b) {
  if (!a || !b || a.w !== b.w || a.h !== b.h) return Infinity;
  let s = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    s +=
      Math.abs(a.data[i] - b.data[i]) +
      Math.abs(a.data[i + 1] - b.data[i + 1]) +
      Math.abs(a.data[i + 2] - b.data[i + 2]) +
      Math.abs(a.data[i + 3] - b.data[i + 3]);
  }
  return s / (a.data.length / 4);
}

const mediana = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const cv = (xs) => {
  if (!xs.length) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (!m) return 0;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) / m;
};

/** Qualidade do ciclo: irregularidade dos deltas + quanto o wrap destoa. */
function qualidade(frames) {
  const ds = [];
  for (let i = 0; i < frames.length - 1; i++) ds.push(delta(frames[i], frames[i + 1]));
  const med = mediana(ds);
  const wrap = delta(frames[frames.length - 1], frames[0]);
  return { cv: cv(ds), wrapRatio: med ? wrap / med : Infinity };
}

async function carregar(familia) {
  const out = [];
  for (let i = 0; ; i++) {
    const f = `${SPRITES}/${familia}${i}.png`;
    if (!existsSync(f)) break;
    const fr = await raw(f);
    if (i > 0 && (fr.w !== out[0].fr.w || fr.h !== out[0].fr.h)) break;
    out.push({ path: f, fr });
  }
  return out;
}

// Famílias a examinar: as que o audit:anim sinaliza com jerk/loop-pop nos
// estados que ciclam. Não faz sentido mexer no que já está limpo.
const audit = spawnSync("node", ["scripts/audit-anim.mjs", "--json"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const report = JSON.parse(audit.stdout);
const alvos = report.reports.filter(
  (r) =>
    STATES.includes(r.state) &&
    r.flags.some((f) => f.kind === "jerk" || f.kind === "loop-pop") &&
    r.frames >= MIN_FRAMES * 2,
);

console.log(`Candidatas (ciclo com jerk/loop-pop em ${STATES.join("/")}): ${alvos.length}`);

let cortadas = 0;
let framesRemovidos = 0;
const pulou = [];

for (const r of alvos) {
  const familia = `${r.prefix}-${r.state}`;
  const frames = await carregar(familia);
  if (frames.length < MIN_FRAMES * 2) continue;

  const pares = frames.filter((_, i) => i % 2 === 0);
  if (pares.length < MIN_FRAMES) continue;

  const antes = qualidade(frames.map((f) => f.fr));
  const depois = qualidade(pares.map((f) => f.fr));

  // A guarda: só corta se o ciclo par for melhor NOS DOIS eixos.
  const melhora = depois.cv < antes.cv && depois.wrapRatio < antes.wrapRatio;
  if (!melhora) {
    pulou.push(
      `${familia} (par não melhora: cv ${antes.cv.toFixed(2)}→${depois.cv.toFixed(2)}, wrap ${antes.wrapRatio.toFixed(1)}→${depois.wrapRatio.toFixed(1)})`,
    );
    continue;
  }

  console.log(
    `  • ${familia}: ${frames.length} → ${pares.length}   cv ${antes.cv.toFixed(2)}→${depois.cv.toFixed(2)}  wrap ${antes.wrapRatio.toFixed(1)}→${depois.wrapRatio.toFixed(1)}`,
  );
  cortadas++;
  framesRemovidos += frames.length - pares.length;
  if (dry) continue;

  for (let i = 0; i < frames.length; i++) if (i % 2 === 1) unlinkSync(frames[i].path);
  // Reindexa contíguo (via nome temporário p/ não colidir).
  for (let i = 0; i < pares.length; i++)
    renameSync(pares[i].path, `${SPRITES}/${familia}__t${i}.png`);
  for (let i = 0; i < pares.length; i++)
    renameSync(`${SPRITES}/${familia}__t${i}.png`, `${SPRITES}/${familia}${i}.png`);
}

if (pulou.length) {
  console.log(`\nPuladas por não melhorarem (${pulou.length}):`);
  for (const p of pulou.slice(0, 10)) console.log("  - " + p);
  if (pulou.length > 10) console.log(`  … e mais ${pulou.length - 10}`);
}

console.log(
  `\n${cortadas} família(s) enxugada(s), ${framesRemovidos} frame(s) de blend removidos.`,
);
if (dry) console.log("(--dry) nada foi tocado.");
else if (cortadas) console.log("Rode: node scripts/pack-atlas.mjs");
