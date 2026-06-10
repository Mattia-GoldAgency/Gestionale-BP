"use client";

import { useActionState, useState } from "react";
import { NOTAI } from "@/lib/notai";
import { dataStipulaInLettere } from "@/lib/data-stipula";
import { creaPratica, type CreaPraticaState } from "./actions";

const initial: CreaPraticaState = {};

export function UploadForm() {
  const [state, formAction, pending] = useActionState(creaPratica, initial);
  const [dataISO, setDataISO] = useState("");

  const anteprimaData = dataISO ? dataStipulaInLettere(dataISO) : null;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="notaio">
            Notaio rogante
          </label>
          <select id="notaio" name="notaio" required className="select" defaultValue="">
            <option value="" disabled>
              Seleziona un notaio…
            </option>
            {NOTAI.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="data_stipula">
            Data di stipula
          </label>
          <input
            id="data_stipula"
            name="data_stipula"
            type="date"
            required
            className="input"
            value={dataISO}
            onChange={(e) => setDataISO(e.target.value)}
          />
          {anteprimaData ? (
            <p className="text-sm mt-2 italic" style={{ color: "var(--accent)" }}>
              {anteprimaData}
            </p>
          ) : (
            <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
              Anteprima nel formato dell&apos;atto (la versione finale è prodotta
              dal motore di generazione).
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FileField
          name="rnp"
          label="Relazione Notarile Preliminare (RNP)"
          hint="PDF, DOC, DOCX o RTF"
        />
        <FileField
          name="minuta"
          label="Minuta della banca"
          hint="PDF, DOC, DOCX o RTF"
        />
      </div>

      {state.error ? <p className="field-error">{state.error}</p> : null}

      <div className="flex items-center gap-3 pt-4 border-t border-[var(--brand-gray)] mt-4">
        <button type="submit" className="w-full sm:w-auto bg-[var(--brand-blue)] text-white font-medium py-2 px-6 rounded hover:bg-opacity-90 transition-colors shadow-sm" disabled={pending}>
          {pending ? "Elaborazione in corso…" : "Genera atto"}
        </button>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          Se mancano dati (es. il tasso), verranno richiesti nella schermata successiva.
        </span>
      </div>
    </form>
  );
}

function FileField({
  name,
  label,
  hint,
}: {
  name: string;
  label: string;
  hint: string;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="file"
        required
        accept=".pdf,.doc,.docx,.rtf,application/pdf"
        className="w-full border border-[var(--brand-gray)] rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-blue)] bg-gray-50 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-[var(--brand-blue)] file:text-white hover:file:bg-opacity-90"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
      <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
        {fileName ?? hint}
      </p>
    </div>
  );
}
