import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { MissingForm } from "./missing-form";
import type { Pratica } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DatiMancantiPage({
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
  const campi = pratica.campi_mancanti ?? [];
  if (campi.length === 0) redirect(`/pratica/${id}`);

  return (
    <>
      <AppHeader email={user?.email} />
      <main className="mx-auto w-full max-w-2xl px-6 py-8">
        <div className="card p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Completa i dati mancanti</h2>
          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
            Alcune informazioni non sono state rilevate nella RNP né nella
            minuta. Inseriscile per procedere alla generazione dell&apos;atto
            ({pratica.notaio}, stipula {pratica.data_stipula}).
          </p>
          <MissingForm praticaId={id} campi={campi} />
        </div>
      </main>
    </>
  );
}
