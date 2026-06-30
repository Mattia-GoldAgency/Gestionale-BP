import { createClient, supabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdempimentiImmobiliariPage() {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.getUser();
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="font-title font-semibold text-2xl text-[var(--brand-blue)] mb-1">
          Adempimenti Immobiliari
        </h2>
        <p className="text-sm text-gray-500">
          Sezione dedicata alla gestione e al monitoraggio degli adempimenti immobiliari.
        </p>
      </div>

      <div className="card p-8 text-center text-gray-500">
        <p>Presto disponibile: funzioni e card per gli adempimenti immobiliari.</p>
      </div>
    </div>
  );
}
