// ─────────────────────────────────────────────────────────────────────────────
// Animation Auditor — mede a SUAVIDADE das animações (o eixo que os outros gates
// não veem): não a QUANTIDADE de frames (check:frames) nem o CONTEÚDO de um frame
// (audit:sprites/palette), mas o MOVIMENTO entre frames consecutivos.
//
// IDEIA: para cada família|estado (ex.: enemy-estagiario-walk0..N) lê os frames
// do atlas e calcula o DELTA de pixel entre frames vizinhos (e o wrap last→first
// nos ciclos). Disso saem flags concretas:
//   • DEAD   — a "animação" quase não se mexe (max delta ~0): frames idênticos.
//   • STUCK  — um par consecutivo sem avanço (delta ~0): frame desperdiçado.
//   • JERK   — um delta muito acima da mediana: pulo/pop (frame estranho/corrupto
//              no meio do ciclo, ou transição dura sem in-between).
//   • LOOP-POP— o wrap (último→primeiro) destoa: o ciclo "estala" ao repetir.
// E um score de UNIFORMIDADE (quão parelhos são os deltas — interpolação suave
// tende a deltas parelhos; movimento "aos trancos" tem CV alto).
//
// Estático (lê atlas.png/json, sem navegador), determinístico. Relatório por
// padrão.
//
// `--gate` = GATE RATCHET (trava de não-regressão): compara a contagem por TIPO
// (dead/jerk/loop-pop/padded) contra a baseline commitada (anim-baseline.json) e
// sai !=0 se QUALQUER tipo PIORAR. Congela o estado atual como teto e só deixa os
// números CAÍREM — teria bloqueado o lote de in-betweens que piorou loop-pop
// 50→62. Não exige "zerar" os defeitos (o baseline clean só sai de arte autoral);
// exige NÃO REGREDIR. Quando a suavidade melhorar de fato, `--update-baseline`
// baixa o teto e trava o ganho. `--json`, `--top=N`.
//
// Uso: node scripts/audit-anim.mjs [--gate] [--update-baseline] [--json] [--top=N]
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const gate = process.argv.includes("--gate");
const updateBaseline = process.argv.includes("--update-baseline");
const asJson = process.argv.includes("--json");
const BASELINE_PATH = new URL("./anim-baseline.json", import.meta.url);
const topN = Number((process.argv.find((a) => a.startsWith("--top=")) || "--top=40").split("=")[1]);

// Limiares (mean abs diff por pixel, escala 0..255). Calibrados p/ pegar defeito
// real sem afogar em ruído. Documentados = a régua do "está tremido/travado?".
const DEAD_MAX = 0.6; // max delta do ciclo abaixo disso → animação morta (não mexe)
const STUCK_EPS = 0.35; // delta consecutivo abaixo disso → frame parado (desperdício)
const JERK_FACTOR = 4.0; // delta acima de FACTOR×mediana (e absoluto relevante) → pulo
const JERK_MIN_ABS = 4.0; // piso absoluto p/ um "pulo" contar (evita ruído em anim calma)
const LOOPPOP_FACTOR = 3.0; // wrap acima de FACTOR×mediana → estala ao repetir
// Estados que são CICLOS (ganham checagem de LOOP-POP). death/hurt são transições.
const CYCLIC = new Set(["walk", "run", "idle", "attack"]);

const atlas = JSON.parse(readFileSync(new URL("../public/assets/atlas.json", import.meta.url)));
const png = PNG.sync.read(readFileSync(new URL("../public/assets/atlas.png", import.meta.url)));
const map = {};
for (const t of atlas.textures) for (const f of t.frames) map[f.filename] = f;

const re = /^(.*?)-(idle|walk|run|attack|hurt|death)(\d+)$/;
const anims = {}; // "prefix|state" -> [{name, n}]
for (const name of Object.keys(map)) {
  const m = name.match(re);
  if (!m) continue;
  const key = `${m[1]}|${m[2]}`;
  (anims[key] = anims[key] || []).push({ name, n: +m[3] });
}

/** RGBA cru de um frame do atlas (fatia da textura). */
function frameRGBA(name) {
  const fr = map[name]?.frame;
  if (!fr) return null;
  const { x, y, w, h } = fr;
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const s = ((y + j) * png.width + (x + i)) * 4;
      const d = (j * w + i) * 4;
      data[d] = png.data[s];
      data[d + 1] = png.data[s + 1];
      data[d + 2] = png.data[s + 2];
      data[d + 3] = png.data[s + 3];
    }
  return { w, h, data };
}

