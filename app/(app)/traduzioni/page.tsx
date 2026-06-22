import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { TraduzioniForm } from "./upload-form";

export const dynamic = "force-dynamic";
// Il lavoro lungo (OCR + traduzione) gira in background sul backend; il client fa
// polling. Le Server Action qui (avvio e finalizzazione) sono brevi: 300s è un
// margine ampio, non vincola la durata della traduzione.
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
