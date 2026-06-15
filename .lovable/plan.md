# Plano: resolver os 3 problemas pendentes

## Diagnóstico rápido

Antes do plano, fiz uma auditoria objetiva — alguns sintomas relatados são diferentes da causa real:

- **`atlas.png` JÁ tem canal alpha** (RGBA, 512×3616). Auditei os 698 PNGs de origem: **apenas 8** têm fundo opaco real. Os demais "boxes" que aparecem são casos pontuais, não um problema global do atlas.
- **404 de asset**: nenhum log atual no preview menciona um 404 específico — preciso identificar o recurso antes de remover/substituir.
- **Player "não colado no chão"**: confirmado por cálculo. `FLOOR_Y = HUD_BOT_Y - 32`; tileSprite do chão centrado em `FLOOR_Y + 8` (topo em `FLOOR_Y`); body do player `setOffset(14,30) setSize(20,34)` → body bottom = bottom do sprite. Como `normalize-frames.py` deixa `PAD_BOTTOM = 2` de transparência embaixo de cada frame, os pés visíveis ficam **2 px acima** do chão.

## O que será feito

### 1. Sprites com fundo (8 arquivos isolados)

Lista exata identificada pela auditoria:
`boss-ceo-special0`, `boss-diretor-death0`, `obj-baia`, `obj-door`, `obj-monitor-active`, `obj-monitor-broken`, `obj-monitor-use`, `obj-ponto`.

Adicionar `scripts/strip-bg.py` que:
- abre cada PNG da lista,
- amostra a cor de fundo nos 4 cantos (mediana),
- zera o alpha de qualquer pixel com distância de cor ≤ tolerância (≈25),
- preserva o resto via Floyd-style cleanup de borda (alpha morfológico leve para evitar halo).
Reempacotar o atlas: `node scripts/pack-atlas.mjs`.

### 2. Erro 404 do asset decorativo

- Abrir a aba Network do preview ao vivo (`browser--list_network_requests`) com a cena já carregada para capturar o nome exato do recurso 404.
- Se for uma textura referenciada por chave inexistente no atlas e sem fallback standalone, ou registrar a chave em `EXPLICIT_ALIASES` (SpriteLibrary.ts), ou remover a referência decorativa em `OpenSpaceScene` / outras cenas. Decisão depende do nome — registro no plano apenas o procedimento.

### 3. Player colado no chão

Duas opções; vou usar **A** (não muda layout dos frames):

**A. Ajustar offset do body do player** em `src/game/entities/Player.ts`:
- `body.setOffset(14, 28)` (era `30`), mantendo `setSize(20, 34)`.
- Resultado: body bottom = sprite y 62 = exatamente onde estão os pés após `PAD_BOTTOM=2`. Pés tocam o chão; nada de gameplay muda.

**B (descartada por agora)**: rerodar `normalize-frames.py` com `PAD_BOTTOM=0`. Mais correto na origem, mas regrava 698 PNGs e o atlas — risco maior, ganho idêntico.

Aplicar o mesmo raciocínio em `Enemies.ts` e `Boss.ts` se o sintoma estiver visível neles (verificar em runtime após o fix do player).

## Arquivos tocados

- `scripts/strip-bg.py` (novo)
- 8 PNGs em `public/assets/sprites/` (reescritos)
- `public/assets/atlas.png` + `public/assets/atlas.json` (regerados)
- `src/game/entities/Player.ts` (1 linha)
- possivelmente `src/game/systems/SpriteLibrary.ts` **ou** uma cena, dependendo do 404
