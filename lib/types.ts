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
  // Relazione Notarile Definitiva (RND): secondo documento, opzionale. Null per le
  // pratiche generate prima dell'introduzione della funzione (nessuna regressione).
  relazione_path: string | null;
  nome_file_relazione: string | null;
  // Sistematizzazione verso il golden della banca (Feature B). Null per le pratiche
  // generate prima della funzione (nessuna regressione).
  sistematizzazione_applicata: boolean | null;
  sistematizzazione_integrita_ok: boolean | null;
  sistematizzazione_diff_path: string | null;
  coverage: number | null;
  report: Record<string, unknown> | null;
  created_at: string;
  nome_banca: string | null;
  nome_cliente: string | null;
}

export const BUCKET_DOCUMENTI = "documenti";
export const BUCKET_ATTI = "atti";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// MIME corretto in base all'estensione del file dell'atto.
export function mimePerFile(nome: string): string {
  return nome.toLowerCase().endsWith(".docx") ? DOCX_MIME : "application/msword";
}
