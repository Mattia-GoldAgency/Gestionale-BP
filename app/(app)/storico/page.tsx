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

function TipoBadge({ tipo }: { tipo: string }) {
  const isTrad = tipo === "traduzione";
  return (
    <span
      className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded ${
        isTrad ? "bg-[var(--brand-light)] text-[var(--brand-blue)]" : "bg-gray-100 text-gray-600"
      }`}
    >
      {isTrad ? "Traduzione" : "Mutuo"}
    </span>
  );
}

const ROW_CLASS =
  "bg-white rounded border border-[var(--brand-gray)] px-6 py-4 flex items-center justify-between hover:border-[var(--brand-blue)] hover:-translate-y-0.5 hover:shadow-md transition-all duration-300";

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
        <p className="text-sm text-gray-500 mb-6">
          Elenco di tutte le pratiche — mutui e traduzioni — elaborate negli ultimi 15 giorni. Le pratiche più vecchie vengono eliminate automaticamente per motivi di privacy.
        </p>

        {pratiche && pratiche.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {(pratiche as Pratica[]).map((p) => {
              const isTrad = p.tipo_pratica === "traduzione";
              const titolo = isTrad
                ? p.nome_file_input || "Documento tradotto"
                : p.nome_banca && p.nome_cliente
                ? `${p.nome_banca} - ${p.nome_cliente}`
                : p.nome_banca || p.nome_cliente || p.notaio;
              const sottotitolo = isTrad
                ? `${(p.lingua_origine || "?").toUpperCase()} → ${(p.lingua_destino || "?").toUpperCase()} · ${STATO_LABEL[p.stato] ?? p.stato}`
                : `${p.notaio} · Stipula ${p.data_stipula} · ${STATO_LABEL[p.stato] ?? p.stato}`;

              const interno = (
                <>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <TipoBadge tipo={p.tipo_pratica} />
                      <span className="font-medium text-[var(--brand-blue)]">{titolo}</span>
                    </div>
                    <span className="text-xs text-gray-500">{sottotitolo}</span>
                  </div>
                  <SemaforoBadge value={p.semaforo} />
                </>
              );

              // Traduzioni: download diretto del .docx (la rotta esistente vale anche
              // per loro). Mutui: dettaglio pratica come prima.
              if (isTrad) {
                return (
                  <li key={p.id}>
                    {p.atto_path ? (
                      <a href={`/api/pratica/${p.id}/download`} className={ROW_CLASS}>
                        {interno}
                      </a>
                    ) : (
                      <div className={ROW_CLASS}>{interno}</div>
                    )}
                  </li>
                );
              }
              return (
                <li key={p.id}>
                  <Link href={`/pratica/${p.id}`} className={ROW_CLASS}>
                    {interno}
                  </Link>
                </li>
              );
            })}
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
