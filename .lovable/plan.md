## Análise V1 vs V2 (Open Space)

**OpenSpaceScene (V1) – 882 linhas**
- Layout em "zonas" (Entrada, Open Space A/B, Boss) com clusters de mesas/estantes/armários.
- `buildPlatform(x, kind, tiles)` — altura derivada do tipo de móvel.
- Mais inimigos no roster (inclui `ConviteReuniao`), tem `phase2Active`, `buildDecor()` e `buildInteractiveObjects()` separados.
- Mais "vida" e variação visual, porém com mais acoplamento e código duplicado.

**OpenSpaceV2Scene (V2) – 660 linhas**
- Layout linear: 6 plataformas alternando mesa (30 px) / prateleira (72 px) com `buildPlatform(x, y, tiles)` explícito → previsível.
- Decorativos coerentes (café, bebedouro, ponto eletrônico, extintor, monitores nas mesas, quadros motivacionais em parallax).
- Sem `ConviteReuniao` e sem fase 2 separada — fluxo mais limpo.
- Código ~25% menor, mais legível, mais fácil de evoluir.

**Veredito:** V2 é melhor como base de progressão (legibilidade, parallax, pacing de plataformas). V1 tem variedade visual interessante mas está sobrecarregada. Recomendo **manter V2 como padrão** e portar 2 ideias de V1 quando fizer sentido: cluster de baias variado e o inimigo `ConviteReuniao`.

## Mudanças propostas

### 1. Tornar V2 o caminho padrão
- `ClassSelectScene.ts` linha 265: trocar `run.v2Mode ? "OpenSpaceV2Scene" : "OpenSpaceScene"` por `"OpenSpaceV2Scene"` sempre.
- `MenuScene.ts`: remover a opção "JOGAR V2" e deixar só "JOGAR" (mantém comportamento V2).
- Não deletar `OpenSpaceScene.ts` ainda — fica como referência até a próxima iteração.

### 2. Substituir sprite do player pelo sheet enviado
Arquivo: `public/assets/sprites/Gemini_Generated_Image_iiu1fniiu1fniiu1.png` (2750×1536, RGBA com transparência completa, frames declarados como 64×96).

O sheet **não é uma grade limpa** — tem títulos, paleta e painel de acessórios. Cada seção (IDLE, WALK, RUN, JUMP, FALL, DASH, ATTACK, HURT, INTERACT, BURNOUT) começa em um Y diferente e tem contagens distintas. Estratégia:

1. **Novo script `scripts/extract-player-from-sheet.py`** que:
   - Recebe um mapa hardcoded de seções (animName → {x, y, count, frameW=64, frameH=96}).
   - Para cada seção, recorta `count` células 64×96 a partir de (x, y), salva como `player-<anim><i>.png` em `public/assets/sprites/`.
   - Detecta o offset inicial de cada banda automaticamente procurando o primeiro pixel não-transparente (robustez contra ajuste fino dos Y).
   - Reduz para o padrão atual (idle 6, walk 8, run 8, jump 4, fall 3, dash 4, attack 6, hurt 2, interact 3, burnout 4) **amostrando frames uniformemente** para não quebrar o `Player.ts` (que indexa por `Math.floor(now/N) % count`).
2. Rodar `scripts/normalize-frames.py` para padronizar para 48×64 com pés alinhados (já existe e é o que o resto do jogo espera).
3. Rodar `scripts/check-sprites.mjs` para garantir que todos têm alpha.
4. Rodar `scripts/pack-atlas.py` para reempacotar `atlas.png` + `atlas.json`.
5. Atualizar `mem://design/player-sprite` com a origem do novo sheet.

### 3. Validações
- Abrir o preview e verificar idle/walk/run/jump/fall/dash/attack visualmente.
- Conferir alinhamento dos pés (já corrigido via `setOffset(14, 28)`).
- Build TS deve passar (sem mudança de API).

## Arquivos tocados
- `src/game/scenes/ClassSelectScene.ts` (1 linha)
- `src/game/scenes/MenuScene.ts` (1 item de menu)
- `scripts/extract-player-from-sheet.py` (novo)
- ~41 PNGs em `public/assets/sprites/player-*.png` (regerados)
- `public/assets/atlas.png` + `public/assets/atlas.json` (regerados)

## Perguntas

1. **Confirmar V2 como padrão e ocultar V1 do menu** (mantendo o arquivo no repo)? Ou prefere manter as duas opções no menu?
2. As contagens reduzidas (idle 6, walk 8, run 8, jump 4, fall 3, dash 4, attack 6, hurt 2, interact 3, burnout 4) mantêm o código atual sem mexer em `Player.ts`. Pode aprovar? Se quiser usar os 12/16/16 originais do sheet, eu também ajusto os índices em `Player.ts`.
