-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Matches what the app actually uses: table `recordings` + private bucket `audio`.

create table if not exists public.recordings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text,
  audio_path  text,
  transcript  text,
  summary     text,
  duration    integer,
  created_at  timestamptz default now()
);

alter table public.recordings enable row level security;
drop policy if exists "own rows" on public.recordings;
create policy "own rows" on public.recordings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('audio', 'audio', false)
on conflict (id) do nothing;

drop policy if exists "own audio" on storage.objects;
create policy "own audio" on storage.objects
  for all to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
