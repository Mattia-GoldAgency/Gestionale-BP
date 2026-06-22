import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { SemaforoBadge } from "@/components/semaforo";
import { StrutturaPanel } from "@/components/struttura-panel";
import { generaPratica } from "./actions";
import { GeneraForm } from "./genera-form";
import { DeletePraticaButton } from "./delete-button";
import type { StrutturaReport } from "@/lib/backend";
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
  const struttura = (pratica.report as Record<string, unknown> | null)?.[
    "struttura"
  ] as StrutturaReport | null | undefined;

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

              <StrutturaPanel struttura={struttura} />

              <a
                href={`/api/pratica/${id}/download`}
                className="btn btn-primary self-start"
              >
                Scarica documenti (.docx)
              </a>

              <GeneraForm
                action={genera}
                label="Rigenera l'atto"
                pendingLabel="Rigenerazione dell'atto in corso…"
                variant="ghost"
              />
            </div>
          ) : pratica.stato === "errore" ? (
            <div className="flex flex-col gap-3">
              <p className="field-error">
                Si è verificato un errore durante la generazione.
              </p>
              <GeneraForm
                action={genera}
                label="Riprova la generazione"
                pendingLabel="Generazione dell'atto in corso…"
                variant="ghost"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Tutti i dati necessari sono presenti. Genera l&apos;atto.
              </p>
              <GeneraForm action={genera} />
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
