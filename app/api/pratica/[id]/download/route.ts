import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_ATTI, mimePerFile, type Pratica } from "@/lib/types";

// Scarica l'atto generato. RLS garantisce che solo il proprietario vi acceda.
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

  const { data: file, error } = await supabase.storage
    .from(BUCKET_ATTI)
    .download(pratica.atto_path);

  if (error || !file) {
    return NextResponse.json({ error: "Download fallito" }, { status: 500 });
  }

  const nome = pratica.nome_file_atto ?? `atto_${id}.docx`;
  return new NextResponse(file.stream(), {
    headers: {
      "Content-Type": mimePerFile(nome),
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
