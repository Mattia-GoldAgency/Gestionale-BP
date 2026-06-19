import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { SemaforoBadge } from "@/components/semaforo";
import { generaPratica } from "./actions";
import { DeletePraticaButton } from "./delete-button";
import type { Pratica } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PraticaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pratica } = await supabase
    .from("pratiche")
    .select("*")
    .eq("id", id)
    .single<Pratica>();

  if (!pratica) redirect("/dashboard");
  if (pratica.stato === "dati_mancanti") redirect(`/pratica/${id}/dati-mancanti`);

  const genera = generaPratica.bind(null, id);
  const sistMotivo = (pratica.report as Record<string, unknown> | null)?.[
    "sistematizzazione_motivo"
  ] as string | null | undefined;

  return (
    <>
      <main className="max-w-2xl mx-auto space-y-6">
        <Link href="/dashboard" className="text-sm" style={{ color: "var(--muted)" }}>
          ← Torna alle pratiche
        </Link>

        <div className="card p-6 sm:p-8 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">{pratica.notaio}</h2>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Data di stipula: {pratica.data_stipula}
              </p>
            </div>
            <SemaforoBadge value={pratica.semaforo} />
          </div>

          {pratica.stato === "completata" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Atto generato e pronto alla stipula
                {typeof pratica.coverage === "number"
                  ? ` · coverage ${pratica.coverage}%`
                  : ""}
                .
              </p>

              {pratica.sistematizzazione_applicata ? (
                <div
                  className="rounded-md p-3 text-sm flex flex-col gap-2"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <p className="font-medium">✓ Atto allineato al modello della banca</p>
                  <p style={{ color: "var(--muted)" }}>
                    Importi, tassi e codici fiscali sono stati verificati e
                    mantenuti. Controlla le differenze di forma prima della stipula.
                  </p>
                  <div className="flex items-center gap-4">
                    <a
                      href={`/api/pratica/${id}/diff`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm underline"
                    >
                      Mostra differenze
                    </a>
                    <form action={genera}>
                      <button type="submit" className="btn btn-ghost">
                        Ripristina versione deterministica
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <form action={genera} className="flex flex-col gap-1">
                  <input type="hidden" name="sistematizzazione" value="1" />
                  <button type="submit" className="btn btn-ghost self-start">
                    Allinea al modello della banca
                  </button>
                  {sistMotivo ? (
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      Ultimo tentativo non applicato: {sistMotivo}
                    </p>
                  ) : null}
                </form>
              )}

              <a
                href={`/api/pratica/${id}/download`}
                className="btn btn-primary self-start"
              >
                Scarica documenti (.docx)
              </a>
            </div>
          ) : pratica.stato === "errore" ? (
            <div className="flex flex-col gap-3">
              <p className="field-error">
                Si è verificato un errore durante la generazione.
              </p>
              <form action={genera}>
                <button type="submit" className="btn btn-ghost">
                  Riprova la generazione
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Tutti i dati necessari sono presenti. Genera l&apos;atto.
              </p>
              <form action={genera} className="flex flex-col gap-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="sistematizzazione"
                    defaultChecked
                    className="mt-1"
                  />
                  <span>
                    Allinea l&apos;atto al modello della banca (sistematizzazione).
                    I dati restano blindati; potrai vedere le differenze e
                    ripristinare la versione deterministica.
                  </span>
                </label>
                <button type="submit" className="btn btn-primary self-start">
                  Genera l&apos;atto
                </button>
              </form>
            </div>
          )}

          <div className="pt-2 mt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <DeletePraticaButton praticaId={id} />
          </div>
        </div>
      </main>
    </>
  );
}
