"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import {
  avviaTraduzione as backendTraduci,
  statoTraduzione as backendStato,
  type FormatoTraduzione,
} from "@/lib/backend";
import { BUCKET_ATTI, BUCKET_DOCUMENTI, mimePerFile } from "@/lib/types";
import { logAudit, ipCorrente } from "@/lib/audit";

const MAX_FILE = 50 * 1024 * 1024; // 50 MB (le scansioni possono essere grandi)
const FORMATI: FormatoTraduzione[] = [
  "solo_trascrizione",
  "solo_traduzione",
  "originale_traduzione",
  "bilingue",
  "mirror",
];

// Stato dell'azione di avvio. La traduzione gira in background sul backend: l'avvio
// restituisce un jobId su cui il client fa polling, oppure (path mock senza backend)
// direttamente il link di download.
export interface AvviaState {
  error?: string;
  jobId?: string;
  praticaId?: string;
  // Completamento immediato (path mock, senza BACKEND_URL).
  downloadUrl?: string;
  semaforo?: string;
}

// Esito della finalizzazione, richiamata dal client al termine del polling.
export interface FinalizzaResult {
  error?: string;
  pending?: boolean; // job ancora in corso (il client continua il polling)
  downloadUrl?: string;
  semaforo?: string;
  report?: Record<string, unknown>;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function oggiISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function semaforoDaReport(report: Record<string, unknown>): string {
  const qualita = (report.qualita ?? {}) as Record<string, unknown>;
  return ["verde", "giallo", "rosso"].includes(qualita.semaforo as string)
    ? (qualita.semaforo as string)
    : "giallo";
}

// Avvia una traduzione: carica il file, prepara glossario/memoria, chiama il backend
// (che mette in coda un job) e registra subito la pratica in stato "in elaborazione".
// Ritorna { jobId, praticaId } per il polling lato client. Tutto in pochi secondi.
export async function avviaTraduzione(
  _prev: AvviaState,
  formData: FormData
): Promise<AvviaState> {
  if (!supabaseConfigured()) {
    return { error: "Supabase non configurato. Contatta l'amministratore." };
  }

  const file = formData.get("documento");
  const linguaDestino = String(formData.get("lingua_destino") ?? "").trim();
  const linguaOrigineRaw = String(formData.get("lingua_origine") ?? "").trim();
  const linguaOrigine = linguaOrigineRaw || null; // "" => auto-rileva
  const formato = String(formData.get("formato") ?? "") as FormatoTraduzione;

  if (!(file instanceof File) || file.size === 0)
    return { error: "Carica un documento da tradurre." };
  if (file.size > MAX_FILE) return { error: "Il file non può superare i 50 MB." };
  if (!FORMATI.includes(formato)) return { error: "Scegli il formato del risultato." };
  // La lingua di arrivo non serve per la sola trascrizione.
  if (formato !== "solo_trascrizione" && !linguaDestino)
    return { error: "Scegli la lingua di arrivo." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const praticaId = crypto.randomUUID();
  const inputPath = `${user.id}/${praticaId}/input-${sanitize(file.name)}`;

  const up = await supabase.storage
    .from(BUCKET_DOCUMENTI)
    .upload(inputPath, file, { contentType: file.type || undefined, upsert: false });
  if (up.error) return { error: `Upload del documento fallito: ${up.error.message}` };

  const signed = await supabase.storage
    .from(BUCKET_DOCUMENTI)
    .createSignedUrl(inputPath, 900);
  if (!signed.data?.signedUrl)
    return { error: "Impossibile preparare il documento per l'elaborazione." };

  // Glossario (best-effort) + memoria di traduzione per la coppia di lingue.
  const { data: glossarioRows } = await supabase
    .from("glossario")
    .select("termine_origine,termine_destino")
    .eq("lingua_destino", linguaDestino)
    .limit(500);
  const glossario = (glossarioRows ?? []).map((r) => ({
    origine: r.termine_origine as string,
    destino: r.termine_destino as string,
  }));

  let memoria: { hash_origine?: string; testo_origine?: string; testo_destino: string }[] = [];
  if (linguaOrigine && formato !== "solo_trascrizione") {
    const { data: memRows } = await supabase
      .from("traduzione_memoria")
      .select("hash_origine,testo_origine,testo_destino")
      .eq("user_id", user.id)
      .eq("lingua_origine", linguaOrigine)
      .eq("lingua_destino", linguaDestino)
      .limit(1000);
    memoria = (memRows ?? []) as typeof memoria;
  }

  // Avvio del job sul backend.
  let esito;
  try {
    esito = await backendTraduci({
      praticaId,
      fileUrl: signed.data.signedUrl,
      nomeFileOriginale: file.name,
      linguaDestino: linguaDestino || "it",
      linguaOrigine,
      formato,
      glossario,
      memoria,
    });
  } catch (e) {
    await registraErrore(supabase, praticaId, user, linguaOrigine, linguaDestino, formato, inputPath, file.name);
    return {
      error: `Avvio traduzione fallito: ${e instanceof Error ? e.message : "errore sconosciuto"}`,
    };
  }

  if (esito.stato === "errore") {
    await registraErrore(supabase, praticaId, user, linguaOrigine, linguaDestino, formato, inputPath, file.name);
    return { error: esito.errore ?? "Avvio non riuscito." };
  }

  // Path mock (nessun BACKEND_URL): il risultato è già pronto → finalizza inline.
  if (esito.stato === "completato" && esito.docBase64) {
    const fin = await salvaEsito(
      supabase, user, praticaId, linguaOrigine, linguaDestino, formato, inputPath, file.name, esito,
    );
    return fin.error ? { error: fin.error } : { downloadUrl: fin.downloadUrl, semaforo: fin.semaforo };
  }

  // Path normale: job in background. Registra la pratica in elaborazione e
  // restituisce il jobId per il polling.
  const insert = await supabase.from("pratiche").insert({
    id: praticaId,
    user_id: user.id,
    notaio: "—",
    data_stipula: oggiISO(),
    stato: "in_estrazione", // in elaborazione (riusa lo stato di pratica in lavorazione)
    tipo_pratica: "traduzione",
    lingua_origine: linguaOrigine,
    lingua_destino: linguaDestino || null,
    formato_traduzione: formato,
    input_path: inputPath,
    nome_file_input: file.name,
    job_id: esito.jobId,
  });
  if (insert.error) return { error: `Registrazione pratica fallita: ${insert.error.message}` };

  return { jobId: esito.jobId, praticaId };
}

// Finalizza una traduzione: interroga lo stato del job e, se completato, salva il
// .docx, aggiorna la pratica, registra la memoria e ritorna il link di download.
// Richiamata dal client al termine del polling (stato "completato"/"errore").
export async function finalizzaTraduzione(
  praticaId: string,
  jobId: string
): Promise<FinalizzaResult> {
  if (!supabaseConfigured()) {
    return { error: "Supabase non configurato. Contatta l'amministratore." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let stato;
  try {
    stato = await backendStato(jobId);
  } catch (e) {
    return { error: `Lettura stato fallita: ${e instanceof Error ? e.message : "errore sconosciuto"}` };
  }

  if (stato.stato === "errore") {
    await supabase
      .from("pratiche")
      .update({ stato: "errore" })
      .eq("id", praticaId)
      .eq("user_id", user.id);
    return { error: stato.errore ?? "Elaborazione non riuscita." };
  }

  if (stato.stato !== "completato" || !stato.docBase64) {
    // Ancora in lavorazione: il client continua il polling.
    return { pending: true };
  }

  // Recupera i dati della pratica per la coppia di lingue (memoria).
  const { data: pratica } = await supabase
    .from("pratiche")
    .select("lingua_origine,lingua_destino")
    .eq("id", praticaId)
    .eq("user_id", user.id)
    .single<{ lingua_origine: string | null; lingua_destino: string | null }>();

  const report = (stato.report ?? {}) as Record<string, unknown>;
  const codiceOrigine = (report.lingua_origine as string) ?? pratica?.lingua_origine ?? null;
  const linguaDestino = (report.lingua_destino as string) ?? pratica?.lingua_destino ?? null;
  const semaforo = semaforoDaReport(report);

  const nomeFile = stato.nomeFile ?? `traduzione_${praticaId}.docx`;
  const attoPath = `${user.id}/${praticaId}/output-${sanitize(nomeFile)}`;
  const bytes = Buffer.from(stato.docBase64, "base64");
  const upOut = await supabase.storage
    .from(BUCKET_ATTI)
    .upload(attoPath, bytes, { contentType: mimePerFile(nomeFile), upsert: true });
  if (upOut.error) return { error: `Salvataggio output fallito: ${upOut.error.message}` };

  const update = await supabase
    .from("pratiche")
    .update({
      stato: "completata",
      semaforo,
      lingua_origine: codiceOrigine,
      lingua_destino: linguaDestino,
      atto_path: attoPath,
      nome_file_atto: nomeFile,
      report,
    })
    .eq("id", praticaId)
    .eq("user_id", user.id);
  if (update.error) return { error: `Salvataggio pratica fallito: ${update.error.message}` };

  // Memoria di traduzione: salva le voci nuove (idempotente via indice unico).
  const nuove = stato.memoriaNuova ?? [];
  if (nuove.length && codiceOrigine && linguaDestino) {
    const righe = nuove.map((v) => ({
      user_id: user.id,
      lingua_origine: codiceOrigine,
      lingua_destino: linguaDestino,
      hash_origine: v.hash_origine,
      testo_origine: v.testo_origine,
      testo_destino: v.testo_destino,
    }));
    await supabase.from("traduzione_memoria").upsert(righe, {
      onConflict: "user_id,lingua_origine,lingua_destino,hash_origine",
      ignoreDuplicates: true,
    });
  }

  await logAudit({
    azione: "upload_traduzione",
    userId: user.id,
    email: user.email,
    praticaId,
    ip: await ipCorrente(),
    dettagli: { linguaOrigine: codiceOrigine, linguaDestino, semaforo },
  });

  revalidatePath("/storico");
  return { downloadUrl: `/api/pratica/${praticaId}/download`, semaforo, report };
}

// Salvataggio dell'esito quando il documento è già disponibile (path mock).
// Inserisce la pratica completata in un colpo solo.
async function salvaEsito(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string },
  praticaId: string,
  linguaOrigine: string | null,
  linguaDestino: string,
  formato: FormatoTraduzione,
  inputPath: string,
  nomeFileInput: string,
  esito: { docBase64?: string | null; nomeFile?: string | null; report?: Record<string, unknown> | null },
): Promise<{ error?: string; downloadUrl?: string; semaforo?: string }> {
  const report = (esito.report ?? {}) as Record<string, unknown>;
  const semaforo = semaforoDaReport(report);
  const codiceOrigine = (report.lingua_origine as string) ?? linguaOrigine;

  const nomeFile = esito.nomeFile ?? `traduzione_${praticaId}.docx`;
  const attoPath = `${user.id}/${praticaId}/output-${sanitize(nomeFile)}`;
  const bytes = Buffer.from(esito.docBase64 ?? "", "base64");
  const upOut = await supabase.storage
    .from(BUCKET_ATTI)
    .upload(attoPath, bytes, { contentType: mimePerFile(nomeFile), upsert: true });
  if (upOut.error) return { error: `Salvataggio output fallito: ${upOut.error.message}` };

  const insert = await supabase.from("pratiche").insert({
    id: praticaId,
    user_id: user.id,
    notaio: "—",
    data_stipula: oggiISO(),
    stato: "completata",
    semaforo,
    tipo_pratica: "traduzione",
    lingua_origine: codiceOrigine,
    lingua_destino: linguaDestino || codiceOrigine,
    formato_traduzione: formato,
    input_path: inputPath,
    nome_file_input: nomeFileInput,
    atto_path: attoPath,
    nome_file_atto: nomeFile,
    report,
  });
  if (insert.error) return { error: `Salvataggio pratica fallito: ${insert.error.message}` };

  revalidatePath("/storico");
  return { downloadUrl: `/api/pratica/${praticaId}/download`, semaforo };
}

async function registraErrore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  praticaId: string,
  user: { id: string },
  linguaOrigine: string | null,
  linguaDestino: string,
  formato: FormatoTraduzione,
  inputPath: string,
  nomeFile: string
): Promise<void> {
  await supabase.from("pratiche").insert({
    id: praticaId,
    user_id: user.id,
    notaio: "—",
    data_stipula: oggiISO(),
    stato: "errore",
    tipo_pratica: "traduzione",
    lingua_origine: linguaOrigine,
    lingua_destino: linguaDestino || null,
    formato_traduzione: formato,
    input_path: inputPath,
    nome_file_input: nomeFile,
  });
}
