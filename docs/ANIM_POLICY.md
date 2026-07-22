# Política de animação — frames vs. suavidade

> Acordo de trabalho para evitar o vai-e-volta de "16 frames" × qualidade de
> movimento. Fonte de verdade sobre COMO tratar contagem/suavidade de frames.

## O conflito

Há duas metas que **brigam**:

- **Quantidade** — a meta antiga "16 frames por ação" (cobertura).
- **Qualidade** — a animação lê como suave (movimento).

Nas famílias com poucos frames desenhados à mão, atingir "16" foi feito
**interpolando por blend** (misturar dois frames pra gerar intermediários). Isso
**não entrega a segunda meta**.

## Por que o blend não deixa mais suave (técnico)

Misturar linearmente dois frames de pixel-art **não cria pose intermediária** —
cria uma **sobreposição fantasma** (imagem dupla semitransparente). Em pixel-art
(bordas duras, paleta limitada) isso lê como **borrão/ghost**, não movimento. A
trava de paleta endurece o ghost num frame de transição **abrupto** → o olho vê
**jerk**, o ciclo **não fecha ao repetir (loop-pop)**, e metade dos frames vira
**quase-duplicado (padded)**. Resultado: "16 no papel", pior que 4 limpos.

## Evidência (medida por `bun audit:anim`)

| estado                 | jerk | loop-pop |
| ---------------------- | ---- | -------- |
| antes do lote de blend | 77   | 50       |
| depois do lote         | 93   | 62       |

Piorou. E já tinha acontecido antes (revertido — ver histórico da Fase 1).
**Duas tentativas, dois retrocessos** — é padrão, não azar.

## Por que os tools determinísticos não resolvem

- `close:loops` (fechar loop com mais ponte por blend) → **piora** (mesma razão).
- `trim:filler` (enxugar duplicados) → **não remove nada** (já no piso do
  `check:frames`).

**Suavidade acima do baseline limpo só sai de arte autoral** (keyframes desenhados
à mão, ou geração de imagem quando destravar). O blend é beco sem saída.

## A política (contrato)

1. **Medido, não contado.** O padrão deixa de ser "16 frames sempre". O piso de
   quantidade fica no `check:frames` (por categoria: player walk/run 16; inimigo
   walk 8, idle 4, attack 4, hurt 2, death 3). Cobertura onde ajuda, não cobertor.

2. **Ratchet de suavidade no CI** (`bun audit:anim --gate`, job `check`). Não
   exige zerar os defeitos (impossível sem arte); trava a **não-regressão**:
   compara `dead/jerk/loop-pop/padded` contra `scripts/anim-baseline.json` e
   reprova se qualquer tipo **piorar**. Liberdade pra iterar em frames/arte
   **desde que não regrida**. Teria bloqueado o lote de blend.

3. **Melhorou de verdade → baixa o teto.** Revert de blend, arte nova ou trim que
   reduza os números: rode `bun audit:anim --update-baseline` e commite
   `scripts/anim-baseline.json`. O ratchet **só anda pra baixo**.

4. **16 de verdade = arte de verdade.** Querer 16 frames lindos numa família? O
   caminho é keyframe autoral, **não blend**. Quando chegar, o ratchet reconhece
   o ganho (item 3).

## Resumo operacional

- Adicionou/regenerou frames e o CI (`audit:anim --gate`) passou → ok, mergeia.
- CI acusou regressão → ou a mudança piorou a suavidade (não infle com blend), ou
  é melhoria real e você regrava a baseline conscientemente.
