"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { generaAtto } from "@/lib/backend";
import { BUCKET_DOCUMENTI, BUCKET_ATTI, mimePerFile, type Pratica } from "@/lib/types";

export interface DatiMancantiState {
  error?: string;
}

// Salva i dati mancanti forniti dall'utente e genera subito l'atto.
export async function completaDati(
  praticaId: string,
  _prev: DatiMancantiState,
  formData: FormData
): Promise<DatiMancantiState> {
  if (!supabaseConfigured())
    return { error: "Supabase non configurato." };

  const supabase = await createClient();
  const { data: pratica, error } = await supabase
    .from("pratiche")
    .select("*")
    .eq("id", praticaId)
    .single<Pratica>();
  if (error || !pratica) return { error: "Pratica non trovata." };

  const datiForniti: Record<string, string> = {};
  for (const campo of pratica.campi_mancanti ?? []) {
    const v = String(formData.get(campo.chiave) ?? "").trim();
    if (campo.obbligatorio && !v) {
      return { error: `Compila il campo obbligatorio: ${campo.etichetta}.` };
    }
    if (v) datiForniti[campo.chiave] = v;
  }

  const esito = await eseguiGenerazione(pratica, datiForniti);
  if (esito.error) return { error: esito.error };

  revalidatePath(`/pratica/${praticaId}`);
  redirect(`/pratica/${praticaId}`);
}

// Genera l'atto quando non mancano dati (form senza input nella pagina dettaglio).
export async function generaPratica(praticaId: string) {
  const supabase = await createClient();
  const { data: pratica } = await supabase
    .from("pratiche")
    .select("*")
    .eq("id", praticaId)
    .single<Pratica>();
  if (!pratica) redirect("/dashboard");

  await eseguiGenerazione(pratica, pratica.dati_forniti ?? {});
  revalidatePath(`/pratica/${praticaId}`);
  redirect(`/pratica/${praticaId}`);
}

// --- helper condiviso: chiama il backend, salva il DOCX, aggiorna la pratica ---
async function eseguiGenerazione(
  pratica: Pratica,
  datiForniti: Record<string, string>
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const [rnpSigned, minutaSigned] = await Promise.all([
    pratica.rnp_path
      ? supabase.storage.from(BUCKET_DOCUMENTI).createSignedUrl(pratica.rnp_path, 900)
      : Promise.resolve({ data: null }),
    pratica.minuta_path
      ? supabase.storage.from(BUCKET_DOCUMENTI).createSignedUrl(pratica.minuta_path, 900)
      : Promise.resolve({ data: null }),
  ]);

  let gen;
  try {
    gen = await generaAtto({
      praticaId: pratica.id,
      notaio: pratica.notaio,
      dataStipulaISO: pratica.data_stipula,
      rnpUrl: rnpSigned.data?.signedUrl ?? "",
      minutaUrl: minutaSigned.data?.signedUrl ?? "",
      datiForniti,
    });
  } catch (e) {
    await supabase
      .from("pratiche")
      .update({ stato: "errore", dati_forniti: datiForniti })
      .eq("id", pratica.id);
    return {
      error: `Generazione fallita: ${e instanceof Error ? e.message : "errore"}`,
    };
  }

  const bytes = Buffer.from(gen.docBase64, "base64");
  const attoPath = `${pratica.user_id}/${pratica.id}/${gen.nomeFile}`;
  const up = await supabase.storage.from(BUCKET_ATTI).upload(attoPath, bytes, {
    contentType: mimePerFile(gen.nomeFile),
    upsert: true,
  });
  if (up.error) return { error: `Salvataggio atto fallito: ${up.error.message}` };

  const { error: updErr } = await supabase
    .from("pratiche")
    .update({
      stato: "completata",
      dati_forniti: datiForniti,
      atto_path: attoPath,
      nome_file_atto: gen.nomeFile,
      coverage: gen.coverage,
      semaforo: gen.semaforo,
      report: gen.reportValidazione,
    })
    .eq("id", pratica.id);
  if (updErr) return { error: `Aggiornamento pratica fallito: ${updErr.message}` };

  return {};
}
