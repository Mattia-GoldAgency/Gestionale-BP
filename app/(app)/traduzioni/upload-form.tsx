"use client";

import { useActionState, useEffect, useState } from "react";
import { avviaTraduzione, finalizzaTraduzione, type AvviaState } from "./actions";

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
  { value: "solo_trascrizione", label: "Solo trascrizione", hint: "trascrizione del documento, senza traduzione" },
  { value: "solo_traduzione", label: "Solo traduzione", hint: "traduzione del testo del documento, senza trascrizione del documento originario" },
  { value: "originale_traduzione", label: "Trascrizione e traduzione", hint: "trascrizione e traduzione del documento" },
  { value: "bilingue", label: "Formato atto tabellare", hint: "tabella a due colonne formattato come da nostro atto" },
  { value: "mirror", label: "Testo a fronte", hint: "ogni paragrafo seguito dalla traduzione" },
];

const DEFAULT_FORMATO = "originale_traduzione";

const ACCEPT = ".pdf,.doc,.docx,.rtf,.odt,.jpg,.jpeg,.png,.tif,.tiff,.gif,.webp,.bmp";

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_MS = 30 * 60 * 1000; // 30 minuti: limite di sicurezza del polling

type Fase = "idle" | "polling" | "finalizing" | "done" | "error";

const initial: AvviaState = {};

function costoStimato(report: Record<string, unknown> | null): string | null {
  if (!report) return null;
  const c = report.costo_usd_stimato;
  if (typeof c !== "number" || !isFinite(c)) return null;
  return `$${c.toFixed(2)}`;
}

