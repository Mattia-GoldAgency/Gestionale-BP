import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { TraduzioniForm } from "./upload-form";

export const dynamic = "force-dynamic";
// L'azione di traduzione è sincrona e può durare a lungo (OCR + traduzione):
// alza il limite di durata della funzione (entro il massimo del piano Vercel).
export const maxDuration = 300;

export default async function TraduzioniPage() {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.getUser();
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="font-title font-semibold text-2xl text-[var(--brand-blue)] mb-1">
          Traduzioni e Trascrizioni testo
        </h2>
        <p className="text-sm text-gray-500">
          Carica qualsiasi documento — anche scansioni e immagini — scegli le lingue e
          il formato del risultato. La terminologia resta professionale e notarile.
        </p>
      </div>

      <div className="card p-8">
        <TraduzioniForm />
      </div>
    </div>
  );
}
