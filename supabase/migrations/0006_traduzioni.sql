-- Modulo Traduzioni: estende la tabella pratiche per ospitare anche le pratiche di
-- traduzione, accanto ai mutui. Aggiunta puramente additiva: nessuna colonna/policy
-- esistente viene toccata, la RLS della tabella copre già la riga.
--
-- Riuso intenzionale:
--   - stato:   'in_estrazione' (job in corso) -> 'completata' / 'errore'
--              (nessuna modifica al CHECK esistente).
--   - semaforo: verde/giallo/rosso dall'anti-omissione (stessi valori del CHECK).
--   - output:  il .docx tradotto vive in atto_path/nome_file_atto (bucket "atti"),
--              così download e retention funzionano senza modifiche.
--   - input:   il file caricato vive in input_path (bucket "documenti").

alter table public.pratiche add column if not exists tipo_pratica text not null
  default 'mutuo' check (tipo_pratica in ('mutuo', 'traduzione'));

alter table public.pratiche add column if not exists lingua_origine text;
alter table public.pratiche add column if not exists lingua_destino text;
alter table public.pratiche add column if not exists formato_traduzione text;
alter table public.pratiche add column if not exists job_id text;
alter table public.pratiche add column if not exists input_path text;
alter table public.pratiche add column if not exists nome_file_input text;
