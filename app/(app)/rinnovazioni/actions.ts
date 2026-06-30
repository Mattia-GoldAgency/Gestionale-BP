"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import {
  avviaRinnovazione as backendAvvia,
  statoRinnovazione as backendStato,
  type InputRinnovazione,
} from "@/lib/backend";
import { BUCKET_ATTI, BUCKET_DOCUMENTI, mimePerFile } from "@/lib/types";
import { logAudit, ipCorrente } from "@/lib/audit";

const MAX_FILE = 50 * 1024 * 1024; // 50 MB per file (le scansioni possono essere grandi)
const MAX_VISURE = 40; // tetto di sicurezza sul numero di visure

// Stato dell'azione di avvio. La rinnovazione gira in background sul backend:
// l'avvio restituisce un jobId su cui il client fa polling, oppure (path mock
// senza backend) direttamente l'esito con il link di download.
export interface AvviaState {
  error?: string;
  jobId?: string;
  praticaId?: string;
  // Completamento immediato (path mock, senza BACKEND_URL).
  downloadUrl?: string;
  nomeFile?: string;
  semaforo?: string;
  report?: Record<string, unknown>;
  bloccante?: string;
}

// Esito della finalizzazione, richiamata dal client al termine del polling.
export interface FinalizzaResult {
  error?: string; // fallimento grave (job in errore / salvataggio fallito)
  pending?: boolean; // job ancora in corso (il client continua il polling)
  downloadUrl?: string;
  nomeFile?: string;
  semaforo?: string;
  report?: Record<string, unknown>;
  // Semaforo rosso: job completato ma SENZA XML (manca un dato bloccante). Non è
  // un errore di sistema né un pending: è un esito da mostrare con il motivo.
  bloccante?: string;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

// Nome del file XML scaricato (scelta operativa 2026-06-30): derivato dal nome
// originale del perimetro caricato → "rinnovazione-<nome perimetro>.xml", così è
// riconoscibile dall'operatore. Toglie l'estensione e sanifica per filesystem/header.
function nomeXmlDaPerimetro(nomePerimetro: string | null | undefined, fallback: string): string {
  if (!nomePerimetro) return fallback;
  const stem = nomePerimetro.replace(/\.[^.\\/]+$/, ""); // via l'estensione
  const pulito = stem
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.-]+|[_.-]+$/g, "")
    .slice(0, 80);
  return pulito ? `rinnovazione-${pulito}.xml` : fallback;
}

function oggiISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function str(formData: FormData, k: string): string | null {
  const v = String(formData.get(k) ?? "").trim();
  return v || null;
}

function parseAgevolazioni(raw: FormDataEntryValue[]): string[] {
  // Checkbox multiple name="agevolazioni": tiene i codici numerici selezionati.
  const codici = raw.map((v) => String(v).trim()).filter((v) => /^\d+$/.test(v));
  return codici.length ? codici : ["8", "9"];
}

function semaforoDaReport(report: Record<string, unknown>): string {
  const qualita = (report.qualita ?? {}) as Record<string, unknown>;
  return ["verde", "giallo", "rosso"].includes(qualita.semaforo as string)
    ? (qualita.semaforo as string)
    : "giallo";
}

// Carica un file su "documenti" e ne restituisce path + URL firmato (900s).
async function caricaFirma(
  supabase: Awaited<ReturnType<typeof createClient>>,
  basePath: string,
  prefisso: string,
  file: File
): Promise<{ path: string; url: string } | { error: string }> {
  const path = `${basePath}/${prefisso}-${sanitize(file.name)}`;
  const up = await supabase.storage
    .from(BUCKET_DOCUMENTI)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (up.error) return { error: `Upload di ${file.name} fallito: ${up.error.message}` };
  const signed = await supabase.storage.from(BUCKET_DOCUMENTI).createSignedUrl(path, 900);
  if (!signed.data?.signedUrl)
    return { error: `Impossibile preparare ${file.name} per l'elaborazione.` };
  return { path, url: signed.data.signedUrl };
}

