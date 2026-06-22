import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { statoTraduzione } from "@/lib/backend";

// Endpoint di polling chiamato dal browser durante una traduzione. Fa da proxy
// verso il backend (GET /api/traduci/{jobId}) e restituisce SOLO stato/progresso
// (niente docBase64: payload piccolo). Il documento viene salvato dalla Server
// Action finalizzaTraduzione quando lo stato diventa "completato".
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  try {
    const stato = await statoTraduzione(jobId);
    return NextResponse.json(
      {
        stato: stato.stato,
        progresso: stato.progresso ?? 0,
        fase: stato.fase ?? null,
        errore: stato.errore ?? null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Errore di rete" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
