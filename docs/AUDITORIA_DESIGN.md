# Auditoria de game design — medida, não opinada

> Cada afirmação aqui sai do `bun sim:balance`, da view `playtest_humano` ou do
> código. Onde eu só tenho palpite, está escrito que é palpite.
>
> Amostra: **26 sessões humanas**, **0 vitórias**, mediana de **77s** por sessão,
> máximo de **6min12s**. É pouco. A FORMA dos achados abaixo é o sinal; os
> valores absolutos, não.

## ⚠ CORREÇÃO — o "degrau de 11,2×" NÃO EXISTIA no jogo

A primeira versão desta auditoria abria dizendo que a dificuldade dava um salto
de **11,2×** entre a Fase 1 e a Fase 2, e recomendava achatá-lo como prioridade 1.
**Estava errado.** O `bun sim:balance` lê o `EnemyCatalog`, e o catálogo tinha
divergido do HP que o jogo realmente instancia — em **24 dos 28 inimigos**, por
fatores de 1,2× a 5,3×:

| inimigo                    | catálogo (lido pelo sim) | classe (usado pelo jogo) |
| -------------------------- | -----------------------: | -----------------------: |
| telemarketer_zumbi (F2)    |                      160 |                   **42** |
| nuvem_board_sentinela (F2) |                      250 |                   **48** |
| reuniao_corporativa (F2)   |                      320 |                   **60** |
| impressora_assombrada (F2) |                      400 |                   **95** |
| arquivo_ambulante (F5)     |                      500 |                  **130** |

Curva REAL, com o catálogo já sincronizado:

| fase | HP (mediana) |  TTK | salto |
| ---- | -----------: | ---: | ----- |
| 1    |           20 | 0,4s | —     |
| 2    |           60 | 1,1s | 3,00× |
| 3    |           75 | 1,4s | 1,25× |
| 4    |           90 | 1,7s | 1,20× |
| 5    |          130 | 2,4s | 1,44× |

**O degrau é 3,0×, não 11,2×** — e o piso da Fase 2 (42 HP) é mais BAIXO que o
teto da Fase 1 (80 HP), ou seja os primeiros inimigos da Fase 2 são mais fracos
que os últimos da Fase 1. A curva real é uma rampa razoável, não um degrau, e as
fases 2–5 não são um platô (1,25× · 1,20× · 1,44×).

Ter agido sobre o número errado teria mexido no balanceamento do jogo para
consertar um problema que só existia na planilha. O gate
`EnemyCatalogSync.test.ts` agora impede a divergência de voltar.

**A queda de 74% no funil da primeira porta continua real** — o que caiu é a
explicação. Não sabemos por que as pessoas param ali; a hipótese "ficou lento
demais" perdeu o suporte que eu achava que tinha.

## Achado 2 — o Expediente, que é a PREMISSA do jogo, nunca foi exercitado

`MS_PER_GAME_MIN = 3000` → 1 minuto de jogo a cada 3 segundos reais.

| marco                               | tempo real necessário |
| ----------------------------------- | --------------------: |
| 18:00 → 20:00 (entra a HORA EXTRA)  |             **6 min** |
| 18:00 → 22:00 (bônus de tempo zera) |            **12 min** |

Contra os dados: mediana de sessão **77s**, recorde **6min12s**. Ou seja, na
mediana o jogador percorre **21%** do caminho até a hora extra, e **nem o recorde
absoluto** cruza as 20h com folga.

**Consequência:** os dois mecanismos do sistema — o agravo de dano da hora extra e
a perda do bônus de tempo — **nunca aconteceram para um jogador humano**. O
`Expediente.ts` + `RunClock.ts` estão corretos e testados, e são conteúdo
inalcançável. O relógio no HUD, que a doc do projeto celebra ter deixado de ser
decoração, voltou a ser decoração — não por bug, mas porque a run acaba antes.

Isto é decisão de dono, não conserto: ou a run precisa durar mais (e aí o Achado 1
é o bloqueio), ou a taxa precisa ser mais rápida para que a mecânica caiba na run
que as pessoas realmente jogam.

