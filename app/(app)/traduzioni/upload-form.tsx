"use client";

import { useActionState, useState } from "react";
import { traduci, type TraduciState } from "./actions";

const LINGUE = [
  { code: "it", nome: "Italiano" },
  { code: "en", nome: "Inglese" },
  { code: "fr", nome: "Francese" },
  { code: "de", nome: "Tedesco" },
  { code: "es", nome: "Spagnolo" },
  { code: "pt", nome: "Portoghese" },
  { code: "nl", nome: "Olandese" },
  { code: "ru", nome: "Russo" },
  { code: "ar", nome: "Arabo" },
  { code: "zh-cn", nome: "Cinese" },
  { code: "ja", nome: "Giapponese" },
];

const FORMATI = [
  { value: "solo_trascrizione", label: "Solo trascrizione", hint: "l'originale trascritto, senza tradurre" },
  { value: "solo_traduzione", label: "Solo traduzione", hint: "solo il testo nella lingua di arrivo" },
  { value: "originale_traduzione", label: "Trascrizione + traduzione", hint: "originale e traduzione nello stesso file" },
  { value: "bilingue", label: "Formato atto tabellare", hint: "tabella a due colonne come da atto" },
  { value: "mirror", label: "Testo a fronte", hint: "ogni paragrafo seguito dalla traduzione" },
];

const DEFAULT_FORMATO = "originale_traduzione";

const ACCEPT = ".pdf,.doc,.docx,.rtf,.odt,.jpg,.jpeg,.png,.tif,.tiff,.gif,.webp,.bmp";

const initial: TraduciState = {};

export function TraduzioniForm() {
  const [state, formAction, pending] = useActionState(traduci, initial);
  const [fileName, setFileName] = useState<string | null>(null);
  const [formato, setFormato] = useState(DEFAULT_FORMATO);

  if (state.downloadUrl) {
    const colore =
      state.semaforo === "verde" ? "#16a34a" : state.semaforo === "rosso" ? "#dc2626" : "#d97706";
    return (
      <div className="flex flex-col items-center text-center gap-4 py-6">
        <div className="text-2xl font-title font-semibold text-[var(--brand-blue)]">
          Traduzione pronta
        </div>
        {state.semaforo ? (
          <p className="text-sm" style={{ color: colore }}>
            Controllo qualità: <strong>{state.semaforo}</strong>
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          <a
            href={state.downloadUrl}
            className="bg-[var(--brand-blue)] text-white font-medium py-2 px-6 rounded hover:bg-opacity-90 transition-colors shadow-sm"
          >
            Scarica il documento
          </a>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-[var(--brand-blue)] underline"
          >
            Nuova traduzione
          </button>
        </div>
        <p className="text-xs text-gray-500">Disponibile al download per 15 giorni.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-8 md:grid-cols-2">
      {/* Sinistra: documento */}
      <div className="flex flex-col">
        <label className="label" htmlFor="documento">
          Documento da tradurre
        </label>
        <label
          htmlFor="documento"
          className="flex-1 min-h-[180px] border-2 border-dashed border-[var(--brand-gray)] rounded-lg flex flex-col items-center justify-center text-center px-4 py-8 cursor-pointer hover:border-[var(--brand-blue)] transition-colors bg-gray-50"
        >
          <svg className="w-8 h-8 text-[var(--brand-blue)] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="square" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5 5 5M12 5v12" />
          </svg>
          <span className="text-sm text-[var(--brand-blue)] font-medium">
            {fileName ?? "Trascina qui il documento o sfoglia"}
          </span>
          <span className="text-xs text-gray-500 mt-1">
            PDF, DOC, DOCX, RTF, ODT, immagini e scansioni
          </span>
        </label>
        <input
          id="documento"
          name="documento"
          type="file"
          required
          accept={ACCEPT}
          className="hidden"
          disabled={pending}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </div>

      {/* Destra: opzioni */}
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="lingua_origine">
              Lingua di partenza
            </label>
            <select id="lingua_origine" name="lingua_origine" className="select" defaultValue="" disabled={pending}>
              <option value="">Auto-rileva</option>
              {LINGUE.map((l) => (
                <option key={l.code} value={l.code}>{l.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="lingua_destino">
              Traduci verso
            </label>
            <select
              id="lingua_destino"
              name="lingua_destino"
              className="select"
              defaultValue="it"
              disabled={pending || formato === "solo_trascrizione"}
            >
              {LINGUE.map((l) => (
                <option key={l.code} value={l.code}>{l.nome}</option>
              ))}
            </select>
            {formato === "solo_trascrizione" ? (
              <p className="text-xs mt-1 text-gray-400">Non serve per la sola trascrizione.</p>
            ) : null}
          </div>
        </div>

        <div>
          <span className="label">Formato risultato</span>
          <div className="flex flex-col gap-2 mt-1">
            {FORMATI.map((f) => (
              <label key={f.value} className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="formato"
                  value={f.value}
                  defaultChecked={f.value === DEFAULT_FORMATO}
                  disabled={pending}
                  onChange={() => setFormato(f.value)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-[var(--brand-blue)]">{f.label}</span>
                  <span className="text-gray-500"> — {f.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {state.error ? <p className="field-error">{state.error}</p> : null}

        {pending ? (
          <div className="flex items-center gap-3">
            <span className="inline-block w-4 h-4 border-2 border-[var(--brand-gray)] border-t-[var(--brand-blue)] rounded-full animate-spin" />
            <span className="text-sm text-gray-500">
              Elaborazione in corso… (OCR e traduzione possono richiedere qualche minuto)
            </span>
          </div>
        ) : (
          <button
            type="submit"
            className="bg-[var(--brand-blue)] text-white font-medium py-2 px-6 rounded hover:bg-opacity-90 transition-colors shadow-sm self-start"
          >
            Traduci
          </button>
        )}
      </div>
    </form>
  );
}
