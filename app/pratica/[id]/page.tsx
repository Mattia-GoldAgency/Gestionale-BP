import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { SemaforoBadge } from "@/components/semaforo";
import { generaPratica } from "./actions";
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

  return (
    <>
      <AppHeader email={user?.email} />
      <main className="mx-auto w-full max-w-2xl px-6 py-8 flex flex-col gap-6">
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
              <a
                href={`/api/pratica/${id}/download`}
                className="btn btn-primary self-start"
              >
                Scarica l&apos;atto (.doc)
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
              <form action={genera}>
                <button type="submit" className="btn btn-primary self-start">
                  Genera l&apos;atto
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
