# Telemetria de playtest — como ler sem se enganar

O jogo grava eventos de game design (progressão, mortes, economia, desfecho) num
buffer local e envia para um Supabase dedicado (`playtest_events`). Sem PII: só
um id de sessão aleatório.

## ⚠ O histórico anterior a 27/07/2026 está CONTAMINADO

Os próprios gates de qualidade envenenavam o banco. `bun smoke` boota as **22
cenas** em sequência — inclusive `VitoriaScene`, que dispara
`Telemetry.victory()` — e roda em **cada job de CI** e em cada execução local.
O mesmo vale para `visual`, `validate:levels`, `gallery` e `audit:sprites`.

Medido no banco antes do conserto:

| sinal                                                      | valor         |
| ---------------------------------------------------------- | ------------- |
| sessões totais                                             | 550           |
| sessões que visitam ≥8 cenas em <60s (assinatura do smoke) | **305 (55%)** |
| sessões com mais de 1 minuto                               | **18**        |
| "vitórias" registradas                                     | 486           |
| vitórias com `boss_defeat` correspondente                  | **0**         |

As 486 vitórias eram o `VitoriaScene` sendo bootado direto pelo teste —
**ninguém tinha vencido o jogo**. Uma leitura ingênua daria "48% de win rate" e
levaria a tornar o jogo mais difícil, com ar de evidência.

**Dado envenenado é pior que dado nenhum.**

## O conserto

`Telemetry.sendRemote` não envia quando `navigator.webdriver === true` — o sinal
padrão de automação, que cobre todos os gates de uma vez (todos rodam sob
Playwright). Verificado observando a REDE, não o código: sob Playwright, 0 POSTs;
com o flag mascarado, 1 POST (jogador real segue contando).

## Como consultar o histórico: use a view `playtest_humano`

Não apague as linhas antigas — filtre. **Use a view, não uma CTE colada à mão:**

```sql
select * from playtest_humano;
```

A definição vive versionada em
`supabase/migrations/20260729_create_playtest_humano_view.sql`.

### ⚠ O filtro ANTERIOR desta página vazava — e os números abaixo dele estavam errados

A CTE que ficava aqui classificava como robô quem fizesse
`dur_s < 60 AND cenas >= 8`. **Uma sessão do `bun smoke` boota 6 fases em 38s**:
menos de 8 cenas distintas, então passava pelo filtro como se fosse humana.

Medido: **343 das 552 sessões do banco são automação, e elas respondem por 97%
de todos os `phase_enter`.** Como a tabela de exposição por fase (62/46/41/41/41)
saía desse filtro — contando EVENTOS, não sessões — o `PESO_FASE` do
`bun art:queue` vinha priorizando arte com números inflados por um fator de ~7.

**A assinatura certa é CADÊNCIA, não contagem de cenas.** Um humano leva minutos
por fase; a automação entra numa a cada ~930ms. A view usa
`dur_s / phase_enters < 3`, que não depende de quantas cenas o script resolveu
visitar — e é justamente isso que muda toda vez que alguém edita o smoke, que foi
o que quebrou o filtro anterior. A view também exclui sessões de **TESTAR FASE**
(`payload ? 'testPhase'`): pular direto para uma fase é playtest dirigido, não
jogador atravessando o funil.

### O mesmo engano, duas vezes: a regra tem que ser POSITIVA

A primeira versão da view filtrava **só por cadência** — e cadência não existe
quando não há `phase_enter` nenhum. O `bun smoke` boota `VitoriaScene` e
`GameOverScene` DIRETO, sem passar por fase: cada boot vira uma sessão de ~1s com
exatamente 1 `victory` + 1 `death` e zero verbos. Eram **181 sessões** entrando
como humanas, e a view respondia **"181 vitórias"** quando o número real é
**zero** — ninguém terminou o jogo ainda.

É literalmente o engano que esta página documenta desde o #120, reintroduzido por
um filtro novo. A lição: **descreva o que caracteriza um JOGADOR**, não uma lista
de assinaturas de robô a tapar uma por uma. A regra que sobrou é positiva —
jogador de verdade entra numa fase antes de vencer ou morrer:

```sql
where phase_enters > 0                                   -- entrou numa fase
  and not (phase_enters > 3 and dur_s / phase_enters < 3) -- cadência humana
  and not testar_fase
```

