-- Relazione Notarile Definitiva (RND): secondo documento generato insieme all'atto.
-- Aggiunta puramente additiva: nessuna colonna/policy esistente viene toccata, RLS
-- della tabella pratiche copre già la riga. Il file RND vive nel bucket "atti"
-- (stesso pattern path {user_id}/{pratica_id}/...), quindi nessuna nuova policy storage.

alter table public.pratiche add column if not exists relazione_path text;
alter table public.pratiche add column if not exists nome_file_relazione text;
