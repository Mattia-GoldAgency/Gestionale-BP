import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { RinnovazioniForm } from "./upload-form";

export const dynamic = "force-dynamic";
// Il lavoro lungo (lettura perimetro/nota/visure + generazione XML) gira in
// background sul backend; il client fa polling. Le Server Action qui (avvio e
// finalizzazione) sono brevi: 300s è un margine ampio.
export const maxDuration = 300;

export default async function RinnovazioniPage() {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.getUser();
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="font-title font-semibold text-2xl text-[var(--brand-blue)] mb-1">
          Rinnovazioni ipotecarie
        </h2>
        <p className="text-sm text-gray-500">
          Carica il perimetro ipotecario (Word del Team Visure), la nota di iscrizione
          originaria (PDF) e le visure catastali. Il sistema genera la nota di rinnovazione
          in formato XML, pronta per l&apos;importazione in SAPES.
        </p>
      </div>

      <div className="card p-8">
        <RinnovazioniForm />
      </div>
    </div>
  );
}
