import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_ATTI, type Pratica } from "@/lib/types";

// Mostra il diff della sistematizzazione (deterministico → conformato). RLS
// garantisce che solo il proprietario vi acceda. Servito inline come testo.
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

  if (!pratica || !pratica.sistematizzazione_diff_path) {
    return NextResponse.json({ error: "Diff non disponibile" }, { status: 404 });
  }

  const dl = await supabase.storage
    .from(BUCKET_ATTI)
    .download(pratica.sistematizzazione_diff_path);
  if (dl.error || !dl.data) {
    return NextResponse.json({ error: "Download fallito" }, { status: 500 });
  }

  return new NextResponse(dl.data, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `inline; filename="sistematizzazione_${id}.diff"`,
      "Cache-Control": "no-store",
    },
  });
}
