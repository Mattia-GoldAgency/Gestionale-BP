-- 0006_sistematizzazione.sql — Feature B: sistematizzazione verso il golden banca.
-- Additiva e idempotente (zero rischio sulle pratiche esistenti).
--
-- - sistematizzazione_applicata: l'atto salvato È quello conformato dall'LLM;
-- - sistematizzazione_integrita_ok: esito del gate dati (false = proposta scartata);
-- - sistematizzazione_diff_path: path nel bucket "atti" del diff (NON in chiaro nel
--   DB: il diff contiene testo d'atto → resta come oggetto su storage, RLS per utente).

alter table public.pratiche
  add column if not exists sistematizzazione_applicata boolean,
  add column if not exists sistematizzazione_integrita_ok boolean,
  add column if not exists sistematizzazione_diff_path text;
