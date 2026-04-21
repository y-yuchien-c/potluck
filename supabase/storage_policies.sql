-- Run this AFTER creating the "cooking-photos" bucket in the Supabase dashboard.
-- Storage → New bucket → Name: cooking-photos → toggle Public ON → Save

create policy "authenticated users can upload photos"
  on storage.objects for insert
  with check (bucket_id = 'cooking-photos' and auth.role() = 'authenticated');

create policy "cooking photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'cooking-photos');

create policy "users can delete own photos"
  on storage.objects for delete
  using (bucket_id = 'cooking-photos' and auth.uid()::text = (storage.foldername(name))[1]);
