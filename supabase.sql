-- Run this once in Supabase SQL Editor.
create table if not exists public.lectures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_path text,
  file_name text,
  source_type text not null check (source_type in ('recording','upload')),
  transcript text,
  created_at timestamptz not null default now()
);

alter table public.lectures enable row level security;
drop policy if exists "Users can read own lectures" on public.lectures;
drop policy if exists "Users can insert own lectures" on public.lectures;
drop policy if exists "Users can update own lectures" on public.lectures;
drop policy if exists "Users can delete own lectures" on public.lectures;
create policy "Users can read own lectures" on public.lectures for select using (auth.uid() = user_id);
create policy "Users can insert own lectures" on public.lectures for insert with check (auth.uid() = user_id);
create policy "Users can update own lectures" on public.lectures for update using (auth.uid() = user_id);
create policy "Users can delete own lectures" on public.lectures for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('lectures', 'lectures', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload own lecture files" on storage.objects;
drop policy if exists "Users can read own lecture files" on storage.objects;
drop policy if exists "Users can delete own lecture files" on storage.objects;
create policy "Users can upload own lecture files" on storage.objects for insert to authenticated
with check (bucket_id = 'lectures' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can read own lecture files" on storage.objects for select to authenticated
using (bucket_id = 'lectures' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete own lecture files" on storage.objects for delete to authenticated
using (bucket_id = 'lectures' and (storage.foldername(name))[1] = auth.uid()::text);
