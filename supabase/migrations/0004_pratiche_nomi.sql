-- Aggiunge le colonne nome_banca e nome_cliente alla tabella pratiche
ALTER TABLE pratiche
ADD COLUMN nome_banca text,
ADD COLUMN nome_cliente text;
