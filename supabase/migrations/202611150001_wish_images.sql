-- Existing projects: run this in the Supabase SQL Editor, not schema.sql again.
begin;
alter table public.wishes add column if not exists image_url text
  check (image_url is null or (char_length(image_url) <= 2000 and image_url ~ '^https://'));
grant insert (image_url), update (image_url) on public.wishes to authenticated;
commit;