// Avvia una rinnovazione: carica perimetro + nota + N visure, chiama il backend
// (che mette in coda un job) e registra la pratica in stato "in elaborazione".
// Ritorna { jobId, praticaId } per il polling lato client.
export async function avviaRinnovazione(
  _prev: AvviaState,
  formData: FormData
): Promise<AvviaState> {
  if (!supabaseConfigured()) {
    return { error: "Supabase non configurato. Contatta l'amministratore." };
  }

  const perimetro = formData.get("perimetro");
  const nota = formData.get("nota");
  const visure = formData.getAll("visure").filter((v): v is File => v instanceof File && v.size > 0);

  if (!(perimetro instanceof File) || perimetro.size === 0)
    return { error: "Carica il perimetro ipotecario (documento Word del Team Visure)." };
  if (!(nota instanceof File) || nota.size === 0)
    return { error: "Carica la nota di iscrizione originaria (PDF)." };
  if (perimetro.size > MAX_FILE || nota.size > MAX_FILE || visure.some((v) => v.size > MAX_FILE))
    return { error: "Ogni file non può superare i 50 MB." };
  if (visure.length > MAX_VISURE)
    return { error: `Troppe visure: massimo ${MAX_VISURE} file per volta.` };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const praticaId = crypto.randomUUID();
  const basePath = `${user.id}/${praticaId}`;

  // Upload di tutti i documenti su "documenti".
  const perim = await caricaFirma(supabase, basePath, "perimetro", perimetro);
  if ("error" in perim) return { error: perim.error };
  const notaUp = await caricaFirma(supabase, basePath, "nota", nota);
  if ("error" in notaUp) return { error: notaUp.error };

  const visureUrls: string[] = [];
  const nomiVisure: string[] = [];
  const visurePaths: string[] = [];
  for (let i = 0; i < visure.length; i++) {
    const v = await caricaFirma(supabase, basePath, `visura-${i + 1}`, visure[i]);
    if ("error" in v) return { error: v.error };
    visureUrls.push(v.url);
    nomiVisure.push(visure[i].name);
    visurePaths.push(v.path);
  }

  const inputPaths = [perim.path, notaUp.path, ...visurePaths];

  const input: InputRinnovazione = {
    praticaId,
    perimetroUrl: perim.url,
    nomePerimetro: perimetro.name,
    notaUrl: notaUp.url,
    nomeNota: nota.name,
    visureUrls,
    nomiVisure,
    denominazioneRichiedente: str(formData, "denominazione_richiedente"),
    cfRichiedente: str(formData, "cf_richiedente"),
    indirizzoRichiedente: str(formData, "indirizzo_richiedente"),
    agevolazioni: parseAgevolazioni(formData.getAll("agevolazioni")),
  };

  // Avvio del job sul backend.
  let esito;
  try {
    esito = await backendAvvia(input);
  } catch (e) {
    await registraErrore(supabase, praticaId, user, perim.path, perimetro.name, inputPaths);
    return {
      error: `Avvio rinnovazione fallito: ${e instanceof Error ? e.message : "errore sconosciuto"}`,
    };
  }

  if (esito.stato === "errore") {
    await registraErrore(supabase, praticaId, user, perim.path, perimetro.name, inputPaths);
    return { error: esito.errore ?? "Avvio non riuscito." };
  }

  // Path mock (nessun BACKEND_URL): l'esito è già pronto → finalizza inline.
  if (esito.stato === "completato") {
    const fin = await salvaEsito(
      supabase, user, praticaId, perim.path, perimetro.name, inputPaths, esito
    );
    if (fin.error) return { error: fin.error };
    return { downloadUrl: fin.downloadUrl, nomeFile: fin.nomeFile, semaforo: fin.semaforo, report: fin.report, bloccante: fin.bloccante };
  }

  // Path normale: job in background. Registra la pratica in elaborazione.
  const insert = await supabase.from("pratiche").insert({
    id: praticaId,
    user_id: user.id,
    notaio: "—",
    data_stipula: oggiISO(),
    stato: "in_estrazione", // in elaborazione (riusa lo stato di pratica in lavorazione)
    tipo_pratica: "rinnovazione",
    input_path: perim.path,
    nome_file_input: perimetro.name,
    input_paths: inputPaths,
    job_id: esito.jobId,
  });
  if (insert.error) return { error: `Registrazione pratica fallita: ${insert.error.message}` };

  return { jobId: esito.jobId, praticaId };
}

