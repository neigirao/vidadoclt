import { supabase } from "../../integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Overrides de fundo via Supabase Storage (bucket `bg-overrides`).
//
// PROBLEMA: o build publicado é estático — não há backend pra gravar
// public/assets/bg-*.png. O upload do LAB pelo plugin do Vite só funciona em
// `vite dev`. SOLUÇÃO: subir o PNG pro Storage e o jogo carregar de lá se
// existir override, senão o asset embutido. Persiste na nuvem, visível a todos
// os testers, sem redeploy.
//
// Uso:
//   • BootScene: `await loadBgManifest()` (1×) — descobre quais fundos têm override.
//   • Preload das fases: `this.load.image(key, bgUrl(key))` no lugar do caminho fixo.
//   • LAB (upload de fundo): `await uploadBg(key, blob)`.
// ─────────────────────────────────────────────────────────────────────────────

const BUCKET = "bg-overrides";
const _overrides = new Map<string, string>(); // key (bg-*) → URL pública com cache-bust
let _loaded = false;

/** URL a usar p/ um fundo: override do Storage se houver, senão o asset embutido. */
export function bgUrl(key: string): string {
  return _overrides.get(key) ?? `/assets/${key}.png`;
}

/** Há override em nuvem p/ este fundo? (usado pelo LAB p/ sinalizar "salvo"). */
export function hasBgOverride(key: string): boolean {
  return _overrides.has(key);
}

/**
 * Lê o bucket 1× e monta o manifesto de overrides. Falha silenciosa (Supabase
 * off / bucket ausente) → jogo segue com os assets embutidos.
 */
export async function loadBgManifest(): Promise<void> {
  if (_loaded) return;
  _loaded = true;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list("", { limit: 100 });
    if (error || !data) return;
    for (const obj of data) {
      if (!obj.name.endsWith(".png")) continue;
      const key = obj.name.replace(/\.png$/, "");
      const pub = supabase.storage.from(BUCKET).getPublicUrl(obj.name).data.publicUrl;
      // cache-bust por updated_at p/ pegar re-uploads sem cache velho do CDN.
      const t = obj.updated_at ? new Date(obj.updated_at).getTime() : Date.now();
      _overrides.set(key, `${pub}?t=${t}`);
    }
  } catch {
    /* offline / sem bucket — segue com assets embutidos */
  }
}

/** Sobe/atualiza o PNG de um fundo no Storage. Retorna a URL pública (cache-bust). */
export async function uploadBg(key: string, blob: Blob): Promise<string> {
  const path = `${key}.png`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: "image/png",
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  const pub = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const url = `${pub}?t=${Date.now()}`;
  _overrides.set(key, url);
  return url;
}

/** Converte um dataURL (base64) num Blob p/ o upload. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(head)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