export function TraduzioniForm() {
  const [avvio, formAction, pending] = useActionState(avviaTraduzione, initial);
  const [fileName, setFileName] = useState<string | null>(null);
  const [formato, setFormato] = useState(DEFAULT_FORMATO);
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFileName(file.name);
      const fileInput = document.getElementById("documento") as HTMLInputElement;
      if (fileInput) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  // Macchina a stati del flusso asincrono (avvio → polling → finalizza → esito).
  const [fase, setFase] = useState<Fase>("idle");
  const [progresso, setProgresso] = useState(0);
  const [faseLabel, setFaseLabel] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [semaforo, setSemaforo] = useState<string | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  // Reagisce all'esito dell'avvio e guida il polling fino al completamento.
  // Gli aggiornamenti di stato sono differiti (setTimeout) per non eseguire
  // setState in modo sincrono nel corpo dell'effetto.
  useEffect(() => {
    const jobId = avvio.jobId;
    const praticaId = avvio.praticaId;
    const start = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const begin = () => {
      if (cancelled) return;
      if (avvio.error) {
        setErrore(avvio.error);
        setFase("error");
        return;
      }
      // Path mock (nessun backend): risultato già pronto.
      if (avvio.downloadUrl) {
        setDownloadUrl(avvio.downloadUrl);
        setSemaforo(avvio.semaforo ?? null);
        setFase("done");
        return;
      }
      if (!jobId || !praticaId) return;
      setErrore(null);
      setProgresso(0);
      setFaseLabel("In coda");
      setFase("polling");
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    const tick = async () => {
      if (!jobId || !praticaId) return;
      if (cancelled) return;
      if (Date.now() - start > POLL_MAX_MS) {
        setErrore("Tempo di elaborazione superato. Il documento potrebbe essere troppo lungo: riprova più tardi.");
        setFase("error");
        return;
      }
      try {
        const res = await fetch(`/api/traduzioni/${jobId}`, { cache: "no-store" });
        const data = (await res.json()) as {
          stato?: string;
          progresso?: number;
          fase?: string | null;
          errore?: string | null;
        };
        if (cancelled) return;
        if (typeof data.progresso === "number") setProgresso(data.progresso);
        if (data.fase) setFaseLabel(data.fase);

        if (data.stato === "completato" || data.stato === "errore") {
          setFase("finalizing");
          const fin = await finalizzaTraduzione(praticaId, jobId);
          if (cancelled) return;
          if (fin.pending) {
            // Stato non ancora consolidato: continua il polling.
            setFase("polling");
            timer = setTimeout(tick, POLL_INTERVAL_MS);
            return;
          }
          if (fin.error) {
            setErrore(fin.error);
            setFase("error");
            return;
          }
          setDownloadUrl(fin.downloadUrl ?? null);
          setSemaforo(fin.semaforo ?? null);
          setReport(fin.report ?? null);
          setFase("done");
          return;
        }
      } catch {
        // Errore di rete transitorio: riprova al tick successivo.
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    timer = setTimeout(begin, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [avvio]);

  // --- Esito pronto ---------------------------------------------------------
  if (fase === "done" && downloadUrl) {
    const colore =
      semaforo === "verde" ? "#16a34a" : semaforo === "rosso" ? "#dc2626" : "#d97706";
    const costo = costoStimato(report);
    return (
      <div className="flex flex-col items-center text-center gap-4 py-6">
        <div className="text-2xl font-title font-semibold text-[var(--brand-blue)]">
          Traduzione pronta
        </div>
        {semaforo ? (
          <p className="text-sm" style={{ color: colore }}>
            Controllo qualità: <strong>{semaforo}</strong>
          </p>
        ) : null}
        {costo ? (
          <p className="text-xs text-gray-500">Costo di elaborazione stimato: {costo}</p>
        ) : null}
        <div className="flex items-center gap-3">
          <a
            href={downloadUrl}
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

  // --- Errore ---------------------------------------------------------------
  if (fase === "error") {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-6">
        <div className="text-xl font-title font-semibold text-[var(--brand-blue)]">
          Elaborazione non riuscita
        </div>
        <p className="field-error">{errore ?? "Si è verificato un errore."}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-[var(--brand-blue)] text-white font-medium py-2 px-6 rounded hover:bg-opacity-90 transition-colors shadow-sm"
        >
          Riprova
        </button>
      </div>
    );
  }

  // --- In lavorazione (avvio + polling + finalizzazione) --------------------
  const working = pending || fase === "polling" || fase === "finalizing";
  if (working) {
    const pct = fase === "finalizing" ? 100 : progresso;
    const label =
      fase === "finalizing"
        ? "Salvataggio del documento…"
        : fase === "polling"
        ? faseLabel ?? "Elaborazione in corso…"
        : "Caricamento e avvio…";
    return (
      <div className="flex flex-col gap-4 py-8 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <span className="inline-block w-4 h-4 border-2 border-[var(--brand-gray)] border-t-[var(--brand-blue)] rounded-full animate-spin" />
          <span className="text-sm text-gray-600">{label}</span>
          {fase === "polling" ? (
            <span className="text-sm text-gray-400 ml-auto">{pct}%</span>
          ) : null}
        </div>
        <style>{`
          @keyframes pen-write {
            0%, 100% { transform: rotate(-15deg) translateY(0); }
            50% { transform: rotate(-5deg) translateY(-2px); }
          }
          .animate-pen {
            animation: pen-write 0.4s ease-in-out infinite;
            transform-origin: bottom left;
          }
        `}</style>
        <div className="relative w-full pt-8 pb-2">
          <div className="w-full h-2 bg-gray-100 rounded relative">
            <div
              className="h-full bg-[var(--brand-blue)] transition-all duration-500 rounded relative"
              style={{ width: `${Math.max(2, pct)}%` }}
            >
              <div className="absolute right-0 top-0 -translate-y-full translate-x-1/2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="white"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[var(--brand-blue)] animate-pen drop-shadow-md"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 text-center">
          OCR e traduzione possono richiedere alcuni minuti sui documenti lunghi. Puoi lasciare
          questa pagina aperta.
        </p>
      </div>
    );
  }

  // --- Form -----------------------------------------------------------------
  return (
    <form action={formAction} className="grid gap-8 md:grid-cols-2">
      {/* Sinistra: documento */}
      <div className="flex flex-col">
        <label className="label" htmlFor="documento">
          Documento da tradurre
        </label>
        <label
          htmlFor="documento"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 min-h-[180px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center px-4 py-8 cursor-pointer transition-colors ${
            dragActive 
              ? "border-[var(--brand-blue)] bg-[var(--brand-blue)]/5" 
              : "border-[var(--brand-gray)] bg-gray-50 hover:border-[var(--brand-blue)]"
          }`}
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
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </div>

      {/* Destra: opzioni */}
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="lingua_origine">
              Lingua documento
            </label>
            <select id="lingua_origine" name="lingua_origine" className="select" defaultValue="">
              <option value="">Auto-rileva</option>
              {LINGUE.map((l) => (
                <option key={l.code} value={l.code}>{l.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="lingua_destino">
              Lingua traduzione
            </label>
            <select
              id="lingua_destino"
              name="lingua_destino"
              className="select"
              defaultValue="it"
              disabled={formato === "solo_trascrizione"}
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

        {avvio.error ? <p className="field-error">{avvio.error}</p> : null}

        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Il controllo qualità completo verifica tutta la traduzione: sui documenti lunghi aumenta
          tempi e costi di elaborazione.
        </p>

        <button
          type="submit"
          className="bg-[var(--brand-blue)] text-white font-medium py-2 px-6 rounded hover:bg-opacity-90 transition-colors shadow-sm self-start"
        >
          Esegui
        </button>
      </div>
    </form>
  );
}
