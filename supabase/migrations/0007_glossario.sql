-- Glossario notarile editabile per il modulo Traduzioni.
-- Sostituisce i glossari cablati nel codice: le voci vivono qui e vengono passate
-- al backend nel payload della richiesta. user_id NULL = voce condivisa di studio
-- (gestita dagli admin via service role); user_id valorizzato = voce personale.

create table if not exists public.glossario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,  -- NULL = condivisa
  lingua_origine text not null,
  lingua_destino text not null,
  termine_origine text not null,
  termine_destino text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists glossario_coppia_idx
  on public.glossario (lingua_origine, lingua_destino);

alter table public.glossario enable row level security;

-- Lettura: ogni utente vede le proprie voci + quelle condivise (user_id NULL).
drop policy if exists "glossario_select" on public.glossario;
create policy "glossario_select" on public.glossario
  for select using (user_id is null or auth.uid() = user_id);

-- Scrittura delle proprie voci. Le voci condivise (user_id NULL) si gestiscono
-- via service role (admin), che bypassa la RLS.
drop policy if exists "glossario_insert_own" on public.glossario;
create policy "glossario_insert_own" on public.glossario
  for insert with check (auth.uid() = user_id);

drop policy if exists "glossario_update_own" on public.glossario;
create policy "glossario_update_own" on public.glossario
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "glossario_delete_own" on public.glossario;
create policy "glossario_delete_own" on public.glossario
  for delete using (auth.uid() = user_id);
