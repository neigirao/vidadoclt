# Prompts de arte — UMA folha por personagem, todas as ações juntas

> Dimensões, paleta e contagem saíram da varredura do atlas, não de estimativa.
> Ordem de prioridade = `bun art:queue`.

## Por que uma folha só, e não um prompt por ação

Gerar `idle` numa conversa e `walk` em outra **garante deriva de identidade** — o
personagem volta com outro rosto, outra roupa, outro acessório. É exatamente o
defeito que custou os PRs #124 e #132 deste projeto: o Analista perdia a maleta e
os óculos no meio do ciclo, o Facilitador virava um careca sorrindo.

Uma geração única, com todas as ações no mesmo canvas, é o que força o modelo a
manter o mesmo personagem — ele vê as outras poses enquanto desenha.

## Quantos frames pedir (e por que NÃO mais)

Depois do #128 o motor **amostra** as animações one-shot para respeitar um piso de
tempo de tela. Na prática:

| ação   | frames a pedir | por quê                                                  |
| ------ | -------------: | -------------------------------------------------------- |
| idle   |          **6** | cicla o tempo todo; 6 poses já leem como respiração      |
| walk   |          **8** | ciclo clássico: contato, baixo, passagem, alto (×2)      |
| attack |          **6** | a janela do golpe só comporta ~6 (`ATTACK_MIN_FRAME_MS`) |
| hurt   |          **3** | o motor mostra **3**, sempre — o resto é arte invisível  |
| death  |          **6** | janela de 720ms (`DEATH_TARGET_MS`)                      |

**Pedir 17 frames de hurt é desperdício garantido**: medido, o motor exibe 3. O
atlas hoje tem 17 em quase todo personagem, e 14 nunca apareceram na tela.

---

## A folha

Grade de **8 colunas × 5 linhas**, célula de 48×64 px (ou 64×64 — ver cada
personagem). Linhas na ordem: `idle`, `walk`, `attack`, `hurt`, `death`. Células
sobrando na linha ficam **vazias/transparentes**.

```
col:      1      2      3      4      5      6      7      8
idle    [ 1 ]  [ 2 ]  [ 3 ]  [ 4 ]  [ 5 ]  [ 6 ]   ·      ·
walk    [ 1 ]  [ 2 ]  [ 3 ]  [ 4 ]  [ 5 ]  [ 6 ]  [ 7 ]  [ 8 ]
attack  [ 1 ]  [ 2 ]  [ 3 ]  [ 4 ]  [ 5 ]  [ 6 ]   ·      ·
hurt    [ 1 ]  [ 2 ]  [ 3 ]   ·      ·      ·      ·      ·
death   [ 1 ]  [ 2 ]  [ 3 ]  [ 4 ]  [ 5 ]  [ 6 ]   ·      ·
```

Não se preocupe com o tamanho exato da imagem que sair — eu recorto, reescalo e
alinho os pés. O que **precisa** estar certo é a grade uniforme e o personagem
centralizado em cada célula.

---

## 1 · Facilitador de Workshop (Fase 1 — maior prioridade)

📎 anexe `ref-facilitador.png`

```
Pixel art de 16-bit, estilo Dead Cells / Katana Zero. Vista LATERAL
(side-scroller 2D), corpo inteiro, virado para a DIREITA.

PERSONAGEM — idêntico à imagem de referência anexada, em TODOS os quadros:
homem adulto, cabelo escuro bagunçado, ÓCULOS, camisa social branca de manga
curta, gravata escura frouxa, calça escura. Segura uma FOLHA DE PAPEL branca.
Expressão irritada/estressada.

PALETA — use SOMENTE estas cores:
#161a21 #0a0c10 #000000 #3c2a22 #4c3c34 #664838 #7c5c44 #946c54 #a88460
#c49c7c #e4c4a8 #262c36 #3a424e #525c69

TAREFA: uma ÚNICA spritesheet em grade de 8 COLUNAS × 5 LINHAS, células de
tamanho igual, proporção 48:64 (mais alta que larga), personagem centralizado em
cada célula. Células não usadas ficam transparentes.

LINHA 1 — IDLE (6 quadros): respiração. O peito sobe e desce, os ombros
acompanham, a folha oscila de leve. Os PÉS NÃO SAEM DO LUGAR. Ciclo fecha.

LINHA 2 — WALK (8 quadros): caminhada apressada de escritório (não corrida).
Poses: contato, baixo, passagem, alto, contato (pernas trocadas), baixo,
passagem, alto. Ciclo fecha: o quadro 8 encadeia no 1.

LINHA 3 — ATTACK (6 quadros): ele avança e golpeia com a folha/prancheta.
Quadros 1-2 = recuo de antecipação. Quadros 3-4 = o golpe estendido (é o mais
importante, a pose de impacto). Quadros 5-6 = recuperação.

LINHA 4 — HURT (3 quadros): reação a dano. Quadro 1 = impacto, corpo recuando.
Quadro 2 = recuo máximo. Quadro 3 = começando a se recompor.

LINHA 5 — DEATH (6 quadros): ele cambaleia, cai de joelhos e desaba no chão.
O último quadro é o corpo no chão, imóvel.

REGRAS TÉCNICAS (obrigatórias):
- SEM anti-aliasing. Bordas duras: pixel cheio ou transparente. Nada de halo
  semi-transparente na silhueta.
- Máximo ~30 cores no total, só as listadas acima.
- Sombra em RAMPAS de 3-4 degraus por matiz, nunca gradiente contínuo.
- Fundo 100% transparente.
- 1 pixel de arte = 1 pixel da imagem. NÃO desenhe grande e reduza depois.
- MESMA ALTURA e MESMA LINHA DE CHÃO em todas as 5 linhas. O personagem não pode
  encolher, crescer nem flutuar entre ações.
- MESMO PERSONAGEM em todos os 29 quadros: mesmo rosto, mesmos ÓCULOS, mesma
  roupa, mesma folha de papel. Sem variação de identidade.
- NUNCA dois personagens sobrepostos no mesmo quadro.
```

