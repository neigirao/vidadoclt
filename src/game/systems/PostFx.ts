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
