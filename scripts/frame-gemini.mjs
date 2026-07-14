// ─────────────────────────────────────────────────────────────────────────────
// Redesenho de UM frame via Gemini (imagem), seguindo o design dos vizinhos.
// Chamado pelo botão "🤖 REFAZER (IA)" do LAB (endpoint /__frame-fix mode=gemini).
//
// CONTEXTO passado ao modelo: o frame-alvo (a consertar) + os vizinhos bons da
// mesma família como REFERÊNCIA de estilo/personagem/tamanho → o modelo redesenha
// só o frame, mantendo o design. Saída redimensionada p/ a dimensão EXATA do frame.
//
// A chave vem de GEMINI_API_KEY (env) — NUNCA commitada. Fallback: lê .env.local
// (ignorado pelo git). Requer billing habilitado no projeto Google (o free tier
// retorna 429 p/ geração de imagem). Uso: node scripts/frame-gemini.mjs <frame>
// ─────────────────────────────────────────────────────────────────────────────
import sharp from "sharp";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve(process.cwd(), "public/assets/sprites");
// Prévia da IA fica FORA de sprites/ (o pack-atlas varre sprites/*.png, então a
// prévia jamais vaza pro atlas). Aprovar depois copia daqui pro frame real.
const PREVIEW_DIR = resolve(process.cwd(), "public/assets/.frame-preview");
const MODEL = "gemini-2.5-flash-image";

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  for (const f of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), f);
    if (existsSync(p)) {
      const m = /^GEMINI_API_KEY\s*=\s*["']?([^"'\n]+)/m.exec(readFileSync(p, "utf8"));
      if (m) return m[1].trim();
    }
  }
  return null;
}

function neighbors(frame) {
  const base = frame.replace(/\d+$/, "");
  const idx = parseInt(frame.match(/(\d+)$/)?.[1] ?? "0", 10);
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".png") && new RegExp(`^${base}\\d+\\.png$`).test(f))
    .map((f) => ({ name: f.replace(/\.png$/, ""), i: parseInt(f.match(/(\d+)/)[1], 10) }))
    .filter((o) => o.name !== frame)
    .sort((a, b) => Math.abs(a.i - idx) - Math.abs(b.i - idx))
    .slice(0, 3);
}

// Lê o valor de uma flag `--nome valor` do argv (ou null se ausente).
function argVal(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

const ALPHA_CUT = 40;
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[s.length >> 1] : 0;
};

// GUARDRAILS de pixel-art. Lê os frames de referência e extrai: a PALETA (cores
// opacas dos vizinhos), a BASELINE mediana dos pés (fromBottom) e a ALTURA
// mediana do conteúdo. O output da IA é depois travado a essa paleta, limpo dos
// halos semi-transparentes e alinhado à baseline — sem isso o resize nearest
// deixa meio-tom/drift de cor e o personagem "flutua".
async function refStats(refNames) {
  const palette = [];
  const seen = new Set();
  const heights = [];
  const feets = [];
  for (const name of refNames) {
    const { data, info } = await sharp(`${DIR}/${name}.png`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const w = info.width,
      h = info.height;
    let minY = h,
      maxY = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3] > ALPHA_CUT) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          const q = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
          if (!seen.has(q)) {
            seen.add(q);
            palette.push([data[i], data[i + 1], data[i + 2]]);
          }
        }
      }
    if (maxY >= minY) {
      heights.push(maxY - minY + 1);
      feets.push(h - 1 - maxY);
    }
  }
  return { palette, medH: median(heights), medFeet: median(feets) };
}