// Finalizza una rinnovazione: interroga lo stato del job e, se completato con XML,
// salva l'XML, aggiorna la pratica e ritorna il link di download. Se completato
// SENZA XML (semaforo rosso) ritorna il motivo del blocco. Se ancora in corso,
// segnala pending (il client continua il polling).
export async function finalizzaRinnovazione(
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

  // Job ancora in corso: il client continua il polling.
  if (stato.stato === "in_corso") return { pending: true };

  // Job fallito (errore di sistema / file illeggibile).
  if (stato.stato === "errore") {
    await supabase
      .from("pratiche")
      .update({ stato: "errore" })
      .eq("id", praticaId)
      .eq("user_id", user.id);
    return { error: stato.errore ?? "Elaborazione non riuscita." };
  }

  const report = (stato.report ?? {}) as Record<string, unknown>;
  const semaforo = stato.semaforo ?? semaforoDaReport(report);

  // Completato SENZA XML = semaforo rosso (manca un dato bloccante). Esito terminale.
  if (!stato.xmlBase64) {
    await supabase
      .from("pratiche")
      .update({ stato: "dati_mancanti", semaforo: "rosso", report })
      .eq("id", praticaId)
      .eq("user_id", user.id);
    return { semaforo: "rosso", report, bloccante: stato.errore ?? "Dato obbligatorio mancante." };
  }

  // Completato con XML: salva l'output e aggiorna la pratica. Il nome del file è
  // derivato dal nome originale del perimetro (salvato come nome_file_input all'avvio).
  const { data: praticaRow } = await supabase
    .from("pratiche")
    .select("nome_file_input")
    .eq("id", praticaId)
    .eq("user_id", user.id)
    .single<{ nome_file_input: string | null }>();
  const nomeFile = nomeXmlDaPerimetro(
    praticaRow?.nome_file_input,
    stato.nomeFile ?? `rinnovazione-${praticaId.slice(0, 8)}.xml`
  );
  const attoPath = `${user.id}/${praticaId}/output-${sanitize(nomeFile)}`;
  const bytes = Buffer.from(stato.xmlBase64, "base64");
  const upOut = await supabase.storage
    .from(BUCKET_ATTI)
    .upload(attoPath, bytes, { contentType: mimePerFile(nomeFile), upsert: true });
  if (upOut.error) return { error: `Salvataggio output fallito: ${upOut.error.message}` };

  const update = await supabase
    .from("pratiche")
    .update({
      stato: "completata",
      semaforo,
      atto_path: attoPath,
      nome_file_atto: nomeFile,
      report,
    })
    .eq("id", praticaId)
    .eq("user_id", user.id);
  if (update.error) return { error: `Salvataggio pratica fallito: ${update.error.message}` };

  await logAudit({
    azione: "upload_rinnovazione",
    userId: user.id,
    email: user.email,
    praticaId,
    ip: await ipCorrente(),
    dettagli: { semaforo, n_immobili: report.n_immobili ?? null },
  });

  revalidatePath("/storico");
  return { downloadUrl: `/api/pratica/${praticaId}/download`, nomeFile, semaforo, report };
}

// Salvataggio dell'esito quando l'XML è già disponibile (path mock, senza backend).
// Inserisce la pratica in un colpo solo; gestisce anche il caso "rosso" (no XML).
async function salvaEsito(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string },
  praticaId: string,
  inputPath: string,
  nomeFileInput: string,
  inputPaths: string[],
  esito: {
    xmlBase64?: string | null;
    nomeFile?: string | null;
    semaforo?: string | null;
    report?: Record<string, unknown> | null;
    errore?: string | null;
  }
): Promise<FinalizzaResult> {
  const report = (esito.report ?? {}) as Record<string, unknown>;
  const semaforo = esito.semaforo ?? semaforoDaReport(report);

  // Esito rosso (nessun XML): registra la pratica come dati mancanti, niente output.
  if (!esito.xmlBase64) {
    const ins = await supabase.from("pratiche").insert({
      id: praticaId,
      user_id: user.id,
      notaio: "—",
      data_stipula: oggiISO(),
      stato: "dati_mancanti",
      semaforo: "rosso",
      tipo_pratica: "rinnovazione",
      input_path: inputPath,
      nome_file_input: nomeFileInput,
      input_paths: inputPaths,
      report,
    });
    if (ins.error) return { error: `Salvataggio pratica fallito: ${ins.error.message}` };
    return { semaforo: "rosso", report, bloccante: esito.errore ?? "Dato obbligatorio mancante." };
  }

  const nomeFile = nomeXmlDaPerimetro(
    nomeFileInput,
    esito.nomeFile ?? `rinnovazione-${praticaId.slice(0, 8)}.xml`
  );
  const attoPath = `${user.id}/${praticaId}/output-${sanitize(nomeFile)}`;
  const bytes = Buffer.from(esito.xmlBase64, "base64");
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
    tipo_pratica: "rinnovazione",
    input_path: inputPath,
    nome_file_input: nomeFileInput,
    input_paths: inputPaths,
    atto_path: attoPath,
    nome_file_atto: nomeFile,
    report,
  });
  if (insert.error) return { error: `Salvataggio pratica fallito: ${insert.error.message}` };

  revalidatePath("/storico");
  return { downloadUrl: `/api/pratica/${praticaId}/download`, nomeFile, semaforo, report };
}

async function registraErrore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  praticaId: string,
  user: { id: string },
  inputPath: string,
  nomeFile: string,
  inputPaths: string[]
): Promise<void> {
  await supabase.from("pratiche").insert({
    id: praticaId,
    user_id: user.id,
    notaio: "—",
    data_stipula: oggiISO(),
    stato: "errore",
    tipo_pratica: "rinnovazione",
    input_path: inputPath,
    nome_file_input: nomeFile,
    input_paths: inputPaths,
  });
}
