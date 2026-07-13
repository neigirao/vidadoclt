-- Bucket público para OVERRIDES de fundo de fase, subidos pelo LAB DE SPRITES
-- durante a fase de teste. O jogo carrega o fundo daqui se existir override,
-- senão usa o asset embutido (public/assets/bg-*.png). Persiste na nuvem sem
-- precisar de backend de gravação em arquivo (o build publicado é estático).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bg-overrides', 'bg-overrides', true, 8388608, array['image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = 8388608,
      allowed_mime_types = array['image/png'];

-- Leitura pública: qualquer visitante do jogo baixa o fundo.
drop policy if exists "bg_overrides_public_read" on storage.objects;
create policy "bg_overrides_public_read" on storage.objects
  for select using (bucket_id = 'bg-overrides');

-- Escrita anônima (FASE DE TESTE): qualquer tester sobe/atualiza a arte via LAB.
-- Endurecer (exigir auth) quando sair do teste.
drop policy if exists "bg_overrides_anon_insert" on storage.objects;
create policy "bg_overrides_anon_insert" on storage.objects
  for insert with check (bucket_id = 'bg-overrides');

drop policy if exists "bg_overrides_anon_update" on storage.objects;
create policy "bg_overrides_anon_update" on storage.objects
  for update using (bucket_id = 'bg-overrides');
