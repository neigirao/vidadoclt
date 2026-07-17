// ─────────────────────────────────────────────────────────────────────────────
// Sintetizador de in-betweens (frames intermediários) — GRÁTIS, determinístico,
// SEM IA. Equivalente livre do "COMPLETAR FAMÍLIA" do Lovable (que usa Gemini).
//
// IDEIA: entre cada par de frames vizinhos A→B de um ciclo, cria um frame
// intermediário T por BLEND + TRAVA DE PALETA. O blend puro geraria halos/ghost
// (anti-pixel-art); então cada pixel do blend é ENCAIXADO na cor mais próxima da
// paleta união de A∪B (a mesma trava de paleta dos guardrails do Gemini). O
// resultado é uma pose de transição CRISP feita só com as cores que já existem —
// nada de cor nova, nada de IA, nada de custo.
//
// Uso:
//   node scripts/gen-inbetweens.mjs <familia> [--preview] [--cyclic|--no-cyclic]
//   ex.: node scripts/gen-inbetweens.mjs player-walk --preview
//        node scripts/gen-inbetweens.mjs enemy-estagiario-walk
//
// --preview: NÃO toca em sprites/. Grava contact-sheets antes/depois em
//   scratchpad p/ inspeção. Sem --preview: reindexa a família intercalando os
//   in-betweens (A0,T01,A1,T12,…) e reempacota o atlas.
// --cyclic (default p/ walk/idle/run): também cria o in-between entre o último e o
//   primeiro (loop fechado). --no-cyclic p/ ações não-cíclicas (attack).
// ─────────────────────────────────────────────────────────────────────────────
import sharp from "sharp";
import { existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SPRITES = "public/assets/sprites";
const PREVIEW_DIR =
  "/tmp/claude-0/-home-user-vidadoclt/5ce50ba1-6283-5470-9654-2220c7b76d33/scratchpad/inbetween-preview";

const args = process.argv.slice(2);
const family = args.find((a) => !a.startsWith("--"));
const preview = args.includes("--preview");
const noPack = args.includes("--no-pack"); // batch: reindexa mas NÃO reempacota (pack 1× no fim)
const cyclic = args.includes("--no-cyclic")
  ? false
  : args.includes("--cyclic") || /-(walk|idle|run)$/.test(family ?? "");

if (!family) {
  console.error("uso: node scripts/gen-inbetweens.mjs <familia> [--preview]");
  process.exit(1);
}

async function loadRaw(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

// Nº de px opacos (alpha>30). Mesma regra do pack-atlas p/ "quase-vazio" (<25).
function opaqueCount(fr) {
  let op = 0;
  for (let i = 3; i < fr.data.length; i += 4) if (fr.data[i] > 30 && ++op >= 25) return op;
  return op;
}

// Lê os frames CONTÍGUOS e VÁLIDOS da família a partir do 0. Para no 1º que:
// falta, é quase-vazio (lixo de extração legado) OU tem dimensão diferente do
// frame 0 (outliers 64×64 não-usados). Assim o tween nunca interpola lixo nem
// mistura tamanhos (o que corromperia o buffer por indexar B com as dims de A).
async function loadFamily() {
  const frames = [];
  for (let i = 0; ; i++) {
    const f = `${SPRITES}/${family}${i}.png`;
    if (!existsSync(f)) break;
    const fr = await loadRaw(f);
    if (i > 0 && (fr.w !== frames[0].w || fr.h !== frames[0].h)) break; // dimensão mudou
    if (opaqueCount(fr) < 25) break; // quase-vazio
    frames.push(fr);
  }
  return frames;
}

// Paleta opaca (Set de "r,g,b") de um ou mais frames.
function paletteOf(frames) {
  const pal = new Map();
  for (const fr of frames) {
    for (let i = 0; i < fr.data.length; i += 4) {
      if (fr.data[i + 3] > 128) {
        const key = (fr.data[i] << 16) | (fr.data[i + 1] << 8) | fr.data[i + 2];
        pal.set(key, [fr.data[i], fr.data[i + 1], fr.data[i + 2]]);
      }
    }
  }
  return [...pal.values()];
}

function nearest(pal, r, g, b) {
  let best = pal[0],
    bd = Infinity;
  for (const c of pal) {
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

// In-between de A→B: blend 50/50 + snap na paleta A∪B. Bordas (um lado
// transparente) herdam a cor do lado opaco → sem halo escuro.
function tween(A, B) {
  const pal = paletteOf([A, B]);
  const out = Buffer.alloc(A.data.length);
  for (let i = 0; i < A.data.length; i += 4) {
    const aA = A.data[i + 3],
      aB = B.data[i + 3];
    const oA = aA > 128,
      oB = aB > 128;
    if (!oA && !oB) continue; // transparente
    let r, g, b;
    if (oA && oB) {
      r = (A.data[i] + B.data[i]) >> 1;
      g = (A.data[i + 1] + B.data[i + 1]) >> 1;
      b = (A.data[i + 2] + B.data[i + 2]) >> 1;
    } else if (oA) {
      [r, g, b] = [A.data[i], A.data[i + 1], A.data[i + 2]];
    } else {
      [r, g, b] = [B.data[i], B.data[i + 1], B.data[i + 2]];
    }
    const [nr, ng, nb] = nearest(pal, r, g, b);
    out[i] = nr;
    out[i + 1] = ng;
    out[i + 2] = nb;
    out[i + 3] = 255;
  }
  return { data: out, w: A.w, h: A.h };
}

const rawToPng = (fr) => sharp(fr.data, { raw: { width: fr.w, height: fr.h, channels: 4 } }).png();

// Contact-sheet horizontal dos frames (p/ preview).
async function contactSheet(frames, out, scale = 3) {
  const w = frames[0].w,
    h = frames[0].h,
    gap = 4;
  const sheetW = frames.length * w + (frames.length - 1) * gap;
  const composites = [];
  for (let i = 0; i < frames.length; i++) {
    composites.push({ input: await rawToPng(frames[i]).toBuffer(), left: i * (w + gap), top: 0 });
  }
  await sharp({
    create: { width: sheetW, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .resize(sheetW * scale, h * scale, { kernel: "nearest" })
    .png()
    .toFile(out);
}

(async () => {
  const orig = await loadFamily();
  if (orig.length < 2) {
    console.error(`família ${family}: precisa de ≥2 frames (achei ${orig.length})`);
    process.exit(1);
  }
  // Sequência intercalada: A0,T01,A1,T12,…,A(n-1)[,T(n-1→0)]
  const seq = [];
  for (let i = 0; i < orig.length; i++) {
    seq.push(orig[i]);
    const next = i + 1 < orig.length ? i + 1 : cyclic ? 0 : -1;
    if (next >= 0) seq.push(tween(orig[i], orig[next]));
  }

  if (preview) {
    mkdirSync(PREVIEW_DIR, { recursive: true });
    await contactSheet(orig, `${PREVIEW_DIR}/${family}-antes.png`);
    await contactSheet(seq, `${PREVIEW_DIR}/${family}-depois.png`);
    console.log(
      JSON.stringify({
        ok: true,
        family,
        before: orig.length,
        after: seq.length,
        cyclic,
        preview: `${PREVIEW_DIR}/${family}-{antes,depois}.png`,
      }),
    );
    return;
  }

  // Aplica: reescreve os PNGs 0..seq.length-1 da família.
  for (let i = 0; i < seq.length; i++) {
    await rawToPng(seq[i]).toFile(`${SPRITES}/${family}${i}.png`);
  }
  if (noPack) {
    console.log(
      JSON.stringify({ ok: true, family, before: orig.length, after: seq.length, cyclic }),
    );
    return;
  }
  const pack = spawnSync("node", ["scripts/pack-atlas.mjs"], { encoding: "utf8" });
  console.log(
    JSON.stringify({
      ok: pack.status === 0,
      family,
      before: orig.length,
      after: seq.length,
      cyclic,
      repacked: pack.status === 0,
    }),
  );
})();
