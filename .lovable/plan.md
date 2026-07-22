# Plano — Melhorar animações/frames

## Diagnóstico atual (das ferramentas)

Rodei `bun audit:anim` no estado atual: **77 jerks · 50 loop-pops · 69 padded · 4 dead**. Os gates que já protegem (`check:frames`, `audit:sprites`, `palette-consistency`) cobrem QUANTIDADE, CANVAS, VAZIO/CHAPADO e PALETA — mas o eixo de **suavidade/loop** é só relatório, nunca foi endereçado. É a maior lacuna hoje.

**Achado sistêmico** (já anotado em CLAUDE.md): os in-betweens que subiram tudo a 16 frames produziram **loops que não fecham** (`loop-pop` generalizado) e ciclos com **filler quase-duplicado** (padded). Ou seja: 16 frames "no papel", mas o olho não lê como mais suave que 4 bem animados. Além disso, quase todo `attack` acusa jerk/loop-pop — porque o in-between de blend deforma poses de ação (o script hoje só respeita esse limite em walk/idle/run via `fill-16-batch`).

## Escopo

Fechar o eixo **suavidade** com 4 frentes, na ordem: (1) fechar loops, (2) enxugar padded, (3) subir gate, (4) atacar attacks caso a caso.

### 1. Fechar loops (loop-pop → 0)

Novo script `scripts/close-loops.mjs` (mesma família dos existentes):
- Lê `audit:anim --json`, seleciona famílias `walk`/`idle`/`run` com flag `loop-pop`.
- Para cada uma, gera **1 in-between extra entre o último e o primeiro** (mesmo motor do `gen-inbetweens.mjs`: blend + trava de paleta), inserido como frame final. Determinístico, sem IA.
- Reempacota atlas 1×. Comando: `bun close:loops` (+ `--dry`).

Alvo realista: derrubar `loop-pop` de 50 → <10 (o resto é ciclo de attack, tratado depois).

### 2. Enxugar padded (69 → <20)

Novo script `scripts/trim-filler.mjs`:
- Detecta pares consecutivos com Δ≈0 (frames idênticos criados por in-between excessivo) via mesma métrica do `audit:anim`.
- Remove o duplicado, reindexa contíguo, reempacota. `--dry` obrigatório antes.
- Respeita piso do `check:frames` (só apara se ficar ≥ piso). Se a família cair abaixo, pula e reporta.

Reflete melhor a máxima "16 frames deve LER como mais suave" — hoje muitos ciclos de 16 têm 8 filler e leem pior que os originais de 4.

### 3. Subir o gate (ligar `audit:anim` no CI como warning-gate)

- Passa `audit:anim --gate` a rodar no CI **em modo warning** (imprime, não falha) por 1–2 iterações; depois vira gate estrito (`exit !=0`) só para `loop-pop` e `dead` (defeitos objetivos). `jerk`/`padded` ficam como relatório (têm falso-positivo em pose legítima).
- Adiciona `bun anim:report` no `package.json` (alias já existe como `audit:anim`; padroniza uso).

### 4. Attacks (77 jerks — arte, não interpolação)

Attack não interpola bem por blend (pose muda: braço/arma). Aqui não vale gerar mais frames deterministicamente — o script `fill-16-batch.mjs` já pula `attack` de propósito. Duas opções, escolho a leve:
- **Recomendado:** rebaixar a expectativa — deixar attacks em 4–8 frames por padrão (é o que Dead Cells/Hades fazem) e usar o LAB `🤖 REFAZER COM IA` só nos attacks visíveis dos bosses (ceo/diretor/brenda/gerente) 1 a 1, quando o teto de gasto do Gemini liberar. **Sem trabalho em massa.**
- Documentar em `docs/ART_GAPS.md` a lista final dos attacks que valem redesenho.

## Verificação

Após cada script: `bun audit:anim` (comparar antes/depois) + `bun check:frames` (garantir que não caiu piso) + `bun smoke` (nenhuma cena crasha) + `bun visual` (baselines de UI intactos).

## Fora de escopo

- Gerar arte nova via IA (bloqueada por 429/teto de gasto).
- Mexer em attacks em massa (deforma pose).
- Novo pipeline de skeletal/spine — o projeto é pixel-art frame-by-frame por decisão.

## Arquivos afetados

- **Novos:** `scripts/close-loops.mjs`, `scripts/trim-filler.mjs`.
- **Editados:** `package.json` (2 scripts), `.github/workflows/ci.yml` (1 job warning), `docs/FRAME_COVERAGE.md` (registro de resultados), `docs/ART_GAPS.md` (lista de attacks para redesenho).
- **Atlas:** `public/assets/atlas.{png,json}` + `public/assets/sprites/*.png` (reempacotados).
