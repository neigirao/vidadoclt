-- Telemetria de playtest: um evento de game design por linha (progressão,
-- mortes, economia, desfecho). Sem PII — só id de sessão aleatório + payload.
CREATE TABLE public.playtest_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  session_id text NOT NULL,
  type text NOT NULL,
  scene text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.playtest_events ENABLE ROW LEVEL SECURITY;

-- Qualquer cliente (anon) pode INSERIR eventos — é o jogo publicado gravando.
CREATE POLICY "playtest_events_insert_public" ON public.playtest_events
  FOR INSERT WITH CHECK (true);

-- Sem policy de SELECT para anon: leitura fica restrita ao dashboard / service
-- role (privacidade — jogadores não leem os dados uns dos outros).

CREATE INDEX playtest_events_created_idx ON public.playtest_events (created_at DESC);
CREATE INDEX playtest_events_type_idx ON public.playtest_events (type);
CREATE INDEX playtest_events_session_idx ON public.playtest_events (session_id);
