-- Schema iniziale per "Gestionale Busani & Partners" — Studio Busani & Partners.
-- Esegui nello SQL Editor di Supabase (o via CLI: supabase db push).

-- =========================================================================
-- Tabella PRATICHE
-- =========================================================================
create table if not exists public.pratiche (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  notaio text not null,
  data_stipula date not null,
  stato text not null default 'in_estrazione'
    check (stato in ('in_estrazione', 'dati_mancanti', 'completata', 'errore')),
  semaforo text check (semaforo in ('verde', 'giallo', 'rosso')),
  banca_riconosciuta boolean,
  rnp_path text,
  minuta_path text,
  campi_mancanti jsonb,
  dati_forniti jsonb,
  atto_path text,
  nome_file_atto text,
  coverage numeric,
  report jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pratiche_user_created_idx
  on public.pratiche (user_id, created_at desc);

alter table public.pratiche enable row level security;

-- Ogni utente vede/gestisce solo le proprie pratiche.
drop policy if exists "pratiche_select_own" on public.pratiche;
create policy "pratiche_select_own" on public.pratiche
  for select using (auth.uid() = user_id);

drop policy if exists "pratiche_insert_own" on public.pratiche;
create policy "pratiche_insert_own" on public.pratiche
  for insert with check (auth.uid() = user_id);

drop policy if exists "pratiche_update_own" on public.pratiche;
create policy "pratiche_update_own" on public.pratiche
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "pratiche_delete_own" on public.pratiche;
create policy "pratiche_delete_own" on public.pratiche
  for delete using (auth.uid() = user_id);

-- =========================================================================
-- STORAGE: bucket privati per documenti caricati e atti generati.
-- =========================================================================
insert into storage.buckets (id, name, public)
  values ('documenti', 'documenti', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('atti', 'atti', false)
  on conflict (id) do nothing;

-- I file sono organizzati come {user_id}/{pratica_id}/file.
-- Policy: l'utente accede solo agli oggetti nella propria cartella radice.
drop policy if exists "documenti_own" on storage.objects;
create policy "documenti_own" on storage.objects
  for all
  using (
    bucket_id = 'documenti'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documenti'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "atti_own" on storage.objects;
create policy "atti_own" on storage.objects
  for all
  using (
    bucket_id = 'atti'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'atti'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