---

## 2 · Analista de Onboarding (Fase 1)

📎 anexe `ref-analista.png` · mesma grade e mesmas regras técnicas

```
PERSONAGEM: homem adulto, cabelo escuro cacheado, ÓCULOS REDONDOS, camisa social
branca, gravata escura, calça escura. Carrega uma PASTA/MALETA marrom na mão
esquerda, junto ao corpo.

PALETA — use SOMENTE estas cores:
#161a21 #000000 #3c2a22 #0a0c10 #4c3c34 #664838 #262c36 #7c5c44 #a88460
#946c54 #c49c7c #3a424e #525c69 #e4c4a8

LINHA 3 — ATTACK: ele arremessa/empurra a prancheta à frente.
LINHA 5 — DEATH: solta a maleta, cai de joelhos, desaba.

A MALETA e os ÓCULOS aparecem em TODOS os quadros (menos os últimos do death,
onde a maleta já caiu no chão ao lado dele).
```

---

## 3 · Estagiário Desesperado (Fase 1)

📎 anexe `ref-estagiario.png` · mesma grade e mesmas regras técnicas

```
PERSONAGEM: homem jovem, cabelo escuro cacheado, ÓCULOS, camisa branca de manga
curta, gravata, calça escura. Maleta marrom na mão. Postura mais curvada e
cansada que a do Analista.

PALETA — use SOMENTE estas cores:
#161a21 #0a0c10 #000000 #3c2a22 #4c3c34 #262c36 #7c5c44 #664838 #a88460
#946c54 #3a424e #c49c7c #525c69 #6e7a8a

LINHA 1 — IDLE: respiração PESADA e cansada, ombros caídos subindo e descendo
devagar.
LINHA 3 — ATTACK: golpe desengonçado, sem técnica — ele está exausto.
LINHA 5 — DEATH: desaba de exaustão, quase um desmaio.
```

---

## 4 · Suporte de TI (Fase 4)

📎 anexe `ref-ti-suporte.png` · grade igual, mas célula **64×64** (quadrada)

```
PERSONAGEM: homem robusto, BIGODE FARTO, cabelo escuro, jaqueta/colete escuro
sobre camisa clara, calça escura. Carrega um EQUIPAMENTO/CAIXA de informática
com as duas mãos à frente do corpo.

PALETA — use SOMENTE estas cores:
#161a21 #0a0c10 #000000 #262c36 #3c2a22 #4c3c34 #3a424e #664838 #a88460
#946c54 #525c69 #7c5c44 #949eac #6e7a8a

LINHA 2 — WALK: andar PESADO (corpulento, carregando peso): passada curta, corpo
balançando mais na vertical. O equipamento fica estável enquanto o corpo sobe e
desce.
LINHA 3 — ATTACK: ele empurra/arremessa o equipamento à frente.

O BIGODE e o EQUIPAMENTO aparecem em TODOS os quadros.
```

---

## 5 · Evangelista Corporativo (Fase 3)

📎 anexe `ref-evangelista.png` · grade igual, célula **64×64**

> Este é o mais quebrado do atlas: hoje o personagem encolhe e cresce entre
> quadros e vários têm dois dele sobrepostos. A folha inteira precisa ser nova.

```
PERSONAGEM: homem de meia-idade, CALVO no topo com cabelo dos lados, camisa
clara, colete/jaqueta escura. Segura um MEGAFONE erguido, apontado para a frente.

PALETA — use SOMENTE estas cores:
#000000 #3c2a22 #4c3c34 #161a21 #664838 #7c5c44 #a88460 #0a0c10 #946c54
#525c69 #262c36

LINHA 1 — IDLE: o megafone fica ERGUIDO e estável; o corpo respira embaixo dele.
LINHA 3 — ATTACK: ele grita no megafone, corpo projetado à frente.

ATENÇÃO REDOBRADA: o personagem tem que ter EXATAMENTE o mesmo tamanho nos 29
quadros, e NUNCA pode haver dois personagens sobrepostos num mesmo quadro.
```

---

## Como me devolver

Manda o PNG (um por personagem) e o caminho. Eu faço:

1. recorte da grade em frames individuais (`scripts/slice-sheet.mjs`)
2. normalização de canvas e alinhamento de pés à linha de chão
3. `palette:fix` se vier com anti-aliasing (limpa a assinatura de IA)
4. `pack-atlas` + os gates: `check:frames`, `audit:sprites`, `audit:palette`,
   `audit:anim`
5. antes/depois medido — cor por pixel, alinhamento e o ciclo novo

**O que os gates NÃO pegam** e eu vou conferir com o olho, ampliado: personagem
trocado entre ações e pés desalinhados. Foram esses dois que passaram por todos os
gates automáticos deste projeto e só apareceram olhando frame a frame.
