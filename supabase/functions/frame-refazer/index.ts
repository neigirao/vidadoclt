// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: refazer UM frame de sprite via Gemini — VERSÃO ONLINE.
//
// POR QUE EXISTE: o "Refazer com IA" do LAB precisava do `bun dev` (endpoint
// /__frame-fix chamava o Gemini com a chave local). No jogo PUBLICADO não há esse
// backend. Esta função roda no servidor (Supabase Edge), mantém a GEMINI_API_KEY
// SECRETA (nunca vai pro navegador) e é chamável do jogo online via
// supabase.functions.invoke("frame-refazer", ...). Os guardrails de pixel-art
// (paleta/baseline/resize exato) rodam no CLIENTE (canvas), então aqui só fazemos
// a chamada ao modelo e devolvemos a imagem crua.
//
// Deploy: `supabase functions deploy frame-refazer` (ou pela UI do Lovable).
// Segredo: `supabase secrets set GEMINI_API_KEY=...` (billing habilitado).
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = "gemini-2.5-flash-image";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  frameB64?: string; // PNG do frame-alvo (base64, sem prefixo dataURL)
  refs?: string[]; // PNGs dos vizinhos bons (base64)
  w?: number;
  h?: number;
  hint?: string; // instrução extra do artista
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (code: number, obj: unknown) =>
    new Response(JSON.stringify(obj), {
      status: code,
      headers: { ...CORS, "content-type": "application/json" },
    });

  try {
    if (req.method !== "POST") return json(405, { ok: false, error: "use POST" });
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json(500, { ok: false, error: "GEMINI_API_KEY não configurada no servidor" });

    const { frameB64, refs = [], w = 48, h = 64, hint }: Body = await req.json();
    if (!frameB64) return json(400, { ok: false, error: "frameB64 obrigatório" });

    const parts: unknown[] = [
      {
        text:
          `Pixel-art sprite animation repair. The FIRST image is a BROKEN/off frame ` +
          `(${w}x${h}px). The following images are GOOD frames of the SAME animation ` +
          `family. Redraw the first frame so it matches the others' EXACT art style, ` +
          `character design, color palette, scale and feet baseline — fixing whatever ` +
          `is wrong. Output ONLY the corrected sprite as a ${w}x${h} PNG with a fully ` +
          `transparent background, character bottom-aligned. No text, no frame, no ` +
          `shadow outside the character.` +
          (hint ? ` Additional instruction from the artist: ${hint}` : ``),
      },
      { inline_data: { mime_type: "image/png", data: frameB64 } },
    ];
    for (const r of refs.slice(0, 3))
      parts.push({ inline_data: { mime_type: "image/png", data: r } });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);
    let resp: Response;
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
      return json(504, {
        ok: false,
        error: ctrl.signal.aborted ? "Gemini timeout (90s)" : String(e),
      });
    } finally {
      clearTimeout(timer);
    }

    const j = await resp.json();
    if (!resp.ok) {
      const msg = j?.error?.message ?? `HTTP ${resp.status}`;
      return json(resp.status, {
        ok: false,
        error: resp.status === 429 ? `quota — habilite billing no Gemini (${msg})` : msg,
      });
    }
    const out = (j?.candidates?.[0]?.content?.parts ?? []).find(
      (p: { inlineData?: { data?: string }; inline_data?: { data?: string } }) =>
        p.inlineData?.data || p.inline_data?.data,
    );
    const imageB64 = out?.inlineData?.data ?? out?.inline_data?.data;
    if (!imageB64) return json(502, { ok: false, error: "modelo não retornou imagem" });

    return json(200, { ok: true, imageB64 });
  } catch (e) {
    return json(400, { ok: false, error: String((e as Error).message ?? e) });
  }
});
