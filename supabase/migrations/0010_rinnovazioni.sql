-- Modulo Rinnovazioni ipotecarie: estende la tabella pratiche per ospitare anche le
-- rinnovazioni, accanto a mutui e traduzioni. Aggiunta puramente additiva: nessuna
-- colonna/policy esistente viene toccata, la RLS della tabella copre già la riga.
--
-- Riuso intenzionale:
--   - stato:   'in_estrazione' (job in corso) -> 'completata' (XML pronto)
--              / 'dati_mancanti' (semaforo rosso, manca un dato) / 'errore'.
--   - semaforo: verde/giallo/rosso dal controllo qualità (stessi valori del CHECK).
--   - output:  l'XML SAPES vive in atto_path/nome_file_atto (bucket "atti"), così
--              download e retention funzionano senza modifiche.
--
-- Differenza dalle traduzioni: la rinnovazione ha PIÙ documenti in ingresso
-- (1 perimetro Word + 1 nota PDF + N visure PDF). input_path resta il documento
-- principale (il perimetro, per il titolo nello storico); input_paths li elenca
-- tutti, così il cron di retention può cancellarli tutti (non solo il primo).

-- Estende il CHECK di tipo_pratica per includere 'rinnovazione'. Il vincolo creato
-- inline dalla 0006 si chiama, per convenzione PostgreSQL, pratiche_tipo_pratica_check.
alter table public.pratiche drop constraint if exists pratiche_tipo_pratica_check;
alter table public.pratiche add constraint pratiche_tipo_pratica_check
  check (tipo_pratica in ('mutuo', 'traduzione', 'rinnovazione'));

-- Tutti i documenti in ingresso di una pratica multi-file (bucket "documenti"),
-- per la retention. Null per mutui/traduzioni (un solo input).
alter table public.pratiche add column if not exists input_paths text[];
