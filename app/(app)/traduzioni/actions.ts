"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { avviaTraduzione as backendTraduci, type FormatoTraduzione } from "@/lib/backend";
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

export interface TraduciState {
  error?: string;
  downloadUrl?: string;
  semaforo?: string;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function oggiISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Esegue una traduzione end-to-end (sincrona): carica il file, chiama il backend
// che elabora e restituisce il .docx, salva output + pratica + memoria, e ritorna
// il link di download. Tutto in un'unica azione (nessun polling).
export async function traduci(
  _prev: TraduciState,
  formData: FormData
): Promise<TraduciState> {
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

  // Chiamata sincrona al backend: elabora e restituisce il documento.
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
      error: `Traduzione fallita: ${e instanceof Error ? e.message : "errore sconosciuto"}`,
    };
  }

  if (esito.stato === "errore" || !esito.docBase64) {
    await registraErrore(supabase, praticaId, user, linguaOrigine, linguaDestino, formato, inputPath, file.name);
    return { error: esito.errore ?? "Elaborazione non riuscita." };
  }

  // Salva l'output sul bucket atti.
  const report = (esito.report ?? {}) as Record<string, unknown>;
  const qualita = (report.qualita ?? {}) as Record<string, unknown>;
  const semaforo = (["verde", "giallo", "rosso"].includes(qualita.semaforo as string)
    ? (qualita.semaforo as string)
    : "giallo");
  const codiceOrigine = (report.lingua_origine as string) ?? linguaOrigine;

  const nomeFile = esito.nomeFile ?? `traduzione_${praticaId}.docx`;
  const attoPath = `${user.id}/${praticaId}/output-${sanitize(nomeFile)}`;
  const bytes = Buffer.from(esito.docBase64, "base64");
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
    nome_file_input: file.name,
    atto_path: attoPath,
    nome_file_atto: nomeFile,
    report,
  });
  if (insert.error) return { error: `Salvataggio pratica fallito: ${insert.error.message}` };

  // Memoria di traduzione: salva le voci nuove (idempotente via indice unico).
  const nuove = esito.memoriaNuova ?? [];
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
    dettagli: { linguaOrigine: codiceOrigine, linguaDestino, formato, nomeFile: file.name, semaforo },
  });

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
