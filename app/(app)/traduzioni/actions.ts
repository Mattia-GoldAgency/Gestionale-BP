"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import {
  avviaTraduzione as backendAvvia,
  statoTraduzione as backendStato,
  type FormatoTraduzione,
} from "@/lib/backend";
import { BUCKET_ATTI, BUCKET_DOCUMENTI, mimePerFile } from "@/lib/types";
import { logAudit, ipCorrente } from "@/lib/audit";

const MAX_FILE = 50 * 1024 * 1024; // 50 MB (le scansioni possono essere grandi)
const FORMATI: FormatoTraduzione[] = [
  "solo_traduzione",
  "originale_traduzione",
  "bilingue",
  "mirror",
];

export interface AvviaState {
  error?: string;
  praticaId?: string;
  jobId?: string;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function oggiISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Avvia una traduzione: carica il file, chiama il backend (job async) e crea la
// riga pratica. Ritorna praticaId+jobId al client, che poi fa polling.
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
  if (!linguaDestino) return { error: "Scegli la lingua di arrivo." };
  if (!FORMATI.includes(formato)) return { error: "Scegli il formato del risultato." };

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
  if (linguaOrigine) {
    const { data: memRows } = await supabase
      .from("traduzione_memoria")
      .select("hash_origine,testo_origine,testo_destino")
      .eq("user_id", user.id)
      .eq("lingua_origine", linguaOrigine)
      .eq("lingua_destino", linguaDestino)
      .limit(1000);
    memoria = (memRows ?? []) as typeof memoria;
  }

  let job;
  try {
    job = await backendAvvia({
      praticaId,
      fileUrl: signed.data.signedUrl,
      nomeFileOriginale: file.name,
      linguaDestino,
      linguaOrigine,
      formato,
      glossario,
      memoria,
    });
  } catch (e) {
    return {
      error: `Avvio della traduzione fallito: ${
        e instanceof Error ? e.message : "errore sconosciuto"
      }`,
    };
  }

  const insert = await supabase.from("pratiche").insert({
    id: praticaId,
    user_id: user.id,
    notaio: "—",
    data_stipula: oggiISO(),
    stato: "in_estrazione",
    tipo_pratica: "traduzione",
    lingua_origine: linguaOrigine,
    lingua_destino: linguaDestino,
    formato_traduzione: formato,
    job_id: job.jobId,
    input_path: inputPath,
    nome_file_input: file.name,
  });
  if (insert.error)
    return { error: `Salvataggio pratica fallito: ${insert.error.message}` };

  await logAudit({
    azione: "upload_traduzione",
    userId: user.id,
    email: user.email,
    praticaId,
    ip: await ipCorrente(),
    dettagli: { linguaOrigine, linguaDestino, formato, nomeFile: file.name },
  });

  return { praticaId, jobId: job.jobId };
}

export interface PollResult {
  stato: "in_corso" | "completato" | "errore";
  progresso: number;
  fase?: string | null;
  semaforo?: string | null;
  downloadUrl?: string | null;
  errore?: string | null;
}

// Polling dello stato del job. Al completamento carica l'output su storage,
// aggiorna la pratica e salva le nuove voci di memoria. Idempotente.
export async function pollTraduzione(
  praticaId: string,
  jobId: string
): Promise<PollResult> {
  if (!supabaseConfigured()) return { stato: "errore", progresso: 0, errore: "Supabase non configurato." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { stato: "errore", progresso: 0, errore: "Sessione scaduta." };

  let stato;
  try {
    stato = await backendStato(jobId);
  } catch (e) {
    return {
      stato: "errore",
      progresso: 0,
      errore: e instanceof Error ? e.message : "errore sconosciuto",
    };
  }

  if (stato.stato === "in_corso") {
    return { stato: "in_corso", progresso: stato.progresso ?? 0, fase: stato.fase };
  }

  if (stato.stato === "errore") {
    await supabase.from("pratiche").update({ stato: "errore" }).eq("id", praticaId);
    return { stato: "errore", progresso: 0, errore: stato.errore ?? "Elaborazione fallita." };
  }

  // completato: finalizza (idempotente).
  const report = (stato.report ?? {}) as Record<string, unknown>;
  const qualita = (report.qualita ?? {}) as Record<string, unknown>;
  const semaforo = (qualita.semaforo as string) ?? "giallo";
  const codiceOrigine = (report.lingua_origine as string) ?? null;

  const nomeFile = stato.nomeFile ?? `traduzione_${praticaId}.docx`;
  const attoPath = `${user.id}/${praticaId}/output-${sanitize(nomeFile)}`;

  if (stato.docBase64) {
    const bytes = Buffer.from(stato.docBase64, "base64");
    const upOut = await supabase.storage
      .from(BUCKET_ATTI)
      .upload(attoPath, bytes, { contentType: mimePerFile(nomeFile), upsert: true });
    if (upOut.error)
      return { stato: "errore", progresso: 100, errore: `Salvataggio output fallito: ${upOut.error.message}` };
  }

  await supabase
    .from("pratiche")
    .update({
      stato: "completata",
      semaforo: ["verde", "giallo", "rosso"].includes(semaforo) ? semaforo : "giallo",
      atto_path: attoPath,
      nome_file_atto: nomeFile,
      report,
      ...(codiceOrigine ? { lingua_origine: codiceOrigine } : {}),
    })
    .eq("id", praticaId);

  // Memoria di traduzione: salva le voci nuove (idempotente via indice unico).
  const nuove = stato.memoriaNuova ?? [];
  if (nuove.length && codiceOrigine && stato.report) {
    const linguaDest = (report.lingua_destino as string) ?? "";
    const righe = nuove.map((v) => ({
      user_id: user.id,
      lingua_origine: codiceOrigine,
      lingua_destino: linguaDest,
      hash_origine: v.hash_origine,
      testo_origine: v.testo_origine,
      testo_destino: v.testo_destino,
    }));
    await supabase.from("traduzione_memoria").upsert(righe, {
      onConflict: "user_id,lingua_origine,lingua_destino,hash_origine",
      ignoreDuplicates: true,
    });
  }

  revalidatePath("/storico");

  await logAudit({
    azione: "download_traduzione_pronta",
    userId: user.id,
    email: user.email,
    praticaId,
    dettagli: { semaforo, nomeFile },
  });

  return {
    stato: "completato",
    progresso: 100,
    semaforo,
    downloadUrl: `/api/pratica/${praticaId}/download`,
  };
}
