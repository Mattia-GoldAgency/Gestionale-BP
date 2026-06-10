"use client";

import { useState, useMemo } from "react";
import type { AuditRiga } from "./actions";

const AZIONE_LABEL: Record<string, string> = {
  login: "Accesso",
  upload_pratica: "Upload pratica",
  genera_atto: "Generazione atto",
  download_atto: "Download atto",
  elimina_pratica: "Eliminazione pratica",
  retention_purge: "Pulizia retention",
  crea_utente: "Creazione utente",
  elimina_utente: "Eliminazione utente",
};

export function AuditClient({ initialAudit }: { initialAudit: AuditRiga[] }) {
  const [dataDal, setDataDal] = useState("");
  const [dataAl, setDataAl] = useState("");
  const [utenteFilter, setUtenteFilter] = useState("");

  const filteredAudit = useMemo(() => {
    return initialAudit.filter((a) => {
      let valid = true;
      const dataA = new Date(a.created_at);
      if (dataDal) {
        valid = valid && dataA >= new Date(dataDal);
      }
      if (dataAl) {
        // includi tutto il giorno "al"
        const end = new Date(dataAl);
        end.setHours(23, 59, 59, 999);
        valid = valid && dataA <= end;
      }
      if (utenteFilter) {
        valid = valid && (a.email?.toLowerCase().includes(utenteFilter.toLowerCase()) ?? false);
      }
      return valid;
    });
  }, [initialAudit, dataDal, dataAl, utenteFilter]);

  const [visibleCount, setVisibleCount] = useState(20);
  const visibleAudit = filteredAudit.slice(0, visibleCount);

  const exportCSV = () => {
    const headers = ["ID", "Data", "Utente", "Azione", "Pratica", "IP", "Dettagli"];
    const rows = filteredAudit.map(a => [
      a.id,
      new Date(a.created_at).toLocaleString("it-IT"),
      a.email || "",
      AZIONE_LABEL[a.azione] || a.azione,
      a.pratica_id || "",
      a.ip || "",
      a.dettagli ? JSON.stringify(a.dettagli).replace(/"/g, '""') : ""
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(f => `"${f}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `audit_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded border border-[var(--brand-gray)] flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Dal</label>
          <input type="date" className="input py-1 px-2 text-sm" value={dataDal} onChange={e => setDataDal(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Al</label>
          <input type="date" className="input py-1 px-2 text-sm" value={dataAl} onChange={e => setDataAl(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Utente (Email)</label>
          <input type="text" className="input py-1 px-2 text-sm" placeholder="Filtra per email..." value={utenteFilter} onChange={e => setUtenteFilter(e.target.value)} />
        </div>
        <div className="ml-auto">
          <button onClick={exportCSV} className="btn btn-primary py-1 px-3 text-sm hover:shadow-md transition-shadow">Esporta CSV</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Utente</th>
              <th>Azione</th>
              <th>Dettagli</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {visibleAudit.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)", textAlign: "center", padding: "2rem" }}>
                  Nessun evento registrato per i filtri selezionati.
                </td>
              </tr>
            ) : (
              visibleAudit.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="text-sm" style={{ whiteSpace: "nowrap" }}>
                    {new Date(a.created_at).toLocaleString("it-IT")}
                  </td>
                  <td className="text-sm">{a.email ?? "—"}</td>
                  <td className="text-sm font-medium">{AZIONE_LABEL[a.azione] ?? a.azione}</td>
                  <td className="text-xs" style={{ color: "var(--muted)" }}>
                    {a.dettagli ? JSON.stringify(a.dettagli) : "—"}
                  </td>
                  <td className="text-xs" style={{ color: "var(--muted)" }}>
                    {a.ip ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {visibleCount < filteredAudit.length && (
          <div className="flex justify-center p-4 border-t border-[var(--brand-gray)]">
            <button
              onClick={() => setVisibleCount(c => c + 50)}
              className="btn bg-[var(--brand-light)] hover:bg-[var(--brand-gray)] text-sm px-4 py-2 text-[var(--brand-blue)] border border-[var(--brand-gray)]"
            >
              Mostra altri
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
