import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { BUCKET_DOCUMENTI, BUCKET_ATTI, type Pratica } from "@/lib/types";

export const dynamic = "force-dynamic";

// Cron giornaliero (vercel.json). Cancella i file delle pratiche più vecchie
// di N giorni (impostazione retention_giorni, default 15). I metadati restano.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Giorni di retention dalle impostazioni.
  const { data: setting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "retention_giorni")
    .maybeSingle();
  const giorni = Number(setting?.value) > 0 ? Number(setting?.value) : 15;

  const cutoff = new Date(Date.now() - giorni * 86400000).toISOString();

  const { data: pratiche, error } = await admin
    .from("pratiche")
    .select("*")
    .lt("created_at", cutoff)
    .or("rnp_path.not.is.null,minuta_path.not.is.null,atto_path.not.is.null")
    .returns<Pratica[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let purged = 0;
  for (const p of pratiche ?? []) {
    const docFiles = [p.rnp_path, p.minuta_path].filter(
      (x): x is string => Boolean(x)
    );
    if (docFiles.length) await admin.storage.from(BUCKET_DOCUMENTI).remove(docFiles);
    if (p.atto_path) await admin.storage.from(BUCKET_ATTI).remove([p.atto_path]);

    await admin
      .from("pratiche")
      .update({ rnp_path: null, minuta_path: null, atto_path: null })
      .eq("id", p.id);
    purged++;
  }

  await logAudit({
    azione: "retention_purge",
    dettagli: { giorni, pratiche_ripulite: purged, cutoff },
  });

  return NextResponse.json({ ok: true, giorni, purged });
}
