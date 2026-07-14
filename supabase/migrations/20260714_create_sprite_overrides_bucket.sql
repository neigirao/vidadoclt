-- Bucket público para OVERRIDES de FRAME de sprite, refeitos pela IA (Gemini) via
-- o LAB DE SPRITES ONLINE. O jogo aplica o frame daqui POR CIMA do atlas se houver
-- override (SpriteOverrides.ts), senão usa o frame embutido do atlas. Persiste na
-- nuvem sem backend de gravação em arquivo (o build publicado é estático) — é o que
-- permite "aprovar e ver em produção na hora".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sprite-overrides', 'sprite-overrides', true, 2097152, array['image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/png'];

-- Leitura pública: qualquer jogador baixa o frame refeito.
drop policy if exists "sprite_overrides_public_read" on storage.objects;
create policy "sprite_overrides_public_read" on storage.objects
  for select using (bucket_id = 'sprite-overrides');

-- Escrita anônima (FASE DE TESTE): qualquer tester aprova/atualiza o frame via LAB.
-- Endurecer (exigir auth) quando sair do teste.
drop policy if exists "sprite_overrides_anon_insert" on storage.objects;
create policy "sprite_overrides_anon_insert" on storage.objects
  for insert with check (bucket_id = 'sprite-overrides');

drop policy if exists "sprite_overrides_anon_update" on storage.objects;
create policy "sprite_overrides_anon_update" on storage.objects
  for update using (bucket_id = 'sprite-overrides');
