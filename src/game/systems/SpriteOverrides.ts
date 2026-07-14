import Phaser from "phaser";
import { supabase } from "../../integrations/supabase/client";
import { setSpriteOverrideResolver } from "./SpriteLibrary";

// ─────────────────────────────────────────────────────────────────────────────
// Override de FRAME de sprite por runtime — arte refeita pela IA ONLINE.
//
// PROBLEMA: reempacotar o atlas exige o `bun dev`; no jogo publicado não dá. Mas
// o jogador quer "Refazer com IA" no navegador e ver a troca em produção na hora.
//
// SOLUÇÃO (mesma ideia do BgOverrides, mas por frame): a arte aprovada é salva no
// Supabase Storage (bucket `sprite-overrides`) + IndexedDB (device-local), e no
// boot é aplicada POR CIMA do atlas — cada override vira uma textura standalone
// `ovr:<frame>`, e o resolveSprite passa a preferi-la (via setSpriteOverrideResolver).
// Sem reempacotar. Precedência: local (device) > nuvem > frame embutido do atlas.
// ─────────────────────────────────────────────────────────────────────────────

const BUCKET = "sprite-overrides";
const DB_NAME = "vidaclt-sprite";
const STORE = "overrides";
const _overrides = new Map<string, string>(); // frame → dataURL
let _loaded = false;

export function spriteOverrideKey(frame: string): string {
  return `ovr:${frame}`;
}
export function hasSpriteOverride(frame: string): boolean {
  return _overrides.has(frame);
}

// ── IndexedDB mínimo (mesmo padrão do BgOverrides) ──────────────────────────
function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}
async function idbAll(): Promise<Record<string, string>> {
  const db = await openDb();
  if (!db) return {};
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly").objectStore(STORE);
      const keysReq = tx.getAllKeys();
      const valsReq = tx.getAll();
      keysReq.onsuccess = () => {
        valsReq.onsuccess = () => {
          const out: Record<string, string> = {};
          (keysReq.result as IDBValidKey[]).forEach((k, i) => {
            out[String(k)] = valsReq.result[i] as string;
          });
          resolve(out);
        };
      };
      tx.transaction.onerror = () => resolve({});
    } catch {
      resolve({});
    }
  });
}
async function idbSet(key: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Monta o manifesto 1×: overrides locais (device) têm precedência; completa com
 *  os da nuvem (Supabase). Guarda tudo como dataURL p/ o install ser uniforme. */
export async function loadSpriteOverrides(): Promise<void> {
  if (_loaded) return;
  _loaded = true;
  try {
    const local = await idbAll();
    for (const [k, v] of Object.entries(local)) if (v) _overrides.set(k, v);
  } catch {
    /* ignore */
  }
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list("", { limit: 500 });
    if (!error && data) {
      for (const obj of data) {
        if (!obj.name.endsWith(".png")) continue;
        const frame = obj.name.replace(/\.png$/, "");
        if (_overrides.has(frame)) continue; // local vence
        // Signed URL (funciona em bucket PRIVADO e público — a workspace do
        // Lovable bloqueia bucket público). Convertido pra dataURL na hora, então
        // expiry curto basta.
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(obj.name, 3600);
        if (!signed?.signedUrl) continue;
        const dataUrl = await urlToDataUrl(signed.signedUrl);
        if (dataUrl) _overrides.set(frame, dataUrl);
      }
    }
  } catch {
    /* offline / sem bucket — segue só com locais + atlas embutido */
  }
}

// addBase64 é assíncrono (decodifica via Image interno) — resolve quando a textura
// entra no TextureManager.
function addTexture(scene: Phaser.Scene, key: string, dataUrl: string): Promise<void> {
  return new Promise((resolve) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const onAdd = (added: string) => {
      if (added !== key) return;
      scene.textures.off(Phaser.Textures.Events.ADD, onAdd);
      resolve();
    };
    scene.textures.on(Phaser.Textures.Events.ADD, onAdd);
    scene.time?.delayedCall?.(4000, () => resolve()); // fail-safe: não trava o boot
    scene.textures.addBase64(key, dataUrl);
  });
}

/** Instala os overrides carregados como texturas `ovr:<frame>` e liga o resolver
 *  do resolveSprite. Chamar no BootScene, DEPOIS do atlas carregar. */
export async function installSpriteOverrides(scene: Phaser.Scene): Promise<void> {
  for (const [frame, dataUrl] of _overrides) {
    await addTexture(scene, spriteOverrideKey(frame), dataUrl);
  }
  setSpriteOverrideResolver((frame) =>
    _overrides.has(frame) ? spriteOverrideKey(frame) : undefined,
  );
}

/** Salva o override do frame (IndexedDB garantido + nuvem best-effort) e aplica
 *  na hora (adiciona a textura + rebusta o resolver). Retorna {local, cloud}. */
export async function uploadSpriteOverride(
  scene: Phaser.Scene,
  frame: string,
  dataUrl: string,
): Promise<{ local: boolean; cloud: boolean }> {
  await idbSet(frame, dataUrl);
  _overrides.set(frame, dataUrl);
  await addTexture(scene, spriteOverrideKey(frame), dataUrl);
  // re-registra o resolver (limpa o cache do resolveSprite p/ pegar o novo frame).
  setSpriteOverrideResolver((f) => (_overrides.has(f) ? spriteOverrideKey(f) : undefined));
  let cloud = false;
  try {
    const [head, b64] = dataUrl.split(",");
    const mime = /:(.*?);/.exec(head)?.[1] ?? "image/png";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${frame}.png`, new Blob([arr], { type: mime }), {
        upsert: true,
        contentType: "image/png",
        cacheControl: "3600",
      });
    cloud = !error;
  } catch {
    cloud = false;
  }
  return { local: true, cloud };
}
