import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { SEZIONI_CONTROLLATE, puoAccedere } from "@/lib/sezioni";

export const dynamic = "force-dynamic";

// Icone per chiave sezione (le sezioni nel registro non portano JSX, così il
// modulo resta usabile anche dal middleware edge). Fallback generico per chiavi
// future non ancora mappate qui.
const ICONE: Record<string, React.ReactNode> = {
  "scrittura-atti": (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
  ),
  traduzioni: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>
  ),
  "adempimenti-immobiliari": (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
  ),
};

const ICONA_DEFAULT = (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
);

export default async function DashboardHubPage() {
  const configured = supabaseConfigured();
  let user = null;
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  // Senza Supabase (preview locale) mostra tutto. Altrimenti filtra per permesso.
  const sezioni = configured
    ? SEZIONI_CONTROLLATE.filter((s) => puoAccedere(user, s.chiave))
    : SEZIONI_CONTROLLATE;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <p className="text-gray-500">Seleziona la sezione a cui vuoi accedere.</p>
      </div>

      {sezioni.length === 0 ? (
        <div className="card max-w-lg p-8">
          <h2 className="text-lg font-semibold mb-2">Nessuna sezione abilitata</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Al momento non hai sezioni operative attive. Contatta l&apos;amministratore
            per richiedere l&apos;accesso. Lo Storico delle tue pratiche resta comunque
            disponibile dal menu a sinistra.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sezioni.map((s) => (
            <Link
              key={s.chiave}
              href={s.href}
              className="group bg-white rounded-lg border border-[var(--brand-gray)] p-8 hover:border-[var(--brand-blue)] hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-[var(--brand-light)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 text-[var(--brand-blue)]">
                {ICONE[s.chiave] ?? ICONA_DEFAULT}
              </div>
              <h3 className="font-title font-semibold text-xl text-[var(--brand-blue)] mb-2">{s.etichetta}</h3>
              <p className="text-sm text-gray-500">{s.descrizione}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
