import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
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
    <>
      <AppHeader email={user?.email} />
      <main className="mx-auto w-full max-w-4xl px-6 py-8 flex flex-col gap-8">
        <section className="card p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Nuova pratica</h2>
          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
            Carica la RNP e la minuta della banca, indica il notaio e la data di
            stipula.
          </p>
          <UploadForm />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Pratiche recenti</h2>
          {pratiche && pratiche.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {(pratiche as Pratica[]).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/pratica/${p.id}`}
                    className="card px-4 py-3 flex items-center justify-between hover:border-[var(--ring)] transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{p.notaio}</span>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        Stipula {p.data_stipula} · {STATO_LABEL[p.stato] ?? p.stato}
                      </span>
                    </div>
                    <SemaforoBadge value={p.semaforo} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Nessuna pratica ancora. Caricane una qui sopra.
            </p>
          )}
        </section>
      </main>
    </>
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
