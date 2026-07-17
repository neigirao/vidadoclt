import Phaser from "phaser";
import { registerFrameAddition, type AnimState } from "./EnemyAnimConfig";

// ─────────────────────────────────────────────────────────────────────────────
// Varredura do atlas em runtime → o jogo cicla os frames que REALMENTE existem.
//
// PROBLEMA: as contagens de animação (EnemyAnimConfig) são `const` empacotadas.
// Quando o LAB DE SPRITES sobe frames novos direto no atlas (slot upload →
// pack-atlas grava `enemy-<prefixo>-<estado>N.png` e reempacota), o atlas passa a
// TER o frame, mas o jogo continua ciclando só a contagem hardcoded → o frame
// novo nunca aparece. O designer subiu arte e "não refletiu".
//
// SOLUÇÃO: no boot, depois do atlas carregar, contamos por família
// (`enemy-<prefixo>-<estado>`) quantos frames CONTÍGUOS e NÃO-VAZIOS existem, e
// registramos essa contagem em EnemyAnimConfig (via registerFrameAddition, que só
// AUMENTA: max(base, varrido) — nunca reduz abaixo do whitelist curado).
//
// Por que "não-vazio" e não só "existe": vários frames legados são lixo de
// extração (ex.: estagiario-idle3 quase-transparente) e o whitelist os exclui de
// propósito. Contar só existência REGREDIRIA (voltaria a ciclar o lixo). Espelha-
// mos a regra do pack-atlas (<25 px opacos com alpha>30 = vazio): a contagem para
// no primeiro frame vazio, então lixo legado continua fora — mas assim que o LAB
// substitui esse índice por arte de verdade (não-vazia), a família estende sozinha.
// ─────────────────────────────────────────────────────────────────────────────

const SLOT_RE = /^enemy-(.+)-(walk|idle|attack)(\d+)$/;
const OPAQUE_ALPHA = 30; // mesmo corte do pack-atlas
const MIN_OPAQUE = 25; // <25 px opacos = frame vazio/quase-vazio (pack-atlas)

type Family = { prefix: string; state: AnimState; frames: Map<number, Phaser.Textures.Frame> };

/** Extrai o ImageData do atlas inteiro 1× (as famílias compartilham o source). */
function readAtlasPixels(
  scene: Phaser.Scene,
  key: string,
): { data: Uint8ClampedArray; width: number } | null {
  try {
    const src = scene.textures.get(key)?.getSourceImage?.() as
      | HTMLImageElement
      | HTMLCanvasElement
      | undefined;
    const w = (src as { width?: number })?.width ?? 0;
    const h = (src as { height?: number })?.height ?? 0;
    if (!src || !w || !h) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(src as CanvasImageSource, 0, 0);
    return { data: ctx.getImageData(0, 0, w, h).data, width: w };
  } catch {
    return null;
  }
}

/** Conta os px opacos dentro do rect do frame no atlas (usando o ImageData único). */
function opaqueCount(
  pixels: { data: Uint8ClampedArray; width: number },
  frame: Phaser.Textures.Frame,
): number {
  const { cutX, cutY, cutWidth, cutHeight } = frame;
  const { data, width } = pixels;
  let op = 0;
  for (let y = 0; y < cutHeight; y++) {
    let idx = ((cutY + y) * width + cutX) * 4 + 3; // canal alpha do 1º px da linha
    for (let x = 0; x < cutWidth; x++, idx += 4) {
      if (data[idx] > OPAQUE_ALPHA && ++op >= MIN_OPAQUE) return op;
    }
  }
  return op;
}

/**
 * Varre o atlas `key` e registra em EnemyAnimConfig a contagem efetiva de frames
 * por família de animação. Chamar no BootScene, depois do atlas carregar. Falha
 * graciosamente (sem acesso a pixels em headless → não registra nada, mantém as
 * contagens-base; nenhuma regressão).
 */
export function scanAtlasFrameCounts(scene: Phaser.Scene, key = "sprites"): void {
  const tex = scene.textures.get(key);
  if (!tex) return;
  const families = new Map<string, Family>();
  for (const name of tex.getFrameNames()) {
    const m = SLOT_RE.exec(name);
    if (!m) continue;
    const [, prefix, state] = m;
    const fkey = `${prefix}|${state}`;
    let fam = families.get(fkey);
    if (!fam) families.set(fkey, (fam = { prefix, state: state as AnimState, frames: new Map() }));
    fam.frames.set(Number(m[3]), tex.get(name));
  }
  if (families.size === 0) return;

  const pixels = readAtlasPixels(scene, key);
  if (!pixels) return; // headless/sem canvas — mantém as contagens-base

  for (const fam of families.values()) {
    // Conta frames CONTÍGUOS a partir do 0 enquanto existirem E não forem vazios.
    let count = 0;
    for (let frame = fam.frames.get(0); frame; frame = fam.frames.get(count)) {
      if (opaqueCount(pixels, frame) < MIN_OPAQUE) break;
      count++;
    }
    if (count > 0) registerFrameAddition(fam.state, fam.prefix, count);
  }
}
