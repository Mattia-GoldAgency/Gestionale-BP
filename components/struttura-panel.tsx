import type { StrutturaReport } from "@/lib/backend";

// Pannello "Segnalazioni di struttura": normalmente vuoto/verde (l'atto esce già
// corretto). Mostra in evidenza i rari casi dubbi e, ripiegabile, il riepilogo
// delle correzioni automatiche applicate. Nessun PII: solo etichette e rubriche.
export function StrutturaPanel({
  struttura,
}: {
  struttura?: StrutturaReport | null;
}) {
  if (!struttura) return null;
  const dubbi = struttura.dubbi ?? [];
  const correzioni = struttura.correzioni ?? [];

  return (
    <div className="flex flex-col gap-2 text-sm">
      {dubbi.length > 0 ? (
        <div
          className="rounded-md p-3 flex flex-col gap-1"
          style={{ border: "1px solid var(--border)", background: "rgba(234,179,8,0.06)" }}
        >
          <p className="font-medium">Da rivedere ({dubbi.length})</p>
          <ul className="list-disc pl-5" style={{ color: "var(--muted)" }}>
            {dubbi.map((d, i) => (
              <li key={`d${i}`}>{d.messaggio}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          ✓ Nessuna anomalia di struttura.
        </p>
      )}

      {correzioni.length > 0 ? (
        <details className="text-sm">
          <summary style={{ color: "var(--muted)", cursor: "pointer" }}>
            Correzioni automatiche applicate ({correzioni.length})
          </summary>
          <ul className="list-disc pl-5 mt-1" style={{ color: "var(--muted)" }}>
            {correzioni.map((c, i) => (
              <li key={`c${i}`}>{c.messaggio}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
