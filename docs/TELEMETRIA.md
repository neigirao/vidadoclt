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

A CTE que ficava aqui classificava como robô quem fizesse `dur_s < 60 AND cenas

> = 8`. **Uma sessão do `bun smoke` boota 6 fases em 38s\*\*: menos de 8 cenas
> distintas, então passava pelo filtro como se fosse humana.

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
