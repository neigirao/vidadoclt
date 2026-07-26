# Blender → sprites — resultado da prova de conceito

> Resposta ao beco sem saída do `docs/ANIM_POLICY.md` (o in-between por blend
> fantasma e não suaviza) **e** à geração de imagem bloqueada: o Blender roda
> aqui, headless, sem API e sem custo.

## Ambiente

```bash
apt-get install -y --no-install-recommends blender libegl1 libgl1 libgles2 libosmesa6 xvfb
xvfb-run -a blender -b -P scripts/blender/render-player.py -- <out_dir> 16
node scripts/blender/post-pixelate.mjs <out_dir> player-walk [--apply]
```

O `xvfb-run` é necessário: o renderer Workbench precisa de contexto GL — sem
display o Blender falha com `EGL_NOT_INITIALIZED`.

## Resultado MEDIDO (o que importa)

Ciclo de caminhada do player, 16 frames, mesma família, medido por `bun audit:anim`:

|                                            | Δ movimento | **uniformidade** | defeitos |
| ------------------------------------------ | ----------- | ---------------- | -------- |
| arte atual (frames + in-between por blend) | 2.7         | **25%**          | —        |
| render do rig no Blender                   | 3.5         | **68%**          | —        |

**Uniformidade 25% → 68% (2,7×), com MAIS movimento por frame, e zero defeitos.**
`player|run` ficou em 25% no mesmo teste (grupo de controle — não foi tocado).

Por que funciona: a interpolação acontece nas **curvas do rig** (Bezier entre
poses-chave), não nos pixels. Não existe imagem-dupla porque nunca se mistura
duas imagens — cada frame é uma renderização de uma pose real. E o loop fecha
exato por construção (a pose do frame N+1 é keyframada idêntica à do frame 1).

## O que a POC NÃO resolve

A arte do boneco é **placeholder cru** (caixas, sem rosto, silhueta estreita).
A POC prova o **pipeline**, não este personagem — por isso os frames foram
revertidos após a medição, e a arte atual continua no repo.

**E o mais importante, medido também:** o mesmo pipeline aplicado a um FUNDO
(`render-bg-ceo.py`, cobertura do CEO) **não** deu ganho claro. O render tem mais
profundidade e luz que o `bg-cobertura.png` atual, mas perdeu o gradiente de
pôr-do-sol e a composição — ficou diferente, não melhor.

A lição: o Blender resolve o problema de **animação** porque ali o ganho é
_mecânico_ (matemática de interpolação, medível). Para **fundo**, o gargalo é
_direção de arte_ (composição, cor, clima) — e ferramenta nenhuma entrega gosto.

## Caminho recomendado

1. Modelar/riggar o player de verdade (proporções da referência 34×53, rosto,
   silhueta larga) — 1 personagem, todos os estados.
2. Renderizar walk/run/idle/attack e medir: só entra se a uniformidade subir.
   Se subir, `bun audit:anim --update-baseline` trava o ganho.
3. Repetir por personagem, em ordem de aparição na tela.

Fundos seguem melhor pela mão de um artista (ou geração de imagem quando
destravar) — o pipeline 3D fica disponível, mas não é atalho de direção de arte.
