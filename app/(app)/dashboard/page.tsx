import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardHubPage() {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.getUser();
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <p className="text-gray-500">Seleziona la sezione a cui vuoi accedere.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card Mutui */}
        <Link href="/mutui" className="group bg-white rounded-lg border border-[var(--brand-gray)] p-8 hover:border-[var(--brand-blue)] hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--brand-light)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 text-[var(--brand-blue)]">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
          </div>
          <h3 className="font-title font-semibold text-xl text-[var(--brand-blue)] mb-2">Gestione Mutui</h3>
          <p className="text-sm text-gray-500">Carica RNP e minute per la generazione automatica degli atti di mutuo.</p>
        </Link>

        {/* Card Traduzioni */}
        <Link href="/traduzioni" className="group bg-white rounded-lg border border-[var(--brand-gray)] p-8 hover:border-[var(--brand-blue)] hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--brand-light)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 text-[var(--brand-blue)]">
             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>
          </div>
          <h3 className="font-title font-semibold text-xl text-[var(--brand-blue)] mb-2">Traduzioni</h3>
          <p className="text-sm text-gray-500">Servizio di traduzione documenti.</p>
        </Link>

      </div>
    </div>
  );
}

function ConfigMancante() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card max-w-lg p-8">
        <h2 className="text-lg font-semibold mb-2">Configurazione richiesta</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Le variabili d&apos;ambiente Supabase non sono impostate. Aggiungi
          <code> NEXT_PUBLIC_SUPABASE_URL</code> e
          <code> NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>{" "}
          (sviluppo) o nelle variabili di progetto su Vercel, poi ricarica.
        </p>
      </div>
    </main>
  );
}