## Achado 3 — o PRIMEIRO inimigo do jogo é trivial e letal ao mesmo tempo

`Estagiário Desesperado`, a primeira coisa que qualquer jogador encontra:

- **TTK 0,22s** — o `sim:balance` o flaga como `enemy-trivial` (evapora antes de
  ameaçar);
- **43 DPS de pressão, derruba o player em 2,6s** — o mesmo simulador o flaga como
  `enemy-lethal`.

Os dois flags no mesmo inimigo, e é o inimigo de tutorial. Se você bate, ele
desaparece; se você hesita, ele te mata mais rápido que qualquer trash da Fase 2.
Um novato não consegue calibrar nada contra isso: a lição que ele ensina depende
inteiramente de quem chegou primeiro.

## Achado 4 — o primeiro boss chega logo DEPOIS do degrau

A Fase 1 não tem boss (`getBossName()` devolve "Gerente Microgestor", mas o
`GerenteMicrogestor` **nunca é instanciado** — código morto documentado). O
primeiro chefe real é o Coordenador, na Fase 2.

Então a Fase 2 entrega, na mesma visita: trash 11× mais duro **e** o primeiro
boss da vida do jogador. Dois aprendizados novos empilhados, do outro lado da
porta onde 74% desiste.

## Achado 5 — a meta-progressão está fora de alcance na prática

16 upgrades permanentes, 26 níveis compráveis. O mais barato custa **20** de
Reconhecimento; a árvore inteira, **2.275**.

Uma run mediana (77s, morte na Fase 1) rende algo entre **0 e 5** de
Reconhecimento (a morte converte VR ×0,25). Logo:

- o upgrade **mais barato** exige da ordem de **5 a 20 runs** medianas;
- a árvore inteira, da ordem de **500 runs**.

O gancho do roguelite — "morri, mas levei algo" — existe no código e é
imperceptível na prática. Vale notar que o conserto do #135 (VR→Reconhecimento a
0,5 em cada porta) melhora isto para quem AVANÇA, o que amarra de novo no Achado 1:
a meta-progressão só começa a girar depois da porta onde as pessoas param.

## Achado 6 — há conteúdo de decisão de sobra, e ele não é alcançado

13 Culturas, 24 perks, 15 armas, 16 upgrades. Numa run de 77s o jogador vê **uma**
escolha de Cultura e, com sorte, um perk. O problema do jogo não é falta de
profundidade autorada — é que a profundidade mora depois do degrau.

## O que eu NÃO consigo auditar com este dado

- **Se o combate é bom.** Verbos: dash 0,7/run é real; especial e parry acabaram
  de ganhar medição (#134/#135) e ainda não têm leitura. O `sim:balance` diz que o
  especial vale 16–31% do dano — então ele COMPENSA; se é divertido, só playtest diz.
- **Se as fases 2–5 são interessantes.** N = 1 a 6 por fase. Qualquer afirmação
  sobre elas seria opinião vestida de dado.
- **Se a temática funciona.** Não há instrumento para isso e não invento um.

## Ordem que eu recomendaria (e o motivo de cada posição)

1. ~~Achatar o degrau F1→F2~~ — **RETIRADO**: o degrau era artefato do catálogo
   dessincronizado (ver a correção no topo). A curva real não pede isso.
   O que sobra é a pergunta em aberto: **por que 74% param na primeira porta?**
   O dado diz ONDE, e eu já errei uma vez ao afirmar o PORQUÊ. Precisa de
   playtest, não de mais uma leitura da mesma planilha.
2. **Calibrar o primeiro inimigo.** Trivial-e-letal é a pior combinação possível
   num tutorial, e é um número, não um redesenho.
3. **Decidir o que fazer com o Expediente.** É a premissa do jogo e está
   inalcançável. Escolha de escopo, não bug.
4. **Dar um boss à Fase 1, ou mover o primeiro boss.** Depende do 1 — se o degrau
   sumir, empilhar o boss fica menos grave.
5. **Nada sobre combate ou fases finais até haver leitura nova.** Mexer agora
   seria repetir o erro dos "verbos mortos": decidir por instrumento cego.
