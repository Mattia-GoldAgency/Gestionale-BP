import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { SemaforoBadge } from "@/components/semaforo";
import { UploadForm } from "./upload-form";
import type { Pratica } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATO_LABEL: Record<string, string> = {
  in_estrazione: "In elaborazione",
  dati_mancanti: "Dati da completare",
  completata: "Completata",
  errore: "Errore",
};

export default async function DashboardPage() {
  if (!supabaseConfigured()) {
    return (
      <ConfigMancante />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pratiche } = await supabase
    .from("pratiche")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Nuova Pratica (Upload Form) */}
      <section className="bg-white rounded shadow-sm border border-[var(--brand-gray)] p-8">
        <h2 className="font-title font-semibold text-xl text-[var(--brand-blue)] mb-2">Nuova pratica</h2>
        <p className="text-sm text-gray-500 mb-6">
          Carica la RNP e la minuta della banca, indica il notaio e la data di stipula.
        </p>
        <UploadForm />
      </section>

      {/* Pratiche Recenti (Storico) */}
      <section>
        <h2 className="font-title font-semibold text-xl text-[var(--brand-blue)] mb-4">Storico</h2>
        {pratiche && pratiche.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {(pratiche as Pratica[]).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/pratica/${p.id}`}
                  className="bg-white rounded border border-[var(--brand-gray)] px-6 py-4 flex items-center justify-between hover:border-[var(--brand-blue)] hover:-translate-y-0.5 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-[var(--brand-blue)]">{p.notaio}</span>
                    <span className="text-xs text-gray-500 mt-1">
                      Stipula {p.data_stipula} · {STATO_LABEL[p.stato] ?? p.stato}
                    </span>
                  </div>
                  <SemaforoBadge value={p.semaforo} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            Nessuna pratica ancora. Caricane una qui sopra.
          </p>
        )}
      </section>
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
