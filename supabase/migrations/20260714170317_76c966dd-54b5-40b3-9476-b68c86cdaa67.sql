drop policy if exists "sprite_overrides_public_read" on storage.objects;
create policy "sprite_overrides_public_read" on storage.objects
  for select using (bucket_id = 'sprite-overrides');

drop policy if exists "sprite_overrides_anon_insert" on storage.objects;
create policy "sprite_overrides_anon_insert" on storage.objects
  for insert with check (bucket_id = 'sprite-overrides');

drop policy if exists "sprite_overrides_anon_update" on storage.objects;
create policy "sprite_overrides_anon_update" on storage.objects
  for update using (bucket_id = 'sprite-overrides');