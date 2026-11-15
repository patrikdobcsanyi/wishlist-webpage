-- Run once in the SQL Editor of a new Supabase project.
begin;

-- This table is also the family allowlist. Only the administrator adds members.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80)
);

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  url text check (url is null or (char_length(url) <= 2000 and url ~ '^https?://')),
  image_url text check (image_url is null or (char_length(image_url) <= 2000 and image_url ~ '^https://')),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create table public.claims (
  wish_id uuid primary key references public.wishes(id) on delete cascade,
  claimant_id uuid not null default auth.uid() references public.profiles(id) on delete cascade
);

-- Definer avoids recursive profile policies. No caller-supplied identity.
create function public.is_family_member() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles where id = auth.uid()); $$;
revoke all on function public.is_family_member() from public;
grant execute on function public.is_family_member() to authenticated;

alter table public.profiles enable row level security;
alter table public.wishes enable row level security;
alter table public.claims enable row level security;

revoke all on public.profiles, public.wishes, public.claims from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, delete on public.wishes to authenticated;
grant insert (title, url, notes, image_url) on public.wishes to authenticated;
grant update (title, url, notes, image_url) on public.wishes to authenticated;
grant select, delete on public.claims to authenticated;
grant insert (wish_id) on public.claims to authenticated;

create policy "Family can read profiles" on public.profiles for select to authenticated
using (public.is_family_member());
create policy "Family can read wishes" on public.wishes for select to authenticated
using (public.is_family_member());
create policy "Members add own wishes" on public.wishes for insert to authenticated
with check (public.is_family_member() and owner_id = auth.uid());
create policy "Members edit own wishes" on public.wishes for update to authenticated
using (public.is_family_member() and owner_id = auth.uid())
with check (public.is_family_member() and owner_id = auth.uid());
create policy "Members delete own wishes" on public.wishes for delete to authenticated
using (public.is_family_member() and owner_id = auth.uid());

create policy "Claims hidden from recipient" on public.claims for select to authenticated
using (public.is_family_member() and exists (
  select 1 from public.wishes where id = wish_id and owner_id <> auth.uid()
));
create policy "Members claim others wishes" on public.claims for insert to authenticated
with check (public.is_family_member() and claimant_id = auth.uid() and exists (
  select 1 from public.wishes where id = wish_id and owner_id <> auth.uid()
));
create policy "Members release own claims" on public.claims for delete to authenticated
using (public.is_family_member() and claimant_id = auth.uid());

commit;
