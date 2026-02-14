-- ⚠️ SKIP enabling RLS as it is already enabled by Supabase
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public access to 'media' bucket
create policy "Media Bucket Public Access"
on storage.objects for select
using ( bucket_id = 'media' );

-- Allow public uploads to 'media' bucket (for scraper)
create policy "Media Bucket Public Upload"
on storage.objects for insert
with check ( bucket_id = 'media' );
