import type { CampoMancante, Semaforo } from "./backend";

export type StatoPratica =
  | "in_estrazione"
  | "dati_mancanti"
  | "completata"
  | "errore";

export interface Pratica {
  id: string;
  user_id: string;
  notaio: string;
  data_stipula: string; // ISO YYYY-MM-DD
  stato: StatoPratica;
  semaforo: Semaforo | null;
  banca_riconosciuta: boolean | null;
  rnp_path: string | null;
  minuta_path: string | null;
  campi_mancanti: CampoMancante[] | null;
  dati_forniti: Record<string, string> | null;
  atto_path: string | null;
  nome_file_atto: string | null;
  coverage: number | null;
  report: Record<string, unknown> | null;
  created_at: string;
}

export const BUCKET_DOCUMENTI = "documenti";
export const BUCKET_ATTI = "atti";
