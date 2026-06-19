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
  | "durata";

export interface CampoMancante {
  chiave: string; // es. "tasso_interesse"
  etichetta: string; // es. "Tasso di interesse (%)"
  tipo: TipoCampo;
  obbligatorio: boolean;
  hint?: string; // spiegazione del perché manca
}

export type Semaforo = "verde" | "giallo" | "rosso";

export interface RisultatoEstrazione {
  campiMancanti: CampoMancante[];
  bancaRiconosciuta: boolean;
  semaforoPreliminare: Semaforo;
  nomeBanca: string | null;
  nomeCliente: string | null;
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

function backendUrl(): string | null {
  const u = process.env.BACKEND_URL;
  return u && u.trim() ? u.replace(/\/$/, "") : null;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const base = backendUrl()!;
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.BACKEND_API_KEY
        ? { Authorization: `Bearer ${process.env.BACKEND_API_KEY}` }
        : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Backend ${path} ha risposto ${res.status}`);
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
// Modulo Traduzioni — endpoint SINCRONO: POST elabora e restituisce il risultato.
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
