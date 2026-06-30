import { buildDocxBase64 } from "./docx";

// Contratto di integrazione tra il frontend (Vercel) e il motore Python
// on-premise (atto_core). Questo modulo è l'UNICO punto di accoppiamento:
// l'agente che sviluppa il backend deve esporre due endpoint conformi a questi
// tipi. Finché BACKEND_URL non è configurato, si usa un mock deterministico
// per poter provare l'intero flusso UI (incl. la schermata "dati mancanti").

export type TipoCampo =
  | "tasso"
  | "importo"
  | "data"
  | "numero"
  | "testo"
  | "durata"
  | "scelta"; // es. regime patrimoniale (sezioni "a cura del notaio")

export interface CampoMancante {
  chiave: string; // es. "tasso_interesse"
  etichetta: string; // es. "Tasso di interesse (%)"
  tipo: TipoCampo;
  obbligatorio: boolean;
  hint?: string; // spiegazione del perché manca
  opzioni?: string[]; // valori selezionabili quando tipo === "scelta"
}

export type Semaforo = "verde" | "giallo" | "rosso";

export interface RisultatoEstrazione {
  campiMancanti: CampoMancante[];
  bancaRiconosciuta: boolean;
  semaforoPreliminare: Semaforo;
  nomeBanca: string | null;
  nomeCliente: string | null;
}

// Controllo di struttura (stadio 7): l'atto NON è riscritto. ``messaggio`` non
// contiene mai PII; le sezioni sono rubriche del golden (anonimizzate).
export interface SegnalazioneStruttura {
  tipo: string;
  messaggio: string;
  certezza: string; // "certo" (corretto in automatico) | "dubbio" (da rivedere)
}

export interface StrutturaReport {
  correzioni: SegnalazioneStruttura[]; // interventi oggettivi già applicati
  dubbi: SegnalazioneStruttura[]; // i rari casi incerti da mostrare al notaio
  sezioniMancanti: string[]; // sezioni del golden non trovate (subset dei dubbi)
  note?: string | null;
}

export interface RisultatoGenerazione {
  // Documento generato in base64 (il frontend lo salva su storage e lo serve).
  docBase64: string;
  nomeFile: string;
  coverage: number; // 0-100
  semaforo: Semaforo;
  reportValidazione: Record<string, unknown>;
  // Relazione Notarile Definitiva (RND): secondo documento generato insieme
  // all'atto. Opzionali: assenti (undefined) se la RND non viene prodotta.
  relazioneBase64?: string | null;
  nomeFileRelazione?: string | null;
  // Controllo di struttura: l'atto in docBase64 è SEMPRE il deterministico, già
  // ripulito dalle diciture. ``struttura`` riepiloga correzioni e dubbi. Opzionale.
  struttura?: StrutturaReport;
}

export interface InputEstrazione {
  praticaId: string;
  notaio: string;
  dataStipulaISO: string;
  rnpUrl: string;
  minutaUrl: string;
}

export interface InputGenerazione extends InputEstrazione {
  datiForniti: Record<string, string>;
}

// Normalizza un valore letto da process.env: rimuove il BOM (U+FEFF) e gli
// spazi. Una variabile d'ambiente copiata da una sorgente con BOM (es. un file
// salvato come UTF-8-BOM) lasciava il carattere invisibile in testa al valore;
// in BACKEND_URL questo faceva fallire fetch con "Failed to parse URL", in
// BACKEND_API_KEY avrebbe rotto l'header Authorization.
function envClean(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  const v = raw.replace(/[﻿​]/g, "").trim();
  return v ? v : null;
}

function backendUrl(): string | null {
  const u = envClean("BACKEND_URL");
  return u ? u.replace(/\/+$/, "") : null;
}

function backendApiKey(): string | null {
  return envClean("BACKEND_API_KEY");
}

// Costruisce un Error leggibile da una risposta di errore del backend. FastAPI
// serializza gli errori come { "detail": "<messaggio>" }: se presente, lo si
// mostra all'utente (es. "servizio temporaneamente sovraccarico, riprova")
// invece del generico "ha risposto 500".
async function erroreBackend(path: string, res: Response): Promise<Error> {
  let dettaglio = "";
  try {
    const data = await res.json();
    if (data && typeof data.detail === "string") dettaglio = data.detail.trim();
  } catch {
    // corpo non-JSON o vuoto: si ripiega sul codice di stato.
  }
  return new Error(dettaglio || `Backend ${path} ha risposto ${res.status}`);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const base = backendUrl()!;
  const apiKey = backendApiKey();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw await erroreBackend(path, res);
  }
  return (await res.json()) as T;
}

