-- Registro di audit permanente (GDPR §7). Accesso SOLO via service_role
-- (Server Action/Route admin): RLS abilitata senza policy => bloccato per
-- anon/authenticated, scrittura e lettura passano dal layer server.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  azione text not null,
  dettagli jsonb,
  pratica_id uuid,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx
  on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;
-- Nessuna policy: l'accesso avviene esclusivamente con la service_role key.
