import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { SemaforoBadge } from "@/components/semaforo";
import type { Pratica } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATO_LABEL: Record<string, string> = {
  in_estrazione: "In elaborazione",
  dati_mancanti: "Dati da completare",
  completata: "Completata",
  errore: "Errore",
};

export default async function StoricoPage() {
  if (!supabaseConfigured()) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="card max-w-lg p-8">
          <h2 className="text-lg font-semibold mb-2">Configurazione richiesta</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Le variabili d&apos;ambiente Supabase non sono impostate.
          </p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();

  // Fetch all practices (usually deleted after 15 days by external cron)
  const { data: pratiche } = await supabase
    .from("pratiche")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <section>
        <h2 className="font-title font-semibold text-xl text-[var(--brand-blue)] mb-4">Storico Completo Pratiche</h2>
        <p className="text-sm text-gray-500 mb-6">
          Elenco di tutte le pratiche elaborate negli ultimi 15 giorni. Le pratiche più vecchie vengono eliminate automaticamente per motivi di privacy.
        </p>

        {pratiche && pratiche.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {(pratiche as Pratica[]).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/pratica/${p.id}`}
                  className="bg-white rounded border border-[var(--brand-gray)] px-6 py-4 flex items-center justify-between hover:border-[var(--brand-blue)] hover:-translate-y-0.5 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-[var(--brand-blue)]">
                      {p.nome_banca && p.nome_cliente ? `${p.nome_banca} - ${p.nome_cliente}` : (p.nome_banca || p.nome_cliente || p.notaio)}
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      {p.notaio} · Stipula {p.data_stipula} · {STATO_LABEL[p.stato] ?? p.stato}
                    </span>
                  </div>
                  <SemaforoBadge value={p.semaforo} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            Nessuna pratica trovata nello storico.
          </p>
        )}
      </section>
    </div>
  );
}
