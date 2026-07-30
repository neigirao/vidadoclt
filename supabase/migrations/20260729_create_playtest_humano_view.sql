-- View `playtest_humano`: eventos de playtest com a AUTOMAÇÃO removida.
--
-- POR QUE EXISTE: o filtro de bot que circulava em docs/TELEMETRIA.md era
-- `dur_s < 60 and cenas >= 8`, e ele VAZAVA. Uma sessão do `bun smoke` boota 6
-- fases em 38s: menos de 8 cenas distintas, então passava pelo filtro como se
-- fosse humana. Medido: 343 das 552 sessões do banco são automação, e elas
-- respondem por 97% de TODOS os `phase_enter`. As contagens de exposição por
-- fase que saíam dali (62/46/41/41/41) alimentavam o PESO_FASE do
-- `bun art:queue` — ou seja, a fila de arte priorizava com números inflados.
--
-- A ASSINATURA CERTA É CADÊNCIA, NÃO CONTAGEM. Um humano leva minutos por fase;
-- a automação entra numa fase a cada ~930ms. `dur / phase_enter < 3s` separa os
-- dois sem depender de quantas cenas o script resolveu visitar — que muda a cada
-- vez que alguém edita o smoke, e foi exatamente o que quebrou o filtro anterior.
--
-- NÃO substitui o guard de `navigator.webdriver` em Telemetry.sendRemote (#120),
-- que impede a escrita na origem e funciona: nenhuma sessão de automação foi
-- gravada depois de 27/07/2026. Esta view é para o HISTÓRICO anterior a isso,
-- que não dá para rotular retroativamente e não deve ser apagado.
--
-- Também exclui sessões de TESTAR FASE (`payload ? 'testPhase'`): pular direto
-- para uma fase é playtest dirigido, não jogador atravessando o funil.

-- `security_invoker = on` é OBRIGATÓRIO aqui: `playtest_events` tem RLS ligado e
-- NÃO tem policy de SELECT para anon (leitura só do dashboard/service role, por
-- privacidade). Sem isto a view roda como o dono e vira um bypass de RLS —
-- qualquer cliente anon leria a telemetria inteira pela view.
create or replace view public.playtest_humano
with (security_invoker = on) as
with sessoes as (
  select
    session_id,
    count(*) filter (where type = 'phase_enter') as phase_enters,
    extract(epoch from (max(created_at) - min(created_at))) as dur_s,
    bool_or(payload ? 'testPhase') as testar_fase
  from public.playtest_events
  group by session_id
),
humanas as (
  select session_id
  from sessoes
  where not (phase_enters > 3 and dur_s / nullif(phase_enters, 0) < 3)
    and not testar_fase
)
select e.*
from public.playtest_events e
join humanas h using (session_id);

comment on view public.playtest_humano is
  'playtest_events sem automação. Bot = >3 phase_enter com cadência <3s entre eles (o smoke faz ~930ms); também exclui sessões TESTAR FASE. Ver docs/TELEMETRIA.md.';
