"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/roles";
import { logAudit, ipCorrente } from "@/lib/audit";
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

  const sistematizzazione = Boolean(formData.get("sistematizzazione"));
  const esito = await eseguiGenerazione(pratica, datiForniti, sistematizzazione);
  if (esito.error) return { error: esito.error };

  revalidatePath(`/pratica/${praticaId}`);
  redirect(`/pratica/${praticaId}`);
}

// Genera l'atto quando non mancano dati (form della pagina dettaglio). La
// checkbox "sistematizzazione" attiva l'allineamento al golden; assente →
// deterministico (è anche il percorso di "ripristino").
export async function generaPratica(praticaId: string, formData?: FormData) {
  const supabase = await createClient();
  const { data: pratica } = await supabase
    .from("pratiche")
    .select("*")
    .eq("id", praticaId)
    .single<Pratica>();
  if (!pratica) redirect("/dashboard");

  const sistematizzazione = Boolean(formData?.get("sistematizzazione"));
  await eseguiGenerazione(pratica, pratica.dati_forniti ?? {}, sistematizzazione);
  revalidatePath(`/pratica/${praticaId}`);
  redirect(`/pratica/${praticaId}`);
}

// --- helper condiviso: chiama il backend, salva il DOCX, aggiorna la pratica ---
async function eseguiGenerazione(
  pratica: Pratica,
  datiForniti: Record<string, string>,
  sistematizzazione = false
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
      sistematizzazione,
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

  // Sistematizzazione (Feature B): il diff (testo d'atto) NON va in chiaro nel DB →
  // si salva come oggetto nel bucket atti (RLS per utente). Se non c'è, si azzera
  // (es. ripristino del deterministico).
  let diffPath: string | null = null;
  if (gen.sistematizzazioneDiff) {
    diffPath = `${pratica.user_id}/${pratica.id}/sistematizzazione.diff`;
    await supabase.storage
      .from(BUCKET_ATTI)
      .upload(diffPath, Buffer.from(gen.sistematizzazioneDiff, "utf-8"), {
        contentType: "text/plain; charset=utf-8",
        upsert: true,
      });
  }

  const { error: updErr } = await supabase
    .from("pratiche")
    .update({
      stato: "completata",
      dati_forniti: datiForniti,
      atto_path: attoPath,
      nome_file_atto: gen.nomeFile,
      coverage: gen.coverage,
      semaforo: gen.semaforo,
      // motivo = etichette di campi, niente PII → ok nel report jsonb.
      report: {
        ...gen.reportValidazione,
        sistematizzazione_motivo: gen.sistematizzazioneMotivo ?? null,
      },
      sistematizzazione_applicata: gen.sistematizzazioneApplicata ?? false,
      sistematizzazione_integrita_ok: gen.sistematizzazioneIntegritaOk ?? true,
      sistematizzazione_diff_path: diffPath,
    })
    .eq("id", pratica.id);
  if (updErr) return { error: `Aggiornamento pratica fallito: ${updErr.message}` };

  // Relazione Notarile Definitiva (RND): secondo file generato insieme all'atto.
  // Best-effort: l'atto è già salvato e registrato sopra, quindi un errore qui non
  // deve far fallire la generazione (il pulsante RND semplicemente non comparirà).
  if (gen.relazioneBase64 && gen.nomeFileRelazione) {
    const relBytes = Buffer.from(gen.relazioneBase64, "base64");
    const relPath = `${pratica.user_id}/${pratica.id}/${gen.nomeFileRelazione}`;
    const upRel = await supabase.storage.from(BUCKET_ATTI).upload(relPath, relBytes, {
      contentType: mimePerFile(gen.nomeFileRelazione),
      upsert: true,
    });
    if (!upRel.error) {
      await supabase
        .from("pratiche")
        .update({ relazione_path: relPath, nome_file_relazione: gen.nomeFileRelazione })
        .eq("id", pratica.id);
    }
  }

  await logAudit({
    azione: "genera_atto",
    userId: pratica.user_id,
    praticaId: pratica.id,
    dettagli: {
      notaio: pratica.notaio,
      semaforo: gen.semaforo,
      nomeFile: gen.nomeFile,
      relazione: Boolean(gen.relazioneBase64),
      sistematizzata: gen.sistematizzazioneApplicata ?? false,
    },
  });

  return {};
}

// Diritto all'oblio: elimina la pratica e TUTTI i suoi file dallo storage.
// Consentito al proprietario della pratica o a un admin.
export async function eliminaPratica(praticaId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: pratica } = await admin
    .from("pratiche")
    .select("*")
    .eq("id", praticaId)
    .single<Pratica>();
  if (!pratica) redirect("/dashboard");

  if (pratica.user_id !== user.id && !isAdmin(user)) {
    throw new Error("Non autorizzato a eliminare questa pratica.");
  }

  const docFiles = [pratica.rnp_path, pratica.minuta_path].filter(
    (p): p is string => Boolean(p)
  );
  if (docFiles.length)
    await admin.storage.from(BUCKET_DOCUMENTI).remove(docFiles);
  const attoFiles = [pratica.atto_path, pratica.relazione_path].filter(
    (p): p is string => Boolean(p)
  );
  if (attoFiles.length)
    await admin.storage.from(BUCKET_ATTI).remove(attoFiles);

  await admin.from("pratiche").delete().eq("id", praticaId);

  await logAudit({
    azione: "elimina_pratica",
    userId: user.id,
    email: user.email,
    praticaId,
    ip: await ipCorrente(),
    dettagli: { notaio: pratica.notaio, daAdmin: pratica.user_id !== user.id },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
