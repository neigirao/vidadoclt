CREATE TABLE public.scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  apelido text NOT NULL DEFAULT 'Anonimo',
  reconhecimento integer NOT NULL DEFAULT 0,
  loop_count integer NOT NULL DEFAULT 0,
  reached_phase text NOT NULL DEFAULT 'Fase 1',
  seed text NOT NULL DEFAULT '',
  character_class text,
  created_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT ON public.scores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scores TO authenticated;
GRANT ALL ON public.scores TO service_role;

ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scores_select_public" ON public.scores
  FOR SELECT USING (true);

CREATE POLICY "scores_insert_public" ON public.scores
  FOR INSERT WITH CHECK (true);