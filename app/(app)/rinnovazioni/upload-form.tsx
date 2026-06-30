"use client";

import { useActionState, useEffect, useState } from "react";
import { avviaRinnovazione, finalizzaRinnovazione, type AvviaState } from "./actions";
import { FileDrop } from "./file-drop";
import { AGEVOLAZIONI, AGEVOLAZIONI_DEFAULT } from "@/lib/agevolazioni";

const ACCEPT_PERIMETRO = ".doc,.docx";
const ACCEPT_PDF = ".pdf";

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_MS = 30 * 60 * 1000; // 30 minuti: limite di sicurezza del polling
const POLL_MAX_FAILS = 5; // errori consecutivi del polling prima di arrendersi (~12,5s)

type Fase = "idle" | "polling" | "finalizing" | "done" | "error";

const initial: AvviaState = {};

function asStringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function asNum(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}

// Riquadro avvisi/elenco (scoperti, campi incerti, blocchi). Niente se vuoto.
function ElencoAvvisi({ titolo, voci, tono }: { titolo: string; voci: string[]; tono: "giallo" | "rosso" }) {
  if (!voci.length) return null;
  const cls =
    tono === "rosso"
      ? "bg-red-50 border-red-200 text-red-800"
      : "bg-amber-50 border-amber-200 text-amber-800";
  return (
    <div className={`text-left text-xs rounded border px-3 py-2 ${cls}`}>
      <p className="font-semibold mb-1">{titolo}</p>
      <ul className="list-disc list-inside space-y-0.5">
        {voci.slice(0, 30).map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
      {voci.length > 30 ? <p className="mt-1 opacity-70">…e altri {voci.length - 30}.</p> : null}
    </div>
  );
}

function Conteggi({ report }: { report: Record<string, unknown> }) {
  const nImm = asNum(report.n_immobili);
  const nUnita = asNum(report.n_unita);
  const nSogg = asNum(report.n_soggetti);
  const nSup = asNum(report.n_superfici_iniettate);
  const voci: { label: string; value: number | null }[] = [
    { label: "Immobili", value: nImm },
    { label: "Unità negoziali", value: nUnita },
    { label: "Soggetti", value: nSogg },
    { label: "Superfici inserite", value: nSup },
  ].filter((x) => x.value !== null);
  if (!voci.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-md">
      {voci.map((v) => (
        <div key={v.label} className="rounded bg-gray-50 border border-gray-100 px-3 py-2 text-center">
          <div className="text-lg font-semibold text-[var(--brand-blue)]">{v.value}</div>
          <div className="text-[11px] text-gray-500">{v.label}</div>
        </div>
      ))}
    </div>
  );
}

export function RinnovazioniForm() {
  const [avvio, formAction, pending] = useActionState(avviaRinnovazione, initial);
  const [perimetroName, setPerimetroName] = useState<string | null>(null);
  const [notaName, setNotaName] = useState<string | null>(null);
  const [visureNames, setVisureNames] = useState<string[]>([]);

  // Macchina a stati del flusso asincrono (avvio → polling → finalizza → esito).
  const [fase, setFase] = useState<Fase>("idle");
  const [progresso, setProgresso] = useState(0);
  const [faseLabel, setFaseLabel] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [semaforo, setSemaforo] = useState<string | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [bloccante, setBloccante] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  // Reagisce all'esito dell'avvio e guida il polling fino al completamento.
  useEffect(() => {
    const jobId = avvio.jobId;
    const praticaId = avvio.praticaId;
    const start = Date.now();
    let cancelled = false;
    let falliti = 0; // poll consecutivi falliti (rete o errore backend)
    let timer: ReturnType<typeof setTimeout>;

    const begin = () => {
      if (cancelled) return;
      if (avvio.error) {
        setErrore(avvio.error);
        setFase("error");
        return;
      }
      // Path mock (nessun backend): esito già pronto (download o blocco rosso).
      if (avvio.downloadUrl || avvio.bloccante || avvio.semaforo === "rosso") {
        setDownloadUrl(avvio.downloadUrl ?? null);
        setSemaforo(avvio.semaforo ?? null);
        setReport(avvio.report ?? null);
        setBloccante(avvio.bloccante ?? null);
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
        setErrore("Tempo di elaborazione superato. Riprova più tardi.");
        setFase("error");
        return;
      }
      try {
        const res = await fetch(`/api/rinnovazioni/${jobId}`, { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          // Sessione persa: riprovare non aiuta.
          setErrore("Sessione scaduta. Ricarica la pagina ed effettua di nuovo l'accesso.");
          setFase("error");
          return;
        }
        if (!res.ok) {
          // Errore del backend (es. 502): può essere transitorio. Riprova qualche
          // volta e poi arrenditi, invece di girare in silenzio fino al timeout.
          if (++falliti >= POLL_MAX_FAILS) {
            setErrore("Il servizio non risponde. Riprova tra qualche minuto.");
            setFase("error");
            return;
          }
          timer = setTimeout(tick, POLL_INTERVAL_MS);
          return;
        }
        falliti = 0;
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
          const fin = await finalizzaRinnovazione(praticaId, jobId);
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
          setBloccante(fin.bloccante ?? null);
          setFase("done");
          return;
        }
      } catch {
        // Errore di rete: conta come fallimento, arrenditi dopo qualche tentativo.
        if (cancelled) return;
        if (++falliti >= POLL_MAX_FAILS) {
          setErrore("Errore di rete ripetuto. Verifica la connessione e riprova.");
          setFase("error");
          return;
        }
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
  if (fase === "done") {
    const rep = report ?? {};
    const scoperti = asStringList(rep.incrocio);
    const incerti = asStringList(rep.campi_incerti);
    const avvisiPerimetro = asStringList(rep.avvisi_perimetro);
    const mancanti = asStringList(rep.campi_mancanti);
    const erroriPerimetro = asStringList(rep.errori_perimetro);

    // Semaforo rosso (nessun XML): blocco da risolvere.
    if (semaforo === "rosso" || !downloadUrl) {
      return (
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div className="text-xl font-title font-semibold text-[var(--brand-blue)]">
            Rinnovazione bloccata
          </div>
          <p className="text-sm" style={{ color: "#dc2626" }}>
            Controllo qualità: <strong>rosso</strong> — manca un dato obbligatorio, l&apos;XML non è stato generato.
          </p>
          {bloccante ? <p className="field-error max-w-md">{bloccante}</p> : null}
          <div className="w-full max-w-md flex flex-col gap-2">
            <ElencoAvvisi titolo="Campi obbligatori mancanti" voci={mancanti} tono="rosso" />
            <ElencoAvvisi titolo="Righe immobile non lette dal perimetro" voci={erroriPerimetro} tono="rosso" />
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-[var(--brand-blue)] text-white font-medium py-2 px-6 rounded hover:bg-opacity-90 transition-colors shadow-sm"
          >
            Riprova
          </button>
        </div>
      );
    }

    const colore = semaforo === "verde" ? "#16a34a" : "#d97706";
    return (
      <div className="flex flex-col items-center text-center gap-4 py-6">
        <div className="text-2xl font-title font-semibold text-[var(--brand-blue)]">
          Nota di rinnovazione pronta
        </div>
        {semaforo ? (
          <p className="text-sm" style={{ color: colore }}>
            Controllo qualità: <strong>{semaforo}</strong>
            {semaforo === "giallo" ? " — XML generato, ma con avvisi da verificare." : null}
          </p>
        ) : null}

        <Conteggi report={rep} />

        <div className="w-full max-w-md flex flex-col gap-2">
          <ElencoAvvisi titolo="Immobili senza superficie (visura mancante o subalterni non coperti)" voci={scoperti} tono="giallo" />
          <ElencoAvvisi titolo="Dati da confermare" voci={incerti} tono="giallo" />
          <ElencoAvvisi titolo="Note sul perimetro (indirizzi abbreviati, diritto ereditato)" voci={avvisiPerimetro} tono="giallo" />
        </div>

        <div className="flex items-center gap-3 mt-1">
          <a
            href={downloadUrl}
            className="bg-[var(--brand-blue)] text-white font-medium py-2 px-6 rounded hover:bg-opacity-90 transition-colors shadow-sm"
          >
            Scarica l&apos;XML
          </a>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-[var(--brand-blue)] underline"
          >
            Nuova rinnovazione
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Importa l&apos;XML in SAPES. Disponibile al download per 15 giorni.
        </p>
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
        ? "Salvataggio dell'XML…"
        : fase === "polling"
        ? faseLabel ?? "Elaborazione in corso…"
        : "Caricamento dei documenti e avvio…";
    return (
      <div className="flex flex-col gap-4 py-8 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <span className="inline-block w-4 h-4 border-2 border-[var(--brand-gray)] border-t-[var(--brand-blue)] rounded-full animate-spin" />
          <span className="text-sm text-gray-600">{label}</span>
          {fase === "polling" ? (
            <span className="text-sm text-gray-400 ml-auto">{pct}%</span>
          ) : null}
        </div>
        <div className="w-full h-2 bg-gray-100 rounded overflow-hidden">
          <div
            className="h-full bg-[var(--brand-blue)] transition-all duration-500"
            style={{ width: `${Math.max(5, pct)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 text-center">
          La lettura del perimetro, della nota e delle visure può richiedere qualche minuto.
          Puoi lasciare questa pagina aperta.
        </p>
      </div>
    );
  }

  // --- Form -----------------------------------------------------------------
  return (
    <form action={formAction} className="grid gap-8 md:grid-cols-2">
      {/* Sinistra: i tre documenti */}
      <div className="flex flex-col gap-5">
        {/* Perimetro (Word) */}
        <FileDrop
          id="perimetro"
          name="perimetro"
          required
          accept={ACCEPT_PERIMETRO}
          label={
            <>
              Perimetro ipotecario <span className="text-gray-400 font-normal">(Word, Team Visure)</span>
            </>
          }
          boxText={perimetroName ?? "Trascina qui il perimetro o sfoglia"}
          boxHint="DOC, DOCX"
          onFiles={(files) => setPerimetroName(files[0]?.name ?? null)}
        />

        {/* Nota originaria (PDF) */}
        <FileDrop
          id="nota"
          name="nota"
          required
          accept={ACCEPT_PDF}
          label={
            <>
              Nota di iscrizione originaria <span className="text-gray-400 font-normal">(PDF)</span>
            </>
          }
          boxText={notaName ?? "Trascina qui la nota o sfoglia"}
          boxHint="PDF (ispezione AdE)"
          onFiles={(files) => setNotaName(files[0]?.name ?? null)}
        />

        {/* Visure (PDF, multiple) */}
        <FileDrop
          id="visure"
          name="visure"
          multiple
          accept={ACCEPT_PDF}
          label={
            <>
              Visure catastali <span className="text-gray-400 font-normal">(PDF, una o più)</span>
            </>
          }
          boxText={
            visureNames.length
              ? `${visureNames.length} visura${visureNames.length > 1 ? "e" : ""} selezionata${visureNames.length > 1 ? "e" : ""}`
              : "Trascina qui le visure o sfoglia"
          }
          boxHint="Senza visure le superfici restano da inserire (avviso giallo, non bloccante)."
          onFiles={(files) => setVisureNames(files.map((f) => f.name))}
        >
          {visureNames.length ? (
            <ul className="text-xs text-gray-500 mt-2 list-disc list-inside max-h-24 overflow-auto">
              {visureNames.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}
        </FileDrop>
      </div>

      {/* Destra: agevolazioni + richiedente */}
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="label">
            Agevolazioni <span className="text-gray-400 font-normal">(una o più)</span>
          </legend>
          <div className="flex flex-col gap-1.5 border border-[var(--brand-gray)] rounded px-3 py-2">
            {AGEVOLAZIONI.map((a) => (
              <label key={a.codice} className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  name="agevolazioni"
                  value={a.codice}
                  defaultChecked={AGEVOLAZIONI_DEFAULT.includes(a.codice)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">{a.codice}</span> — {a.descrizione}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Richiedente: per le rinnovazioni è sempre presente (visibile, non obbligatorio) */}
        <div className="flex flex-col gap-3">
          <p className="label">Richiedente</p>
          <div>
            <label className="label" htmlFor="denominazione_richiedente">
              Denominazione richiedente
            </label>
            <input id="denominazione_richiedente" name="denominazione_richiedente" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="cf_richiedente">
                CF / P.IVA richiedente
              </label>
              <input id="cf_richiedente" name="cf_richiedente" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="indirizzo_richiedente">
                Indirizzo richiedente
              </label>
              <input id="indirizzo_richiedente" name="indirizzo_richiedente" className="input" />
            </div>
          </div>
        </div>

        {avvio.error ? <p className="field-error">{avvio.error}</p> : null}

        <button
          type="submit"
          className="bg-[var(--brand-blue)] text-white font-medium py-2 px-6 rounded hover:bg-opacity-90 transition-colors shadow-sm self-start"
        >
          Genera la nota di rinnovazione
        </button>
      </div>
    </form>
  );
}
