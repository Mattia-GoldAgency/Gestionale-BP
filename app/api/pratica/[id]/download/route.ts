import { NextResponse, type NextRequest } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { BUCKET_ATTI, mimePerFile, type Pratica } from "@/lib/types";

// Scarica i documenti della pratica. RLS garantisce che solo il proprietario vi
// acceda. Se esiste anche la Relazione Notarile Definitiva, restituisce uno ZIP
// con atto + relazione; altrimenti il solo atto .docx (pratiche senza relazione).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { data: pratica } = await supabase
    .from("pratiche")
    .select("*")
    .eq("id", id)
    .single<Pratica>();

  if (!pratica || !pratica.atto_path) {
    return NextResponse.json({ error: "Atto non disponibile" }, { status: 404 });
  }

  const attoDl = await supabase.storage.from(BUCKET_ATTI).download(pratica.atto_path);
  if (attoDl.error || !attoDl.data) {
    return NextResponse.json({ error: "Download fallito" }, { status: 500 });
  }
  const nomeAtto = pratica.nome_file_atto ?? `atto_${id}.docx`;

  // Se c'è la relazione, impacchetta entrambi i documenti in uno ZIP.
  if (pratica.relazione_path) {
    const relDl = await supabase.storage
      .from(BUCKET_ATTI)
      .download(pratica.relazione_path);
    if (!relDl.error && relDl.data) {
      const nomeRel = pratica.nome_file_relazione ?? `relazione_${id}.docx`;
      const zip = new JSZip();
      zip.file(nomeAtto, new Uint8Array(await attoDl.data.arrayBuffer()));
      zip.file(nomeRel, new Uint8Array(await relDl.data.arrayBuffer()));
      const zipBlob = await zip.generateAsync({ type: "blob" });

      await logAudit({
        azione: "download_atto",
        userId: user.id,
        email: user.email,
        praticaId: id,
        dettagli: { documenti: [nomeAtto, nomeRel] },
      });

      return new NextResponse(zipBlob, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="documenti_${id}.zip"`,
          "Cache-Control": "no-store",
        },
      });
    }
  }

  // Fallback: solo atto (pratiche senza relazione, comportamento invariato).
  await logAudit({
    azione: "download_atto",
    userId: user.id,
    email: user.email,
    praticaId: id,
    dettagli: { nomeFile: nomeAtto },
  });

  return new NextResponse(attoDl.data, {
    headers: {
      "Content-Type": mimePerFile(nomeAtto),
      "Content-Disposition": `attachment; filename="${nomeAtto}"`,
      "Cache-Control": "no-store",
    },
  });
}
