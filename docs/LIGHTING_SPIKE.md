# Spike de Iluminação — achados (Phaser 4, esta build)

Sondagem headless (`window.__game`, renderer WebGL) do que a build oferece para
iluminação dinâmica, antes de escolher a abordagem. Resultado:

## O que EXISTE

- **Renderer WebGL** (`renderer.type === 2`). ✓
- **`scene.lights` + `scene.lights.addLight`** existem (LightsManager estilo Phaser 3).
- **Filters de câmera (Phaser 4)** em `camera.filters.internal/external`, incluindo:
  `addImageLight`, `addNormalTools`, `addGlow`, `addShadow`, `addVignette`,
  `addColorMatrix`, `addBlend`, `addDisplacement`, `addBlur`, `addBokeh`.

## O que NÃO existe

- **`sprite.preFX` / `sprite.postFX`** → `false`. FX por-sprite do Phaser 3 não
  está nesta build (bate com a nota do CLAUDE.md sobre `addBloom`/`postFX`).
- Máscaras de geometria são Canvas-only (já sabido — por isso o `Apagao` usa
  textura com furo radial).

## Decisão

O caminho "correto" de luz normal-mapeada (`addImageLight` + `addNormalTools`)
existe, MAS exige um normal-map em screen-space do frame renderizado + pipeline
próprio — é um spike grande de payoff incerto. **Adiado.**

**Abordagem escolhida (proven, determinística, "chama atenção"):** um **lightmap
aditivo** — camada de escurecimento ambiente + poças de luz radiais em BLEND_ADD
por fonte (tocha do player, brilho de monitores, aura do boss, VR). É a técnica
2D clássica, roda em qualquer WebGL, é barata e já tem precedente no código (o
`Apagao` faz o inverso: escuridão com furo). Implementada em `systems/Lighting.ts`,
no-op sob `reduceSanityFx` (acessibilidade/fotossensibilidade) ou sem Filters.

O normal-map generator (`gen-normals.mjs`) fica para quando/se a rota
`addImageLight` for retomada — não é pré-requisito do lightmap.
