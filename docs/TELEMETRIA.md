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

## Como consultar o histórico

Não apague as linhas antigas — filtre. Esta CTE separa sessão humana de robô:

```sql
with sessoes as (
  select session_id,
         extract(epoch from (max(created_at) - min(created_at))) as dur_s,
         count(distinct scene) as cenas,
         bool_or(type = 'boss_defeat') as venceu_boss
  from playtest_events
  group by session_id
),
humanas as (
  -- Robô: muitas cenas em poucos segundos. Humano: joga por mais tempo.
  select session_id from sessoes
  where not (dur_s < 60 and cenas >= 8)
)
select e.*
from playtest_events e
join humanas h using (session_id);
```

Para dados a partir de 27/07/2026 o filtro é desnecessário — a automação já não
escreve. Mantê-lo não atrapalha.

## Perguntas que valem a pena

1. **Onde as runs morrem?** (`deathsByScene`) Concentração na Fase 1 = problema
   de onboarding; nas fases finais = balanceamento.
2. **Quanto dura uma run?** Calibra `MS_PER_GAME_MIN` do Expediente — hoje em
   3000 (1 min de jogo a cada 3s reais), escolhido por estimativa. Se as runs
   reais forem longas, todo mundo entra em hora extra e o prazo brando vira
   penalidade constante em vez de decisão.
3. **Alguém usa dash / especial / parry?** (`avgVerbsPerRun`) Se der ~0, o
   combate colapsou em "andar e bater" e isso supera qualquer item de arte.