Para dados a partir de 27/07/2026 o filtro é desnecessário — o guard de
`navigator.webdriver` (#120) impede a escrita na origem, e **verificado no banco,
nenhuma sessão de automação foi gravada depois disso**. A view é para o histórico
anterior, que não dá para rotular retroativamente.

## Perguntas que valem a pena

1. **Onde as runs morrem?** (`deathsByScene`) Concentração na Fase 1 = problema
   de onboarding; nas fases finais = balanceamento.
2. **Quanto dura uma run?** Calibra `MS_PER_GAME_MIN` do Expediente — hoje em
   3000 (1 min de jogo a cada 3s reais), escolhido por estimativa. Se as runs
   reais forem longas, todo mundo entra em hora extra e o prazo brando vira
   penalidade constante em vez de decisão.
3. **Alguém usa dash / especial / parry?** (`avgVerbsPerRun`) Se der ~0, o
   combate colapsou em "andar e bater" e isso supera qualquer item de arte.
   **Mas confira o instrumento primeiro** — os zeros de especial e parry eram
   medição faltando, não comportamento (ver a seção de verbos no fim).

## Exposição real por cena

Sessões **distintas** que entram em cada cena — `select scene, count(distinct
session_id) from playtest_humano where type = 'phase_enter' group by scene`:

| cena                | sessões | (o que esta página dizia antes) |
| ------------------- | ------: | ------------------------------: |
| Fase 1 (Open Space) |  **23** |                              62 |
| Copa                |      17 |                              17 |
| Fase 2              |   **6** |                              46 |
| Fase 4              |       2 |                              41 |
| CEO                 |       2 |                               3 |
| Fase 3              |       1 |                              41 |
| Fase 5              |       1 |                              41 |

**O funil é MUITO mais estreito do que se acreditava.** 23 sessões chegam à Fase
1 e 6 à Fase 2 — uma queda de 74% logo na primeira porta, não os 26% que os
números velhos sugeriam. Fases 3–5 e CEO estão em 1–2 sessões.

**Como NÃO ler esta tabela.** Abaixo da Fase 2 o N é 1 ou 2: a ordem entre Fase
3, 4, 5 e CEO é ruído, não sinal — repare que a Fase 4 aparece acima da Fase 3, o
que é impossível num funil linear. Trate tudo dali para baixo como um bloco
único ("a cauda"), nunca como um ranking. O que a tabela sustenta é uma
afirmação só, e ela basta para priorizar arte: **quase todo mundo vê a Fase 1 e
quase ninguém vê o resto.**

Ressalva: a amostra é pequena e os números sobem com tráfego. A **forma** da
curva é o sinal; os valores absolutos, não.

## Desfecho e verbos (26 sessões humanas) — o dado mais desconfortável do projeto

| sinal                        |    valor |
| ---------------------------- | -------: |
| **vitórias**                 |    **0** |
| bosses derrotados            |       18 |
| mortes                       |       18 |
| **quits**                    |   **20** |
| duração mediana da sessão    |  **77s** |
| duração máxima já registrada | 6min 12s |
| dash por run                 |      0,7 |
| especial (K) por run         |    0,0 ⚠ |
| parry por run                |    0,0 ⚠ |

⚠ Os dois zeros de verbo eram **instrumento quebrado** — ver a seção abaixo.

Três leituras, em ordem de importância:

1. **13 dos 20 quits acontecem na COPA.** Dos 17 que chegam à sala segura, 13
   fecham a aba ali — não numa luta, no descanso. É o maior sinal isolado do
   banco: a run não morre de dificuldade, morre de perda de embalo.
2. **Quits (20) superam mortes (18).** As pessoas abandonam mais do que perdem.
   Antes de qualquer ajuste de balanceamento, o problema é de retenção.
3. **Dash em 0,7 por run.** Este número é sólido: o dash é contado no próprio
   dash, em `Player.ts`, que toda fase compartilha.

### ⚠ "Especial = 0" e "parry = 0" eram INSTRUMENTO QUEBRADO, não comportamento

Antes de mexer no combate por causa desses zeros — e a tentação era grande —
valeu conferir se eles estavam sendo medidos. Não estavam:

- **`special`** era contado dentro de `BasePhaseScene.handleSpecial()`. A Fase 1
  tem handler próprio (`onSpecialAttack` inline) e **não chamava**
  `Telemetry.verb("special")`. Como **23 das 26 sessões jogam a Fase 1**, o
  especial praticamente não tinha como ser contado. Corrigido, e travado por
  teste em `PhaseParity.test.ts`.
- **`parry`** só era contado no parry **BEM-SUCEDIDO** (em `takeDamage`). Então
  "parry = 0" misturava duas coisas opostas, que pedem consertos opostos:
  ninguém aperta F (descoberta) ou aperta e erra a janela
  (dificuldade/feedback). Agora existe `parryTry` (tentativa) ao lado de `parry`
  (acerto), e a razão entre os dois responde a pergunta.

**A regra que isso reforça:** antes de tratar um zero como fato de design,
verifique se o caminho de medição existe na fase onde os jogadores realmente
estão. É o terceiro instrumento quebrado deste projeto (as 486 vitórias falsas,
o filtro de bot que vazava, e agora os verbos) e os três tinham a mesma cara:
um número plausível, preciso, e sobre a coisa errada.

A pergunta 3 desta página segue **em aberto** — precisa de uma leitura nova, com
tráfego, depois destas correções.

E ninguém nunca chegou ao fim: o jogo **não tem problema de duração medido**,
porque nenhuma sessão passou de 6 minutos. "Encurtar o jogo" resolveria uma
queixa que os dados ainda não mostram; a queixa que eles mostram é o primeiro
minuto e a Copa.
