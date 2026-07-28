# Lacunas de ARTE — o que precisa de arte nova (não de código)

> Lista de compras de arte. O que dá pra resolver por **código/interpolação** já está
> coberto pelo pipeline de frames (`bun run fill:frames`). Isto aqui é o que **exige
> arte desenhada ou geração de imagem** — nenhuma linha de código resolve.
>
> Como este arquivo se mantém honesto: rode `bun run fill:frames --dry` para separar
> o que é interpolável (some daqui sozinho) do que precisa de arte; e o
> `runFullAudit()` no LAB SPRITES para achar frames incoerentes/mismatched.

## A ordem sai de `bun art:queue`, não de opinião

`bun art:queue` (`scripts/art-queue.mjs`) ordena as animações defeituosas por
**prioridade = defeito × peso da ação × exposição da fase**. A exposição é DADO
(telemetria limpa, `docs/TELEMETRIA.md`): Fase 1 = 62 sessões humanas, CEO = 3.
Ordenar por qualidade pura leva a gastar arte onde quase ninguém vê — o `walk` de
um inimigo da Fase 1 roda o tempo todo, para todo jogador; o clímax é visto por 5%.

Prioridade acumulada por fase (leitura atual):

| fase | prioridade |
| ---- | ---------: |
| 1    | **16.855** |
| 4    |      4.052 |
| 3    |      3.984 |
| 2    |      2.598 |
| 5    |        972 |
| CEO  |         92 |

**Top 6 da fila** (todos `jerk`+`loop-pop`, já no piso de frames → só arte resolve):
`facilitador|walk` (8f), `facilitador|idle`, `analista|idle`, `estagiario|idle`
(12f cada), `ti-suporte|walk` (14f), `evangelista|idle` (11f). Cinco dos seis são
Fase 1 — é onde a próxima hora de arte rende mais. **77 animações na fila.**

**A fila IGNORA arte que o motor não renderiza.** `bun art:queue` filtra por
`renderiza()`: as Fases 2–5 (`animPhase`) NÃO ciclam `attack` (pose estática por
decisão de design) e a Fase 1 veta `attack` de analista/facilitador/coordenador
(`ATTACK_SAFE_FRAMES = 0`, porque a arte é outro personagem). Sem esse filtro a
fila mandava trabalhar em arte invisível: **19 das 96 animações, 23% da prioridade
total, e 4 das 10 primeiras**. Para essas entrarem na fila, primeiro é preciso
arte de attack coerente (P5 abaixo) e subir a whitelist.

**Aberto — `boss-ceo|hurt` carrega 17 frames para ~2 poses.** O `audit:anim` marca
`dead` (delta 0.00 entre frames consecutivos no atlas) e só 2 conteúdos distintos
existem entre os 17 PNGs-fonte. Mesmo padrão dos idles estáticos já trimados, mas
não mexido: é o clímax visto por 3 de 62 sessões, e as duas medições divergem sobre
quantas poses distintas há. Trimar exige `EXCEPTION` no `check:frames` e conferir
frame a frame antes.

**Já resolvido sem arte:** `impressora|idle`, `seguranca|idle` e `ti-suporte|idle`
tinham **16 frames byte-idênticos** (`maxDelta = 0.000`) — passavam no piso de 8 e
entregavam zero suavidade. Cortados para 1 frame, com `EXCEPTION` documentada no
`check:frames`. O jogo renderiza igual; o atlas perdeu 45 duplicatas; e a lacuna
("estes três precisam de um idle de respiração de verdade") agora está VISÍVEL em
vez de escondida atrás de uma contagem que passava.

## Prioridade 1 — o clímax está fraco

- **Fundo do CEO (cobertura)** — por confissão do próprio projeto, o pior fundo do
  jogo, no encontro mais importante. Skyline chapado onde devia ter peso. É o maior
  retorno visual de um único asset. **Ressalva medida:** é visto por 1 em cada 20
  jogadores (3 sessões contra 62 da Fase 1). Alto retorno POR ASSET, baixo retorno
  por jogador alcançado — fazer quando a fila da Fase 1 estiver limpa, não antes.
- **Buildup de entrada do CEO** — o CEO chega "frio". Falta uma tela/beat de entrada
  (a parte de _código_ dá pra fazer; o _visual_ do beat pede arte).

## Prioridade 2 — bosses sem identidade visual

- **Sprites de boss distintos** para **Coordenador** e **Scrum** — hoje são inimigos
  comuns "inflados" (leem como inimigo grande, não boss). A máquina de estados eu
  faço em código; o **sprite dedicado** precisa de arte.
- **Brenda** e **Diretor** reusam sprites de outros inimigos (`rh` / `evangelista-boss`)
  — merecem arte própria.

## Prioridade 3 — especiais por classe (o maior teto de design)

- **FX/visual do especial (K) único por classe** (Estagiário / Analista / Terceirizado).
  A mecânica eu implemento com placeholder; o **efeito visual** de cada especial
  (grito, planilha-AoE, boleto explosivo) pede arte/partículas.

## Prioridade 4 — fundos das fases intermediárias

- **Fundos high-res das Fases 3/4/5** (`bg-tecnologia`/`bg-diretoria` + a 5ª) — hoje
  são skylines chapados competentes, mas destoam dos 2 pintados ricos
  (`bg-openspace`/`bg-atendimento`). Pipeline de upload: LAB SPRITES → FUNDOS.

## Prioridade 5 — arte de attack incoerente (do lote do Lovable)

- Vários inimigos (`analista`, `scrum`, `coordenador`, `estagiario`, `scrum-boss`,
  `coord-boss`) receberam frames `attack2/3` gerados por IA que são **um personagem
  diferente** da base (musculoso/chicote/ícone de som). O jogo cicla só os 2 frames
  coerentes de propósito. Para animar o attack completo, precisa de **arte de attack
  coerente** — não adianta mais frames de IA mismatched. Ver `docs/SPRITE_AUDIT.md`.

## Fora do escopo de arte (não são lacunas de verdade)

- **hurt / death** com poucos frames — single-frame/curto é **de propósito** (o hurt é
  um flash, não uma animação). O gate `check:frames` já isenta.
- **Itens** (café, post-it, VR…) — loops curtos de 3–4 frames por design.
