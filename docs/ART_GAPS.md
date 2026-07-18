# Lacunas de ARTE — o que precisa de arte nova (não de código)

> Lista de compras de arte. O que dá pra resolver por **código/interpolação** já está
> coberto pelo pipeline de frames (`bun run fill:frames`). Isto aqui é o que **exige
> arte desenhada ou geração de imagem** — nenhuma linha de código resolve.
>
> Como este arquivo se mantém honesto: rode `bun run fill:frames --dry` para separar
> o que é interpolável (some daqui sozinho) do que precisa de arte; e o
> `runFullAudit()` no LAB SPRITES para achar frames incoerentes/mismatched.

## Prioridade 1 — o clímax está fraco

- **Fundo do CEO (cobertura)** — por confissão do próprio projeto, o pior fundo do
  jogo, no encontro mais importante. Skyline chapado onde devia ter peso. É o maior
  retorno visual de um único asset.
- **Buildup de entrada do CEO** — o CEO chega "frio". Falta uma tela/beat de entrada
  (a parte de *código* dá pra fazer; o *visual* do beat pede arte).

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
