# Recorte de folhas-fonte → frames (scripts/slice-sheet.mjs)

Pipeline **gratuito** (sem IA/serviço pago) para reaproveitar as _character
sheets_ originais (as folhas grandes "VIDA DE CLT" com IDLE/WALK/ATTACK/…) e
recortá-las em frames individuais para o atlas. Usa só `sharp` + `pngjs`.

## Por que existe

As folhas-fonte (ChatGPT/Gemini/Photoroom, guardadas fora do repo) já contêm a
arte boa — inclusive frames que **faltavam** no jogo (ex.: as animações de
`death` dos inimigos da Fase 1). O recorte automático original saiu torto. Este
script re-fationa de forma **determinística e revisável**.

## Como funciona

1. **Remoção de fundo** (`--bg`):
   - `graymid` — fundo é o gradiente/"xadrez" cinza neutro achatado (transparência
     falsa). Pixel neutro de luminância média → transparente.
   - `dark` (default p/ 3ch) — fundo é a cor sólida do canto; conteúdo = o que
     difere dela.
   - `alpha` — a fonte já tem alpha real.
2. **Mapa de blocos** (`SHEET_MAPS[<id>]`): cada folha é descrita por blocos
   `{prefix, action, x0,y0,x1,y1, n, frame?}` lidos de um _ruler_ sobreposto. Os
   frames são empacotados lado-a-lado → **grade fixa** (dividir `x0..x1` em `n`).
3. **Corte individual robusto** (`frameRanges`):
   - **auto-trim** horizontal do bloco (remove o espaço morto do chute manual, a
     causa do _drift_ que fatiava frames);
   - divisão uniforme dentro das bordas reais + **snap gentil** ao vale da
     projeção (janela pequena → corrige desalinho fino sem pular pro vão interno
     corpo×objeto).
4. **Limpeza da célula** (`keepLargeComponents`): remove números/rótulos soltos e
   linhas separadoras (componentes pequenos ou finos-e-longos), mantendo o
   personagem + itens presos (maleta/arma).
5. **Normalização**: `fit: contain` no frame-alvo, ancorado nos **pés** (south).

## Uso

```bash
# 1) PREVIEW (não grava): confere a geometria do mapa
node scripts/slice-sheet.mjs <fonte.png> --bg=dark --map=inimigos1

# 2) WRITE: grava em public/assets/sprites/ (opcional: --action=<só um estado>)
node scripts/slice-sheet.mjs <fonte.png> --bg=dark --map=inimigos1 --write --action=death
node scripts/pack-atlas.mjs   # re-empacota o atlas
```

## Regras de segurança aprendidas

- **Não regredir o que já está bom.** O player (`s31`) já vinha bem-cortado deste
  mesmo sheet — re-cortar não melhora e arrisca frames quebrados (silhueta de
  walk muito variável). Deixado como está.
- **Coerência do gate.** `EnemyAnimConfig` fixa quantos frames o jogo CICLA
  (walk/idle/attack); `check:frames` reprova se o atlas tiver menos. Ao substituir
  uma família por menos frames que o config, ou (a) re-dobrar via `fill:frames`
  até o piso, ou (b) baixar a contagem no config + ajustar o ms. Por isso a 1ª
  aplicação foi só **death** (não entra na checagem de coerência; piso 3 = o que o
  sheet dá) — ganho limpo, zero risco.
- **Confira o PREVIEW antes de `--write`.** Blocos com FX (balão "SINERGIA!",
  respingo de café, spread de post-it, ondas sonoras) pedem `x1`/`n` ajustados
  para não entrar no frame.

## Mapas atuais

- `inimigos1` (s7) — 5 inimigos da Fase 1 (estagiário/analista/facilitador/scrum/
  coordenador): idle 4, walk 4, attack 2–3, hurt 1, **death 3**. Aplicado: death.
- `player` (s31) — mapa de referência; **não aplicado** (player já está bom).

## Próximos (folhas ainda por mapear)

Bosses (s2/s5/s16/s22/s29), demais inimigos (s3/s11/s20/s21), fundos de fase
(s13/s14/s15/s26/s27/s28). Cada um precisa do seu bloco de coordenadas + a
reconciliação de coerência acima antes de substituir walk/idle/attack.
