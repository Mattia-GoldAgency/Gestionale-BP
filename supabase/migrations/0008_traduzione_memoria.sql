-- Memoria di traduzione (translation memory) per il modulo Traduzioni.
-- Riusa i segmenti già tradotti su atti simili: meno costo e maggiore coerenza.
-- Il match è esatto sul testo (con marker) normalizzato, via hash_origine.
--
-- ATTENZIONE PRIVACY: testo_origine/testo_destino possono contenere frammenti di
-- atti (dati personali). RLS per user_id (nessuna condivisione cross-utente) e mai
-- nei log. La memoria è volutamente persistente (è il suo valore) e quindi può
-- eccedere i 15 giorni di retention dei file: la politica di conservazione/
-- anonimizzazione va validata col DPO (vedi piano modulo Traduzioni).

create table if not exists public.traduzione_memoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lingua_origine text not null,
  lingua_destino text not null,
  hash_origine text not null,
  testo_origine text not null,
  testo_destino text not null,
  created_at timestamptz not null default now()
);

-- Lookup veloce per coppia di lingue + hash; unicità per evitare duplicati.
create unique index if not exists tm_lookup_uniq
  on public.traduzione_memoria (user_id, lingua_origine, lingua_destino, hash_origine);

alter table public.traduzione_memoria enable row level security;

drop policy if exists "tm_select_own" on public.traduzione_memoria;
create policy "tm_select_own" on public.traduzione_memoria
  for select using (auth.uid() = user_id);

drop policy if exists "tm_insert_own" on public.traduzione_memoria;
create policy "tm_insert_own" on public.traduzione_memoria
  for insert with check (auth.uid() = user_id);

drop policy if exists "tm_update_own" on public.traduzione_memoria;
create policy "tm_update_own" on public.traduzione_memoria
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tm_delete_own" on public.traduzione_memoria;
create policy "tm_delete_own" on public.traduzione_memoria
  for delete using (auth.uid() = user_id);
