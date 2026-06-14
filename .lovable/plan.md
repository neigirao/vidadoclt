# Por que os sprites estão flickando

Diagnóstico após inspecionar os PNGs e o código:

**Causa raiz — frames mal alinhados.** Os sprites foram extraídos dos boards do ChatGPT por scripts que recortaram **cada frame de forma independente** (auto-crop por componente conectado + resize). Resultado: dentro de um mesmo ciclo de animação, o personagem ocupa quantidades muito diferentes de pixels e posições diferentes dentro do canvas. Exemplos medidos agora:

- `player-walk0..7`: pixels opacos variam de **983 → 1471** (+50%)
- `player-idle0..5`: variam de **812 → 1063**
- `enemy-analista-walk0..3`: **66 → 159** (+140%)

Como o `Sprite` do Phaser usa origem `(0.5, 0.5)` e cada frame tem o personagem recentralizado de jeito diferente, a cada troca de textura (a cada 75–420ms) a silhueta "pula" alguns pixels para os lados / para cima e para baixo — isso é o flicker que você vê. Não é problema de FPS nem de WebGL.

**Problemas secundários** que amplificam:

1. **Hitbox do player desalinhada.** `Player.ts` faz `body.setSize(20,34)` + `setOffset(6,14)` assumindo sprite **32×48**, mas os PNGs reais são **48×64**. O retângulo de física fica deslocado em relação ao desenho, o que faz o sprite parecer "tremer" quando o personagem está parado contra parede / chão (corpo empurra, sprite acompanha com offset errado).
2. **Sem `setOrigin` por âncora de pés.** Como os frames têm alturas visuais diferentes, ancorar pelo centro do canvas faz a cabeça subir/descer. O correto para platformer é âncora "pés" (origin Y = 1) com offset fixo.
3. **`tex-player` (alias do HUD)** aponta para `idle0` mas é a mesma textura usada no avatar do HUD — sem problema, só registrando.

# Plano de correção

## 1. Reprocessar os sprites com bounding box compartilhada (principal)

Criar `scripts/normalize-frames.mjs` que, para cada conjunto (`player-idle*`, `player-walk*`, `player-run*`, `player-jump*`, `player-fall*`, `player-attack*`, `player-dash*`, `player-hurt*`, `player-burnout*`, `player-interact*`, e cada `enemy-<nome>-<state>*`, e cada `boss-<nome>-<state>*`):

1. Lê todos os PNGs do conjunto.
2. Calcula a **bounding box união** dos pixels opacos (alpha > 20) de todos os frames.
3. Recorta cada frame usando essa MESMA bbox.
4. Coloca o recorte em um canvas de tamanho fixo do conjunto, **ancorado pelos pés** (centralizado em X, alinhado no rodapé em Y), com 2px de padding.
5. Sobrescreve o PNG.

Isso elimina o "pulo" entre frames sem alterar o conteúdo visual.

## 2. Ajustar Player.ts para os sprites 48×64 reais

- `body.setSize(18, 44)` e `setOffset(15, 18)` (centraliza torso/pernas no sprite 48×64, deixa cabeça fora da hitbox).
- `this.setOrigin(0.5, 1)` e empurrar Y do corpo para alinhar pés. (Alternativa mais simples: manter origin 0.5,0.5 mas garantir que todos os frames têm os pés na mesma linha após o passo 1 — recomendado, menos invasivo.)

## 3. Validar bosses e inimigos

Após o normalize, conferir 3 conjuntos representativos abrindo no preview (`OpenSpaceScene` para player + estagiário + analista; `Phase4Scene` ou similar para um boss). Se ainda houver "pop" sutil entre estados (ex.: `idle` → `walk`), aplicar o mesmo cálculo de bbox **entre estados do mesmo personagem** (união global por personagem), não só dentro de cada estado.

## 4. Não tocar

- Lógica de combate, física, HUD, cenas — nenhuma alteração.
- Sistema de animação no `updateTexture()` está correto, só precisa de frames consistentes.
- Backgrounds, atlas e demais assets.

## Detalhes técnicos

```text
Para cada grupo G = {f0.png, f1.png, ..., fN.png}:
  bbox_union = (∞, ∞, -∞, -∞)
  para cada f em G:
    bbox_f = pixels com alpha > 20
    bbox_union = união(bbox_union, bbox_f)
  W, H = canvas alvo (ex.: 48×64 para player, 32×48 enemies, 64×64 bosses)
  para cada f em G:
    crop = f[bbox_union]
    out = canvas transparente W×H
    dx = (W - crop.w) // 2                  # centro horizontal
    dy = (H - crop.h) - 2                   # ancorado nos pés, padding 2
    out.paste(crop, (dx, dy))
    salvar out sobrescrevendo f
```

Bibliotecas já no projeto: **Pillow (Python3)** ou **sharp/Jimp** (Node). Usar Python3 — é mais rápido e já está disponível no sandbox.

## Verificação

1. Rodar o script de normalização.
2. Abrir preview (`/`) e observar player parado (idle), andando (walk), correndo, pulando, atacando.
3. Confirmar que silhueta não "treme" mais entre frames.
4. Conferir 2–3 inimigos em combate.

## Risco

Baixo. Só sobrescreve PNGs (regeneráveis a partir dos boards originais em `public/assets/sprites/ChatGPT Image *.png`). Nenhuma alteração de gameplay. Se algum frame ficar mal ancorado, basta rerodar com bbox ajustada.
