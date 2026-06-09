"use client";

import { useActionState } from "react";
import type { CampoMancante } from "@/lib/backend";
import { completaDati, type DatiMancantiState } from "../actions";

const initial: DatiMancantiState = {};

function inputProps(tipo: CampoMancante["tipo"]) {
  switch (tipo) {
    case "tasso":
      return { type: "number", step: "0.01", min: "0", placeholder: "es. 3,90 → 3.90" };
    case "importo":
      return { type: "number", step: "0.01", min: "0", placeholder: "es. 150000.00" };
    case "durata":
    case "numero":
      return { type: "number", step: "1", min: "0", placeholder: "es. 240" };
    case "data":
      return { type: "date" };
    default:
      return { type: "text" };
  }
}

export function MissingForm({
  praticaId,
  campi,
}: {
  praticaId: string;
  campi: CampoMancante[];
}) {
  const action = completaDati.bind(null, praticaId);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {campi.map((campo) => (
        <div key={campo.chiave}>
          <label className="label" htmlFor={campo.chiave}>
            {campo.etichetta}
            {campo.obbligatorio ? " *" : ""}
          </label>
          <input
            id={campo.chiave}
            name={campo.chiave}
            required={campo.obbligatorio}
            className="input"
            {...inputProps(campo.tipo)}
          />
          {campo.hint ? (
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              {campo.hint}
            </p>
          ) : null}
        </div>
      ))}

      {state.error ? <p className="field-error">{state.error}</p> : null}

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Generazione dell'atto…" : "Completa e genera l'atto"}
      </button>
    </form>
  );
}