// Limpa halos (alpha<corte → transparente; senão alpha cheio, pixel-art não tem
// meio-tom) e trava cada pixel opaco à cor mais próxima da paleta dos vizinhos.
function snapClean(data, w, h, palette) {
  const cache = new Map();
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (data[i + 3] < ALPHA_CUT) {
      data[i + 3] = 0;
      continue;
    }
    data[i + 3] = 255;
    if (!palette.length) continue;
    const q = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
    let snap = cache.get(q);
    if (!snap) {
      let best = palette[0],
        bd = Infinity;
      for (const c of palette) {
        const dr = c[0] - data[i],
          dg = c[1] - data[i + 1],
          db = c[2] - data[i + 2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      snap = best;
      cache.set(q, snap);
    }
    data[i] = snap[0];
    data[i + 1] = snap[1];
    data[i + 2] = snap[2];
  }
}

function bboxRaw(data, w, h) {
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  return maxX < 0 ? null : { minX, minY, bw: maxX - minX + 1, bh: maxY - minY + 1 };
}

async function main() {
  const frame = process.argv[2];
  // --preview: grava a saída em .frame-preview/<frame>.png (não sobrescreve o
  // frame real, não re-empacota) e devolve o PNG em base64 p/ o LAB mostrar o
  // "depois". Sem a flag, sobrescreve o frame direto (uso por CLI).
  const preview = process.argv.includes("--preview");
  // --hint "texto": instrução extra anexada ao prompt (o usuário refina o pedido).
  // --refs "a,b,c": frames de referência escolhidos à mão (senão usa os vizinhos).
  const hint = argVal("--hint");
  const refsArg = argVal("--refs");
  if (!frame)
    throw new Error(
      "uso: node scripts/frame-gemini.mjs <frame> [--preview] [--hint t] [--refs a,b,c]",
    );
  const key = apiKey();
  if (!key) throw new Error("GEMINI_API_KEY ausente (env ou .env.local)");
  const file = `${DIR}/${frame}.png`;
  if (!existsSync(file)) throw new Error(`frame ${frame} não existe em sprites/`);
  const meta = await sharp(file).metadata();
  const W = meta.width,
    H = meta.height;
  const refs = refsArg
    ? refsArg
        .split(",")
        .map((s) => s.trim())
        .filter((n) => n && n !== frame && existsSync(`${DIR}/${n}.png`))
        .map((name) => ({ name }))
    : neighbors(frame);

  const parts = [
    {
      text:
        `Pixel-art sprite animation repair. The FIRST image is a BROKEN/off frame ` +
        `named "${frame}" (${W}x${H}px). The following images are GOOD frames of the ` +
        `SAME animation family. Redraw the first frame so it matches the others' ` +
        `EXACT art style, character design, color palette, scale and feet baseline — ` +
        `fixing whatever is wrong with it. Output ONLY the corrected sprite as a ` +
        `${W}x${H} PNG with a fully transparent background, character bottom-aligned. ` +
        `No text, no frame, no shadow outside the character.` +
        (hint ? ` Additional instruction from the artist: ${hint}` : ``),
    },
    { inline_data: { mime_type: "image/png", data: readFileSync(file).toString("base64") } },
  ];
  for (const r of refs)
    parts.push({
      inline_data: {
        mime_type: "image/png",
        data: readFileSync(`${DIR}/${r.name}.png`).toString("base64"),
      },
    });

  // Timeout de 90s: a chamada de imagem pode travar sem retornar — aborta em vez
  // de pendurar o endpoint (o /__frame-fix ainda tem um kill-timer de 120s por cima).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  let resp;
  try {
    resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": key },
        body: JSON.stringify({ contents: [{ parts }] }),
        signal: ctrl.signal,
      },
    );
  } catch (e) {
    throw new Error(ctrl.signal.aborted ? "Gemini não respondeu em 90s (abort)" : String(e));
  } finally {
    clearTimeout(timer);
  }
  const j = await resp.json();
  if (!resp.ok) {
    const msg = j?.error?.message ?? `HTTP ${resp.status}`;
    throw new Error(resp.status === 429 ? `quota — habilite billing no Gemini (${msg})` : msg);
  }
  const out = (j?.candidates?.[0]?.content?.parts ?? []).find(
    (p) => p.inlineData?.data || p.inline_data?.data,
  );
  const b64 = out?.inlineData?.data ?? out?.inline_data?.data;
  if (!b64) throw new Error("modelo não retornou imagem");

  // Redimensiona a saída (o modelo devolve grande) p/ a dimensão EXATA do frame,
  // em raw RGBA (nearest p/ manter pixel-art) e aplica os GUARDRAILS.
  const gen = Buffer.from(b64, "base64");
  const { data, info } = await sharp(gen)
    .resize(W, H, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rw = info.width,
    rh = info.height;
  const stats = await refStats(refs.map((r) => r.name));
  snapClean(data, rw, rh, stats.palette); // paleta travada + halos limpos
  // Alinha os pés à baseline mediana da família (o resize contain centraliza
  // verticalmente e faz o personagem "flutuar"). Recorta o bbox e recompõe.
  const bb = bboxRaw(data, rw, rh);
  let outPng;
  const warn = [];
  if (bb) {
    if (stats.medH > 0 && Math.abs(bb.bh - stats.medH) / stats.medH > 0.25)
      warn.push(`altura ${bb.bh}px vs mediana ${stats.medH}px`);
    const content = await sharp(Buffer.from(data), { raw: { width: rw, height: rh, channels: 4 } })
      .extract({ left: bb.minX, top: bb.minY, width: bb.bw, height: bb.bh })
      .png()
      .toBuffer();
    const top = Math.max(0, H - stats.medFeet - bb.bh);
    const left = Math.max(0, Math.round((W - bb.bw) / 2));
    outPng = await sharp({
      create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: content, left, top }])
      .png()
      .toBuffer();
  } else {
    warn.push("output quase-vazio");
    outPng = await sharp(Buffer.from(data), { raw: { width: rw, height: rh, channels: 4 } })
      .png()
      .toBuffer();
  }
  const dest = preview ? `${PREVIEW_DIR}/${frame}.png` : file;
  if (preview) mkdirSync(PREVIEW_DIR, { recursive: true });
  await sharp(outPng).toFile(dest);
  return {
    mode: "gemini",
    frame,
    dims: `${W}x${H}`,
    refs: refs.map((r) => r.name),
    preview,
    guardrails: { paletteSize: stats.palette.length, baseline: stats.medFeet, warn },
    // dataUrl p/ o LAB renderizar o "depois" sem passar pelo atlas.
    ...(preview ? { previewDataUrl: `data:image/png;base64,${outPng.toString("base64")}` } : {}),
  };
}

main()
  .then((r) => console.log(JSON.stringify({ ok: true, ...r })))
  .catch((e) => {
    console.log(JSON.stringify({ ok: false, error: String(e.message ?? e) }));
    process.exit(1);
  });
