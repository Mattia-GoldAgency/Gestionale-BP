import type { CampoMancante, Semaforo } from "./backend";

export type StatoPratica =
  | "in_estrazione"
  | "dati_mancanti"
  | "completata"
  | "errore";

// Tipo di pratica: i mutui e (dal modulo Traduzioni) le traduzioni condividono la
// stessa tabella e lo stesso storico. Dal modulo Rinnovazioni anche le rinnovazioni
// ipotecarie (output = XML SAPES, salvato come "atto").
export type TipoPratica = "mutuo" | "traduzione" | "rinnovazione";

export type FormatoTraduzione =
  | "solo_trascrizione"
  | "solo_traduzione"
  | "originale_traduzione"
  | "bilingue"
  | "mirror";

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
  // Modulo Traduzioni (null/'mutuo' per le pratiche di mutuo: nessuna regressione).
  tipo_pratica: TipoPratica;
  lingua_origine: string | null;
  lingua_destino: string | null;
  formato_traduzione: FormatoTraduzione | null;
  job_id: string | null;
  input_path: string | null;
  nome_file_input: string | null;
  // Modulo Rinnovazioni: una pratica ha PIÙ input (perimetro + nota + N visure).
  // input_paths li elenca tutti (bucket "documenti") per la retention; input_path
  // resta il documento principale (il perimetro) per il titolo nello storico.
  // Null per mutui/traduzioni (un solo input): nessuna regressione.
  input_paths: string[] | null;
}

export interface VoceGlossario {
  id: string;
  user_id: string | null;
  lingua_origine: string;
  lingua_destino: string;
  termine_origine: string;
  termine_destino: string;
  note: string | null;
  created_at: string;
}

export const BUCKET_DOCUMENTI = "documenti";
export const BUCKET_ATTI = "atti";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// MIME corretto in base all'estensione del file dell'atto. Gli atti di mutuo e le
// traduzioni sono Word (.docx/.doc); le rinnovazioni sono XML SAPES (.xml).
export function mimePerFile(nome: string): string {
  const n = nome.toLowerCase();
  if (n.endsWith(".xml")) return "application/xml";
  if (n.endsWith(".docx")) return DOCX_MIME;
  return "application/msword";
}
