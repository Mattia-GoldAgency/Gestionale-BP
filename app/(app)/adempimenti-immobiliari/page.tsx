import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Hub "Adempimenti Immobiliari": pagina contenitore che raccoglie gli strumenti
// di adempimento immobiliare telematico. Oggi una sola sotto-card (Rinnovazioni
// ipotecarie); in futuro qui andranno gli altri modelli (es. Modello Unico).
// Stesso schema di app/(app)/scrittura-atti/page.tsx.
export default async function AdempimentiImmobiliariPage() {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.getUser();
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <p className="text-gray-500">Seleziona l&apos;adempimento che vuoi predisporre.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card Rinnovazioni ipotecarie */}
        <Link href="/rinnovazioni" className="group bg-white rounded-lg border border-[var(--brand-gray)] p-8 hover:border-[var(--brand-blue)] hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--brand-light)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 text-[var(--brand-blue)]">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12a9 9 0 0115.36-6.36L21 8M21 3v5h-5M21 12a9 9 0 01-15.36 6.36L3 16m0 5v-5h5"></path></svg>
          </div>
          <h3 className="font-title font-semibold text-xl text-[var(--brand-blue)] mb-2">Rinnovazioni ipotecarie</h3>
          <p className="text-sm text-gray-500">Genera la nota di rinnovazione ipotecaria (XML per SAPES) dai documenti.</p>
        </Link>
      </div>
    </div>
  );
}
