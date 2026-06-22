"use client";

import { useFormStatus } from "react-dom";
import { PennaLoader } from "@/components/penna-loader";

// Bottone che, durante l'invio del form (server action sincrona di generazione),
// mostra il loader animato al posto del pulsante: l'utente vede che sta lavorando.
function SubmitGenera({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant: "primary" | "ghost";
}) {
  const { pending } = useFormStatus();
  if (pending) return <PennaLoader label={pendingLabel} />;
  return (
    <button
      type="submit"
      className={`btn ${variant === "ghost" ? "btn-ghost" : "btn-primary"} self-start`}
    >
      {label}
    </button>
  );
}

// Form client-side attorno alla server action di generazione, per il feedback
// di caricamento. ``action`` è la server action (bound) passata dalla pagina.
export function GeneraForm({
  action,
  label = "Genera l'atto",
  pendingLabel = "Generazione dell'atto in corso…",
  variant = "primary",
}: {
  action: (formData: FormData) => void | Promise<void>;
  label?: string;
  pendingLabel?: string;
  variant?: "primary" | "ghost";
}) {
  return (
    <form action={action} className="flex flex-col gap-3">
      <SubmitGenera label={label} pendingLabel={pendingLabel} variant={variant} />
    </form>
  );
}