/** Delta médio (0..255) entre dois frames de MESMA dimensão; null se diferem. */
function frameDelta(a, b) {
  if (!a || !b || a.w !== b.w || a.h !== b.h) return null;
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

function median(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
}

const reports = [];
for (const [key, frames] of Object.entries(anims)) {
  if (frames.length < 2) continue; // sem par p/ medir movimento
  const [prefix, state] = key.split("|");
  frames.sort((a, b) => a.n - b.n);
  // Só o RUN CONTÍGUO a partir do 0 (evita frames órfãos fora do ciclo).
  const seq = [];
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].n !== i) break;
    seq.push(frames[i]);
  }
  if (seq.length < 2) continue;

  const rgba = seq.map((f) => frameRGBA(f.name));
  const deltas = [];
  let dimMismatch = false;
  for (let i = 0; i < rgba.length - 1; i++) {
    const d = frameDelta(rgba[i], rgba[i + 1]);
    if (d === null) {
      dimMismatch = true;
      continue;
    }
    deltas.push(d);
  }
  if (deltas.length === 0) continue;

  const mx = Math.max(...deltas);
  // Deltas "de movimento" (acima do piso de percepção). A MEDIANA dos deltas crus
  // é enganosa aqui: ciclos com muito filler (in-betweens quase-idênticos) a puxam
  // a ~0, tornando qualquer frame real um "pulo". Então medimos o movimento real.
  const moving = deltas.filter((d) => d >= STUCK_EPS);
  const movingFrac = deltas.length ? moving.length / deltas.length : 0;
  const baseline = moving.length ? median(moving) : median(deltas);
  const cv = moving.length > 1 ? stddev(moving) / mean(moving) : 0;
  const uniformity = Math.max(0, Math.round((1 - Math.min(cv, 1)) * 100));

  const flags = [];
  if (mx < DEAD_MAX) {
    // Não se mexe: frames idênticos (arte estática marcada como animação).
    flags.push({ sev: "warn", kind: "dead", msg: `animação morta (max Δ ${mx.toFixed(2)})` });
  } else {
    // Só faz sentido caçar "pulo"/"loop-pop" quando o ciclo é DE FATO animado
    // (maioria dos frames se move). Em ciclo majoritariamente filler/estático o
    // "pulo" é só o movimento real acontecendo em poucos frames — não é defeito.
    if (movingFrac >= 0.5) {
      const jerks = deltas.filter((d) => d > JERK_FACTOR * baseline && d > JERK_MIN_ABS).length;
      if (jerks > 0)
        flags.push({
          sev: "warn",
          kind: "jerk",
          msg: `${jerks} pulo(s) brusco(s) no ciclo (Δ > ${JERK_FACTOR}×${baseline.toFixed(1)})`,
        });
      if (CYCLIC.has(state) && seq.length >= 3) {
        const wrap = frameDelta(rgba[rgba.length - 1], rgba[0]);
        if (wrap !== null && wrap > LOOPPOP_FACTOR * baseline && wrap > JERK_MIN_ABS)
          flags.push({
            sev: "warn",
            kind: "loop-pop",
            msg: `estala ao repetir (wrap Δ ${wrap.toFixed(1)} vs mov. ${baseline.toFixed(1)})`,
          });
      }
    } else {
      // Ciclo com pouco movimento real: quase tudo é filler/duplicado. INFO, não
      // warn — pode ser intencional (estado que o jogo não cicla), mas é candidato
      // a enxugar (frames desperdiçados) ou a arte estática mal-marcada.
      flags.push({
        sev: "info",
        kind: "padded",
        msg: `só ${Math.round(movingFrac * 100)}% dos frames se movem (resto é filler/estático)`,
      });
    }
  }
  if (dimMismatch)
    flags.push({ sev: "warn", kind: "dim", msg: "frames de tamanhos diferentes no ciclo" });

  reports.push({ prefix, state, frames: seq.length, med: baseline, max: mx, uniformity, flags });
}

