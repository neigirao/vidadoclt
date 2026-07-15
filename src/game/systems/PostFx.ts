import Phaser from "phaser";
import { loadSettings } from "./Settings";

// ─────────────────────────────────────────────────────────────────────────────
// Pós-processamento de câmera (Phaser 4 Filters) — "polimento cinematográfico".
//
// POR QUE: os fundos das fases variam (pintados ricos na 1/2, desenhados nas
// 3/4/5). Um grade + BLOOM aplicados na CÂMERA unificam o visual e fazem os
// brilhos (janelas, monitores, neon, VR, glows de combate) "acenderem" — dá
// coesão e polimento sem arte nova, e disfarça a diferença dos fundos.
//
// CONVIVE com o SanityFx: aquele adiciona vignette/colorMatrix/barrel modulados
// por sanidade; este adiciona um grade base + bloom. Os filtros COMPÕEM (Phaser
// aplica na ordem em que foram adicionados). Chamar ANTES do SanityFx pra o grade
// base ficar na base da pilha.
//
// Desligado por `reduceSanityFx` (acessibilidade / fotossensibilidade / perf) —
// bloom é multi-pass e pode incomodar quem marcou "reduzir efeitos".
// ─────────────────────────────────────────────────────────────────────────────

interface CamFilterList {
  addColorMatrix?: () => {
    colorMatrix: {
      reset: () => unknown;
      brightness?: (v: number) => unknown;
      contrast?: (v: number) => unknown;
      saturate?: (v: number) => unknown;
      multiply?: (m: number[], multiply?: boolean) => unknown;
    };
  };
  addVignette?: (
    x?: number,
    y?: number,
    radius?: number,
    strength?: number,
    color?: number,
  ) => {
    strength?: number;
  };
}

/** Aplica o grade base + vignette cinematográfica na câmera principal. Idempotente
 *  por cena (chamar 1× no create). No-op se os Filters não existirem (canvas sem
 *  WebGL) ou no modo de acessibilidade.
 *
 *  Nota: o Phaser desta versão NÃO expõe `addBloom` — o "acender" dos brilhos fica
 *  com os glows aditivos locais que já existem (fxGlow, faíscas de VR/combate). O
 *  grade + vignette dão a COESÃO cinematográfica entre as fases. */
export function applyCinematicPostFx(scene: Phaser.Scene): void {
  if (loadSettings().reduceSanityFx) return;
  const cam = scene.cameras.main;
  const f = (cam as unknown as { filters?: { internal?: CamFilterList } }).filters?.internal;
  if (!f?.addColorMatrix) return;

  // Grade base MUITO sutil: um respiro de contraste/saturação/brilho pra "assentar"
  // a paleta e unificar as fases sem estourar os fundos pintados (1/2).
  try {
    const grade = f.addColorMatrix();
    const cm = grade.colorMatrix;
    cm.reset();
    cm.brightness?.(1.03);
    cm.contrast?.(0.06);
    cm.saturate?.(0.08);
  } catch {
    /* ColorMatrix indisponível — segue sem grade */
  }

  // Vignette BASE cinematográfica (o SanityFx só escurece os cantos quando a
  // sanidade cai; aqui deixamos um enquadramento sutil sempre presente). Compõe
  // com o do SanityFx (intensifica no estresse).
  try {
    f.addVignette?.(0.5, 0.5, 0.92, 0.22, 0x000000);
  } catch {
    /* Vignette indisponível */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Paleta por BIOMA (leitura de progresso) — cada andar do prédio ganha uma
// assinatura de cor sutil, tintando por CANAL (quente/frio) via ColorMatrix.
// Usa `multiply` com uma matriz de escala RGB — NÃO rotação de hue (que
// distorceria pele/UI). Sutil de propósito (±10%): comunica "andar diferente"
// sem virar filtro de Instagram. Compõe por cima do grade base.
// Alinhado à arte REAL de cada fase:
//   1 Open Space          = neutro morno (escritório "normal")
//   2 Atendimento/Comerc. = pastel morno (call center humano, dessaturado)
//   3 Produto/Tecnologia   = frio leve (cultura tech)
//   4 TI / Servidores      = neon frio FORTE (azul/ciano — sala de servidores)
//   5 Diretoria            = âmbar dourado (poder executivo, morno)
// ─────────────────────────────────────────────────────────────────────────────
type Biome = { r: number; g: number; b: number; sat?: number; contrast?: number };
const BIOMES: Record<number, Biome> = {
  1: { r: 1.02, g: 1.0, b: 0.98 },
  2: { r: 1.05, g: 1.01, b: 0.95, sat: -0.05 },
  3: { r: 0.98, g: 1.0, b: 1.04, sat: 0.06 },
  4: { r: 0.9, g: 0.98, b: 1.12, sat: 0.1 },
  5: { r: 1.08, g: 1.02, b: 0.9, sat: 0.02 },
  6: { r: 1.09, g: 0.94, b: 0.92, contrast: 0.06 }, // CEO/Cobertura — crepúsculo tenso (clímax)
};

/** Aplica a paleta-assinatura do bioma (nº da fase 1–5) na câmera. No-op fora
 *  do range, sem Filters, ou no modo de acessibilidade. Chamar após o grade base. */
export function applyBiomePalette(scene: Phaser.Scene, phase: number | null): void {
  if (loadSettings().reduceSanityFx) return;
  const biome = phase != null ? BIOMES[phase] : undefined;
  if (!biome) return;
  const cam = scene.cameras.main;
  const f = (cam as unknown as { filters?: { internal?: CamFilterList } }).filters?.internal;
  if (!f?.addColorMatrix) return;
  try {
    const grade = f.addColorMatrix();
    const cm = grade.colorMatrix;
    cm.reset();
    // Tint por canal: escala R/G/B na diagonal da matriz 4×5 (quente = R↑/B↓).
    // prettier-ignore
    cm.multiply?.([
      biome.r, 0,       0,       0, 0,
      0,       biome.g, 0,       0, 0,
      0,       0,       biome.b, 0, 0,
      0,       0,       0,       1, 0,
    ]);
    if (biome.sat) cm.saturate?.(biome.sat);
    if (biome.contrast) cm.contrast?.(biome.contrast);
  } catch {
    /* ColorMatrix indisponível — segue sem paleta de bioma */
  }
}
