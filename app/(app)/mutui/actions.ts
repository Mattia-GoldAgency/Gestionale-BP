"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { notaioById } from "@/lib/notai";
import { estraiPratica } from "@/lib/backend";
import { BUCKET_DOCUMENTI } from "@/lib/types";
import { dataStipulaInLettere } from "@/lib/data-stipula";
import { logAudit, ipCorrente } from "@/lib/audit";

export interface CreaPraticaState {
  error?: string;
}

const MAX_FILE = 20 * 1024 * 1024; // 20 MB

export async function creaPratica(
  _prev: CreaPraticaState,
  formData: FormData
): Promise<CreaPraticaState> {
  if (!supabaseConfigured()) {
    return { error: "Supabase non configurato. Contatta l'amministratore." };
  }

  const notaioId = String(formData.get("notaio") ?? "");
  const dataStipula = String(formData.get("data_stipula") ?? "");
  const rnp = formData.get("rnp");
  const minuta = formData.get("minuta");

  const notaio = notaioById(notaioId);
  if (!notaio) return { error: "Seleziona un notaio." };
  if (!dataStipulaInLettere(dataStipula))
    return { error: "Data di stipula non valida." };
  if (!(rnp instanceof File) || rnp.size === 0)
    return { error: "Carica la Relazione Notarile Preliminare (RNP)." };
  if (!(minuta instanceof File) || minuta.size === 0)
    return { error: "Carica la minuta della banca." };
  if (rnp.size > MAX_FILE || minuta.size > MAX_FILE)
    return { error: "Ogni file non può superare i 20 MB." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // crypto.randomUUID è globale su Node 19+ (qui Node 24).
  const praticaId = crypto.randomUUID();
  const base = `${user.id}/${praticaId}`;
  const rnpPath = `${base}/rnp-${sanitize(rnp.name)}`;
  const minutaPath = `${base}/minuta-${sanitize(minuta.name)}`;

  const up1 = await supabase.storage
    .from(BUCKET_DOCUMENTI)
    .upload(rnpPath, rnp, { contentType: rnp.type || undefined, upsert: false });
  if (up1.error) return { error: `Upload RNP fallito: ${up1.error.message}` };

  const up2 = await supabase.storage
    .from(BUCKET_DOCUMENTI)
    .upload(minutaPath, minuta, {
      contentType: minuta.type || undefined,
      upsert: false,
    });
  if (up2.error)
    return { error: `Upload minuta fallito: ${up2.error.message}` };

  // URL firmati temporanei per consentire al backend di leggere i file.
  const [rnpSigned, minutaSigned] = await Promise.all([
    supabase.storage.from(BUCKET_DOCUMENTI).createSignedUrl(rnpPath, 900),
    supabase.storage.from(BUCKET_DOCUMENTI).createSignedUrl(minutaPath, 900),
  ]);

  let estrazione;
  try {
    estrazione = await estraiPratica({
      praticaId,
      notaio: notaio.nome,
      dataStipulaISO: dataStipula,
      rnpUrl: rnpSigned.data?.signedUrl ?? "",
      minutaUrl: minutaSigned.data?.signedUrl ?? "",
    });
  } catch (e) {
    return {
      error: `Estrazione dati fallita: ${
        e instanceof Error ? e.message : "errore sconosciuto"
      }`,
    };
  }

  const hasMancanti = estrazione.campiMancanti.length > 0;

  const insert = await supabase
    .from("pratiche")
    .insert({
      id: praticaId,
      user_id: user.id,
      notaio: notaio.nome,
      data_stipula: dataStipula,
      stato: hasMancanti ? "dati_mancanti" : "in_estrazione",
      semaforo: estrazione.semaforoPreliminare,
      banca_riconosciuta: estrazione.bancaRiconosciuta,
      rnp_path: rnpPath,
      minuta_path: minutaPath,
      campi_mancanti: estrazione.campiMancanti,
      nome_banca: estrazione.nomeBanca,
      nome_cliente: estrazione.nomeCliente,
    })
    .select("id")
    .single();

  if (insert.error)
    return { error: `Salvataggio pratica fallito: ${insert.error.message}` };

  await logAudit({
    azione: "upload_pratica",
    userId: user.id,
    email: user.email,
    praticaId,
    ip: await ipCorrente(),
    dettagli: { notaio: notaio.nome, dataStipula, datiMancanti: estrazione.campiMancanti.length },
  });

  revalidatePath("/dashboard");
  redirect(`/pratica/${praticaId}`);
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}
