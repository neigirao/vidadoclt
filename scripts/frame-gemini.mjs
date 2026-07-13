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

async function main() {
  const frame = process.argv[2];
  // --preview: grava a saída em .frame-preview/<frame>.png (não sobrescreve o
  // frame real, não re-empacota) e devolve o PNG em base64 p/ o LAB mostrar o
  // "depois". Sem a flag, sobrescreve o frame direto (uso por CLI).
  const preview = process.argv.includes("--preview");
  if (!frame) throw new Error("uso: node scripts/frame-gemini.mjs <frame> [--preview]");
  const key = apiKey();
  if (!key) throw new Error("GEMINI_API_KEY ausente (env ou .env.local)");
  const file = `${DIR}/${frame}.png`;
  if (!existsSync(file)) throw new Error(`frame ${frame} não existe em sprites/`);
  const meta = await sharp(file).metadata();
  const W = meta.width,
    H = meta.height;
  const refs = neighbors(frame);

  const parts = [
    {
      text:
        `Pixel-art sprite animation repair. The FIRST image is a BROKEN/off frame ` +
        `named "${frame}" (${W}x${H}px). The following images are GOOD frames of the ` +
        `SAME animation family. Redraw the first frame so it matches the others' ` +
        `EXACT art style, character design, color palette, scale and feet baseline — ` +
        `fixing whatever is wrong with it. Output ONLY the corrected sprite as a ` +
        `${W}x${H} PNG with a fully transparent background, character bottom-aligned. ` +
        `No text, no frame, no shadow outside the character.`,
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

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts }] }),
    },
  );
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
  // encaixando o conteúdo com fundo transparente (nearest p/ manter pixel-art).
  const gen = Buffer.from(b64, "base64");
  const outPng = await sharp(gen)
    .resize(W, H, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" })
    .png()
    .toBuffer();
  const dest = preview ? `${PREVIEW_DIR}/${frame}.png` : file;
  if (preview) mkdirSync(PREVIEW_DIR, { recursive: true });
  await sharp(outPng).toFile(dest);
  return {
    mode: "gemini",
    frame,
    dims: `${W}x${H}`,
    refs: refs.map((r) => r.name),
    preview,
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