async function getJson<T>(path: string): Promise<T> {
  const base = backendUrl()!;
  const apiKey = backendApiKey();
  const res = await fetch(`${base}${path}`, {
    method: "GET",
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw await erroreBackend(path, res);
  }
  return (await res.json()) as T;
}

// --- Stadio 3+4: estrazione LLM + merge registry -> campi mancanti ---
export async function estraiPratica(
  input: InputEstrazione
): Promise<RisultatoEstrazione> {
  if (!backendUrl()) return mockEstrazione();
  return postJson<RisultatoEstrazione>("/api/estrai", input);
}

// --- Stadio 5+6: assemblaggio DOCX + validazione ---
export async function generaAtto(
  input: InputGenerazione
): Promise<RisultatoGenerazione> {
  if (!backendUrl()) return mockGenerazione(input);
  return postJson<RisultatoGenerazione>("/api/genera", input);
}

export function backendConfigurato(): boolean {
  return backendUrl() !== null;
}

// ---------------------------------------------------------------------------
// Modulo Traduzioni — endpoint ASINCRONO (job + polling).
//   - POST /api/traduci          -> avvia il job, risponde {jobId, stato:"in_corso"}.
//   - GET  /api/traduci/{jobId}   -> stato/progresso; a fine job docBase64 + report.
// L'OCR multipagina + traduzione puo' durare minuti: il lavoro gira in background
// sul backend e il frontend fa polling, senza limiti di durata della richiesta.
// ---------------------------------------------------------------------------
export type FormatoTraduzione =
  | "solo_trascrizione"
  | "solo_traduzione"
  | "originale_traduzione"
  | "bilingue"
  | "mirror";

export interface InputTraduzione {
  praticaId: string;
  fileUrl: string;
  nomeFileOriginale: string;
  linguaDestino: string;
  linguaOrigine?: string | null; // null => auto-rileva
  formato: FormatoTraduzione;
  glossario: { origine: string; destino: string }[];
  memoria: { hash_origine?: string; testo_origine?: string; testo_destino: string }[];
}

export interface StatoTraduzione {
  jobId: string;
  stato: "in_corso" | "completato" | "errore";
  progresso: number;
  fase?: string | null;
  docBase64?: string | null;
  nomeFile?: string | null;
  linguaOrigineRilevata?: string | null;
  report?: Record<string, unknown> | null;
  memoriaNuova?: { hash_origine: string; testo_origine: string; testo_destino: string }[] | null;
  errore?: string | null;
}

export async function avviaTraduzione(input: InputTraduzione): Promise<StatoTraduzione> {
  if (!backendUrl()) return mockTraduzione(input);
  return postJson<StatoTraduzione>("/api/traduci", input);
}

// Polling dello stato di un job di traduzione. A job concluso la risposta porta
// docBase64 + report + memoriaNuova; mentre e' in corso porta progresso/fase.
export async function statoTraduzione(jobId: string): Promise<StatoTraduzione> {
  if (!backendUrl()) {
    // Senza backend non esistono job reali: il flusso mock viene chiuso a monte
    // (avvio sincrono). Qui rispondiamo "completato" inerte per sicurezza.
    return { jobId, stato: "completato", progresso: 100, fase: "Completato" };
  }
  return getJson<StatoTraduzione>(`/api/traduci/${encodeURIComponent(jobId)}`);
}

// ---------------------------------------------------------------------------
// Modulo Rinnovazioni ipotecarie — endpoint ASINCRONO (job + polling), multi-file.
//   - POST /api/rinnovazioni          -> avvia il job, risponde {jobId, stato:"in_corso"}.
//   - GET  /api/rinnovazioni/{jobId}  -> stato/progresso; a fine job xmlBase64 + report.
// Input multi-file: 1 perimetro Word + 1 nota PDF + N visure PDF (URL firmati Supabase),
// più i campi di testata/anagrafica non estraibili dai documenti. Gemello del modulo
// Traduzioni: stesso schema job/polling, output = XML SAPES (re-importabile) anziché .docx.
// ---------------------------------------------------------------------------
export interface InputRinnovazione {
  praticaId: string;
  // Documenti (URL firmati Supabase) + nomi originali (per dedurre l'estensione)
  perimetroUrl: string;
  nomePerimetro?: string | null;
  notaUrl: string;
  nomeNota?: string | null;
  visureUrls: string[];
  nomiVisure: string[];
  // Campi di form (non estraibili dai documenti). Richiedente: sempre presente
  // per le rinnovazioni, ma opzionale lato SAPES. Residenze, progressivi e i flag
  // esente/rinuncia non si chiedono qui (residenze dalla nota; il resto è inerte).
  denominazioneRichiedente?: string | null;
  cfRichiedente?: string | null;
  indirizzoRichiedente?: string | null;
  agevolazioni?: string[];
}

export interface StatoRinnovazione {
  jobId: string;
  stato: "in_corso" | "completato" | "errore";
  progresso: number;
  fase?: string | null;
  xmlBase64?: string | null;
  nomeFile?: string | null;
  semaforo?: string | null; // "verde" | "giallo" | "rosso"
  report?: Record<string, unknown> | null; // conteggi + avvisi (no PII)
  errore?: string | null;
}

export async function avviaRinnovazione(input: InputRinnovazione): Promise<StatoRinnovazione> {
  if (!backendUrl()) return mockRinnovazione(input);
  return postJson<StatoRinnovazione>("/api/rinnovazioni", input);
}

// Polling dello stato di un job di rinnovazione. A job concluso la risposta porta
// xmlBase64 + report; mentre è in corso porta progresso/fase. Attenzione: il
// semaforo "rosso" è un esito completato SENZA xmlBase64 (manca un dato bloccante),
// non un job ancora in corso.
export async function statoRinnovazione(jobId: string): Promise<StatoRinnovazione> {
  if (!backendUrl()) {
    return { jobId, stato: "completato", progresso: 100, fase: "Completato" };
  }
  return getJson<StatoRinnovazione>(`/api/rinnovazioni/${encodeURIComponent(jobId)}`);
}

// ---------------------------------------------------------------------------
// MOCK (solo quando BACKEND_URL non è impostato) — utile per testare la UI.
// ---------------------------------------------------------------------------
function mockEstrazione(): RisultatoEstrazione {
  return {
    bancaRiconosciuta: true,
    semaforoPreliminare: "giallo",
    campiMancanti: [
      {
        chiave: "tasso_interesse",
        etichetta: "Tasso di interesse (%)",
        tipo: "tasso",
        obbligatorio: true,
        hint: "Non rilevato nella minuta né nella RNP.",
      },
      {
        chiave: "durata_mesi",
        etichetta: "Durata del mutuo (mesi)",
        tipo: "durata",
        obbligatorio: true,
        hint: "Dato necessario per il piano di ammortamento.",
      },
    ],
    nomeBanca: "Banca di Credito Cooperativo",
    nomeCliente: "Mario Rossi",
  };
}

async function mockGenerazione(
  input: InputGenerazione
): Promise<RisultatoGenerazione> {
  // Genera un vero .docx (OOXML) come segnaposto.
  const righe = [
    "ATTO DI MUTUO (ANTEPRIMA MOCK)",
    "",
    `Notaio: ${input.notaio}`,
    `Data stipula (ISO): ${input.dataStipulaISO}`,
    "",
    "Dati forniti:",
    ...Object.entries(input.datiForniti).map(([k, v]) => `  - ${k}: ${v}`),
    "",
    "NB: documento di prova generato senza backend (BACKEND_URL non impostato).",
  ];
  return {
    docBase64: await buildDocxBase64(righe),
    nomeFile: `atto_mock_${input.praticaId}.docx`,
    coverage: 0,
    semaforo: "giallo",
    reportValidazione: { mock: true },
  };
}

async function mockTraduzione(input: InputTraduzione): Promise<StatoTraduzione> {
  // Senza backend, restituisce subito un .docx segnaposto.
  const righe = [
    "TRADUZIONE (ANTEPRIMA MOCK)",
    "",
    "Documento di prova generato senza backend (BACKEND_URL non impostato).",
    "Il motore reale produrra' il .docx tradotto nel formato scelto.",
  ];
  return {
    jobId: `mock-${input.praticaId}`,
    stato: "completato",
    progresso: 100,
    fase: "Completato",
    docBase64: await buildDocxBase64(righe),
    nomeFile: "traduzione_mock.docx",
    linguaOrigineRilevata: "inglese",
    report: { qualita: { semaforo: "giallo" }, mock: true },
    memoriaNuova: [],
  };
}

async function mockRinnovazione(input: InputRinnovazione): Promise<StatoRinnovazione> {
  // Senza backend, restituisce subito un XML segnaposto (ISO-8859-1 come SAPES).
  const xml =
    '<?xml version="1.0" encoding="ISO-8859-1"?>\n' +
    "<!-- ANTEPRIMA MOCK: backend non configurato (BACKEND_URL assente). " +
    "Il motore reale produrra' l'XML SAPES re-importabile. -->\n" +
    "<AdempimentoUnico/>";
  return {
    jobId: `mock-${input.praticaId}`,
    stato: "completato",
    progresso: 100,
    fase: "Completato",
    xmlBase64: Buffer.from(xml, "latin1").toString("base64"),
    nomeFile: `rinnovazione-mock-${input.praticaId}.xml`,
    semaforo: "giallo",
    report: {
      n_immobili: 0,
      n_unita: 0,
      n_soggetti: 0,
      n_superfici_iniettate: 0,
      qualita: { semaforo: "giallo", campi_mancanti: 0, avvisi: 1 },
      mock: true,
    },
  };
}
