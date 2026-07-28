# Prompts de arte — o que pedir ao Gemini (e como validar depois)

> Gerado a partir do estado real do atlas: dimensões, paleta e contagem de frames
> saíram da varredura, não de estimativa. Ordem = `bun art:queue`.

## Antes de gerar: leia isto

Esta sessão inteira foi gasta consertando dano de sprite gerado por IA — troca de
personagem no meio da animação (#124), inchaço de paleta em 402 frames (#127),
in-betweens que compraram defeito em vez de suavidade. **Gerar mais frames de IA
sem disciplina reintroduz exatamente esses problemas.** As restrições abaixo não
são decoração: cada uma corresponde a um defeito que já aconteceu neste projeto.

**Depois de importar QUALQUER frame novo, rode e leia:**

```bash
node scripts/pack-atlas.mjs
bun run check:frames      # contagem, coerência, TAMANHO de canvas
bun run audit:sprites     # vazio / chapado / faltando
bun run audit:palette     # cor estrangeira = arte de outro personagem
bun audit:anim            # jerk / loop-pop / dead / padded
bun palette:fix           # se ratio de cor vier alto (assinatura de IA)
```

O gate que mais importa aqui é o **`audit:palette`**: ele existe justamente para
pegar "frame de outro personagem". E confira com o olho no **LAB SPRITES** — o
defeito de troca de personagem passou por TODOS os gates automáticos e só apareceu
ampliando os frames um a um.

---

## Restrições que valem para TODOS os prompts

Cole este bloco junto de qualquer pedido:

```
ESTILO: pixel art de 16-bit, estilo Dead Cells / Katana Zero. Vista LATERAL
(side-scroller 2D), personagem de corpo inteiro, virado para a DIREITA.

REGRAS TÉCNICAS (obrigatórias):
- SEM anti-aliasing. Bordas duras, pixel cheio ou transparente — nada de halo
  semi-transparente na silhueta.
- Paleta LIMITADA às cores listadas abaixo. No máximo ~30 cores no total.
- Sombra em RAMPAS de 3–4 degraus por matiz, nunca gradiente contínuo.
- Fundo 100% transparente.
- Grade de pixel consistente: 1 pixel de arte = 1 pixel da imagem. Não desenhe
  grande e reduza depois.
- O personagem deve ocupar a MESMA altura e ficar na MESMA linha de chão em
  todos os frames. Os pés não podem flutuar nem mudar de escala entre frames.
- Mantenha EXATAMENTE o mesmo personagem em todos os frames: mesmo rosto, mesma
  roupa, mesmos acessórios, mesma silhueta. Sem variação de identidade.
```

---

## 1. Facilitador de Workshop — `walk` (prioridade 3.224, Fase 1)

**Arquivos:** `public/assets/sprites/enemy-facilitador-walk0.png` … `walk7.png`
**Canvas:** 48×64 px · **8 frames** · anexe `ref-facilitador.png`

**Personagem:** homem adulto, cabelo escuro bagunçado, óculos, camisa social
branca de manga curta, gravata escura frouxa, calça escura. Segura uma FOLHA DE
PAPEL branca na mão direita, à frente do corpo. Expressão irritada/estressada.

**Paleta:**
`#161a21 #0a0c10 #000000 #3c2a22 #4c3c34 #664838 #7c5c44 #946c54 #a88460 #c49c7c #e4c4a8 #262c36 #3a424e #525c69`

```
Gere um ciclo de CAMINHADA lateral de 8 frames deste personagem, em spritesheet
horizontal de 8 quadros, cada quadro 48x64 px.

O ciclo precisa FECHAR: o frame 8 tem que encadear no frame 1 sem salto.
Poses: 1 contato, 2 baixo, 3 passagem, 4 alto, 5 contato (pernas trocadas),
6 baixo, 7 passagem, 8 alto.

A folha de papel acompanha o balanço do braço. Sem exagero de "corrida" — é uma
caminhada apressada de escritório.
```

---

## 2. Facilitador — `idle` (prioridade 2.579, Fase 1) ⚠ ATENÇÃO

**Canvas:** 48×64 px · **hoje tem 12 frames, mas só os 5 primeiros prestam**

> Verificado ampliando frame a frame: **os frames 5–11 são OUTRA PESSOA** — maior,
> sem óculos, roupa diferente, com artefatos de caixa branca. É o mesmo defeito
> que o #124 consertou no `attack`, e o `idle` CICLA (aparece o tempo todo).
> Se você gerar só 4–6 frames bons, eu corto os ruins e o problema some.

**Personagem e paleta:** iguais ao item 1.

```
Gere uma animação de RESPIRAÇÃO (idle) lateral de 6 frames, spritesheet
horizontal, cada quadro 48x64 px.

Movimento MÍNIMO: o peito sobe e desce, os ombros acompanham, a folha de papel
oscila levemente. Os PÉS NÃO SAEM DO LUGAR. Não é uma caminhada no lugar.
O ciclo precisa fechar (frame 6 encadeia no frame 1).
```

---

## 3. Analista de Onboarding — `idle` (prioridade 2.579, Fase 1)

**Canvas:** 48×64 px · **6 frames** · anexe `ref-analista.png`

**Personagem:** homem adulto, cabelo escuro cacheado, óculos redondos, camisa
social branca, gravata escura, calça escura. Carrega uma PASTA/MALETA marrom na
mão esquerda, junto ao corpo.

**Paleta:**
`#161a21 #000000 #3c2a22 #0a0c10 #4c3c34 #664838 #262c36 #7c5c44 #a88460 #946c54 #c49c7c #3a424e #525c69 #e4c4a8`

```
Gere uma animação de RESPIRAÇÃO (idle) lateral de 6 frames, spritesheet
horizontal, cada quadro 48x64 px.

Movimento MÍNIMO: peito subindo e descendo, leve balanço da maleta. Pés fixos no
chão. O ciclo precisa fechar.
```

---

## 4. Estagiário Desesperado — `idle` (prioridade 2.579, Fase 1)

**Canvas:** 48×64 px · **6 frames** · anexe `ref-estagiario.png`

**Personagem:** homem jovem, cabelo escuro cacheado, óculos, camisa branca de
manga curta, gravata, calça escura. Maleta marrom na mão. Postura mais curvada e
cansada que a do Analista.

**Paleta:**
`#161a21 #0a0c10 #000000 #3c2a22 #4c3c34 #262c36 #7c5c44 #664838 #a88460 #946c54 #3a424e #c49c7c #525c69 #6e7a8a`

```
Gere uma animação de RESPIRAÇÃO (idle) lateral de 6 frames, spritesheet
horizontal, cada quadro 48x64 px.

Movimento MÍNIMO e CANSADO: respiração pesada, ombros caídos que sobem e descem
devagar. Pés fixos. O ciclo precisa fechar.
```

---

## 5. Suporte de TI — `walk` (prioridade 2.132, Fase 4)

**Canvas:** 64×64 px · **8 frames** · anexe `ref-ti-suporte.png`

**Personagem:** homem robusto, bigode farto, cabelo escuro, jaqueta/colete escuro
sobre camisa clara, calça escura. Carrega um EQUIPAMENTO/CAIXA de informática
com as duas mãos à frente do corpo.

**Paleta:**
`#161a21 #0a0c10 #000000 #262c36 #3c2a22 #4c3c34 #3a424e #664838 #a88460 #946c54 #525c69 #7c5c44 #949eac #6e7a8a`

```
Gere um ciclo de CAMINHADA lateral de 8 frames, spritesheet horizontal, cada
quadro 64x64 px.

Andar PESADO (o sujeito é corpulento e carrega peso): passada curta, corpo
balançando mais na vertical. O equipamento nas mãos se mantém estável enquanto o
corpo sobe e desce. O ciclo precisa fechar.
```

---

## 6. Evangelista Corporativo — `idle` (prioridade 1.706, Fase 3) ⚠ ATENÇÃO

**Canvas:** 64×64 px · **hoje 11 frames, com frame 4 quebrado e frame 5 em
miniatura** · anexe `ref-evangelista.png`

**Personagem:** homem de meia-idade, calvo no topo com cabelo dos lados, camisa
clara, colete/jaqueta escura. Segura um MEGAFONE erguido, apontado para a frente.

**Paleta:**
`#000000 #3c2a22 #4c3c34 #161a21 #664838 #7c5c44 #a88460 #0a0c10 #946c54 #525c69 #262c36`

```
Gere uma animação de RESPIRAÇÃO (idle) lateral de 6 frames, spritesheet
horizontal, cada quadro 64x64 px.

O megafone fica ERGUIDO e estável; o corpo respira embaixo dele. Movimento
mínimo. Pés fixos no chão, mesma altura em todos os frames. O ciclo precisa fechar.
```

---

## Como me devolver

Salve cada spritesheet como PNG e me diga o caminho. Eu faço o recorte em frames
individuais (`scripts/slice-sheet.mjs`), padronizo o canvas, rodo os gates acima e
te mostro o antes/depois medido — cor por pixel, alinhamento dos pés e o
`audit:anim` do ciclo novo.

Se preferir o caminho de dentro do jogo: **LAB SPRITES → subir PNG no frame**
aceita um arquivo por frame, com validação de dimensão no cliente e no servidor.
