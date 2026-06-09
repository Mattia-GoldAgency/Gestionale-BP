-- Impostazioni base dell'applicazione (key-value). Lettura per utenti
-- autenticati; scrittura solo via service_role (Server Action admin).

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "settings_read_auth" on public.app_settings;
create policy "settings_read_auth" on public.app_settings
  for select using (auth.role() = 'authenticated');

-- Valori iniziali.
insert into public.app_settings (key, value) values
  ('nome_studio', '"Studio Notarile Busani & Partners"'::jsonb),
  ('retention_giorni', '15'::jsonb)
on conflict (key) do nothing;
