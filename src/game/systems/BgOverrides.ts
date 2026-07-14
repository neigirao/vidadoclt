import { supabase } from "../../integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Overrides de fundo de fase, subidos pelo LAB (fase de teste).
//
// PROBLEMA: o build publicado é estático — não há backend pra gravar
// public/assets/bg-*.png, e o endpoint do plugin do Vite só existe em `vite dev`.
//
// SOLUÇÃO em 2 camadas (a 1ª funciona SEM nenhum setup):
//   1. IndexedDB (device-local): grava o PNG no navegador do tester. Persiste
//      entre reloads, zero infra. É o "subir e salvar" que funciona já.
//   2. Supabase Storage (compartilhado): se o bucket `bg-overrides` existir,
//      também sobe pra nuvem → aparece p/ TODOS os testers. Best-effort: se o
//      bucket não existir / offline, ignora e mantém a persistência local.
//
// Precedência ao carregar: override local (deste device) > override na nuvem >
// asset embutido. Assim quem subiu vê a própria arte na hora.
//
// Uso:
//   • BootScene/Preload: `await loadBgManifest()` (1×).
//   • Preload das fases: `this.load.image(key, bgUrl(key))`.
//   • LAB: `await uploadBg(key, dataUrl)`.
// ─────────────────────────────────────────────────────────────────────────────

const BUCKET = "bg-overrides";
const DB_NAME = "vidaclt-bg";
const STORE = "overrides";
const _overrides = new Map<string, string>(); // key (bg-*) → dataURL local ou URL da nuvem
let _loaded = false;

// ── IndexedDB mínimo (sem dependência) ──────────────────────────────────────
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

// ── API ─────────────────────────────────────────────────────────────────────
/** URL/dataURL a usar p/ um fundo: override (local ou nuvem) senão asset embutido. */
export function bgUrl(key: string): string {
  return _overrides.get(key) ?? `/assets/${key}.png`;
}

/** Há override (local ou nuvem) p/ este fundo? */
export function hasBgOverride(key: string): boolean {
  return _overrides.has(key);
}

/**
 * Monta o manifesto 1×: overrides locais (IndexedDB, este device) têm precedência;
 * depois completa com os da nuvem (Supabase) que ainda não têm local. Fail-safe.
 */
export async function loadBgManifest(): Promise<void> {
  if (_loaded) return;
  _loaded = true;
  // 1) locais (device) — sempre disponíveis, sem rede.
  try {
    const local = await idbAll();
    for (const [k, v] of Object.entries(local)) if (v) _overrides.set(k, v);
  } catch {
    /* ignore */
  }
  // 2) nuvem (compartilhado) — só preenche o que não veio local.
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list("", { limit: 100 });
    if (!error && data) {
      for (const obj of data) {
        if (!obj.name.endsWith(".png")) continue;
        const key = obj.name.replace(/\.png$/, "");
        if (_overrides.has(key)) continue; // local vence
        // Signed URL (funciona em bucket PRIVADO e público — a workspace do Lovable
        // bloqueia bucket público). Validade LONGA porque o fundo é carregado sob
        // demanda ao entrar na fase (bem depois do boot), não convertido na hora.
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(obj.name, 604800); // 7 dias
        if (signed?.signedUrl) _overrides.set(key, signed.signedUrl);
      }
    }
  } catch {
    /* offline / sem bucket — segue com locais + embutidos */
  }
}

/**
 * Salva o fundo. SEMPRE persiste local (IndexedDB) — funciona já. Tenta também a
 * nuvem (best-effort). Retorna { local:true, cloud:boolean } p/ o LAB avisar.
 */
export async function uploadBg(
  key: string,
  dataUrl: string,
): Promise<{ local: boolean; cloud: boolean }> {
  // 1) local (garantido)
  await idbSet(key, dataUrl);
  _overrides.set(key, dataUrl);
  // 2) nuvem (best-effort)
  let cloud = false;
  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${key}.png`, dataUrlToBlob(dataUrl), {
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

/** Converte um dataURL (base64) num Blob. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(head)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