const hasWarn = (r) => r.flags.some((f) => f.sev === "warn");
// Ordena: warnings primeiro, depois nº de flags, depois menor uniformidade.
reports.sort(
  (a, b) =>
    Number(hasWarn(b)) - Number(hasWarn(a)) ||
    b.flags.length - a.flags.length ||
    a.uniformity - b.uniformity,
);

const warned = reports.filter(hasWarn);
const infoOnly = reports.filter((r) => !hasWarn(r) && r.flags.length > 0);

// Contagem por TIPO — headline acionável E entrada do gate ratchet.
const byKind = {};
for (const r of reports) for (const f of r.flags) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;

// Gate RATCHET: trava de não-regressão contra a baseline commitada. Reprova se
// QUALQUER tipo piorar (count > baseline). `--update-baseline` regrava o teto
// (quando a arte melhora de verdade). Retorna o código de saída do processo.
function gateExitCode() {
  if (updateBaseline) {
    writeFileSync(BASELINE_PATH, JSON.stringify(byKind, null, 2) + "\n");
    console.error(`baseline de animação atualizada: ${JSON.stringify(byKind)}`);
    return 0;
  }
  if (!gate) return 0;
  let baseline = {};
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    console.error("✖ anim-baseline.json ausente/inválido — rode: bun audit:anim --update-baseline");
    return 1;
  }
  const kinds = new Set([...Object.keys(byKind), ...Object.keys(baseline)]);
  const regress = [];
  for (const k of kinds) {
    const cur = byKind[k] ?? 0;
    const base = baseline[k] ?? 0;
    if (cur > base) regress.push(`${k}: ${base} → ${cur} (+${cur - base})`);
  }
  if (regress.length) {
    console.error(`\n✖ REGRESSÃO de suavidade (audit:anim ratchet vs baseline):`);
    for (const r of regress) console.error("  " + r);
    console.error(
      `\nA animação piorou vs a baseline commitada. Se for INTENCIONAL/aprovado,\n` +
        `rode 'bun audit:anim --update-baseline' e commite scripts/anim-baseline.json.\n` +
        `Senão, NÃO infle o ciclo com in-betweens por blend (piora jerk/loop-pop).`,
    );
    return 1;
  }
  console.error(`\n✓ sem regressão de suavidade (dentro da baseline).`);
  return 0;
}

if (asJson) {
  console.log(
    JSON.stringify(
      { total: reports.length, warned: warned.length, info: infoOnly.length, byKind, reports },
      null,
      2,
    ),
  );
  process.exit(gateExitCode());
}

const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);
console.log(`\n── Animation Auditor ── ${reports.length} animações medidas ──\n`);
console.log(
  `  ${pad("família|estado", 30)}${padL("frames", 7)}${padL("Δmov", 7)}${padL("unif%", 7)}  flags`,
);
for (const r of reports.slice(0, topN)) {
  const kinds = r.flags.length ? r.flags.map((f) => f.kind).join(",") : "—";
  console.log(
    `  ${pad(`${r.prefix}|${r.state}`, 30)}${padL(r.frames, 7)}${padL(r.med.toFixed(1), 7)}${padL(r.uniformity, 7)}  ${kinds}`,
  );
}
console.log("");

if (warned.length === 0) {
  console.log("✓ nenhum DEFEITO de animação (dead/jerk/loop-pop/dim) sinalizado.");
} else {
  console.log(`⚠ ${warned.length} animação(ões) com DEFEITO:`);
  for (const r of warned.slice(0, topN)) {
    console.log(`  • ${r.prefix}|${r.state}:`);
    for (const f of r.flags.filter((x) => x.sev === "warn"))
      console.log(`      [${f.kind}] ${f.msg}`);
  }
}
if (infoOnly.length) {
  console.log(
    `\nℹ ${infoOnly.length} animação(ões) com muito filler/estático (candidatas a enxugar — não bloqueiam).`,
  );
}

// Resumo por TIPO — o headline acionável (defeito sistêmico vs. pontual).
const kindOrder = ["dead", "dim", "jerk", "loop-pop", "padded"];
const summary = kindOrder
  .filter((k) => byKind[k])
  .map((k) => `${k}=${byKind[k]}`)
  .join("  ");
console.log(`\nResumo por tipo: ${summary || "nenhum"}`);
console.log("");
process.exit(gateExitCode());
