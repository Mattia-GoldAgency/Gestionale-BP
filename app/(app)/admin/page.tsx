import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/roles";

import { UsersManager } from "./users-manager";
import { listaUtenti, salvaImpostazioni, ultimiAudit } from "./actions";

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

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/dashboard");

  const utenti = await listaUtenti();
  const audit = await ultimiAudit(50);

  const { data: settingsRows } = await supabase
    .from("app_settings")
    .select("key,value");
  const settings = Object.fromEntries(
    (settingsRows ?? []).map((r) => [r.key, r.value])
  );

  return (
    <>
      <main className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">Amministrazione</h1>
          <Link href="/dashboard" className="text-sm" style={{ color: "var(--muted)" }}>
            ← Dashboard
          </Link>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg">Utenti ({utenti.length})</h2>
          <UsersManager utenti={utenti} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg">Impostazioni base</h2>
          <form action={salvaImpostazioni} className="card p-5 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="nome_studio">Nome dello Studio</label>
                <input
                  id="nome_studio"
                  name="nome_studio"
                  className="input"
                  defaultValue={String(settings.nome_studio ?? "")}
                />
              </div>
              <div>
                <label className="label" htmlFor="retention_giorni">
                  Retention documenti (giorni)
                </label>
                <input
                  id="retention_giorni"
                  name="retention_giorni"
                  type="number"
                  min="1"
                  className="input"
                  defaultValue={String(settings.retention_giorni ?? 15)}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary self-start">
              Salva impostazioni
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg">Registro di audit (ultimi {audit.length})</h2>
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
                {audit.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ color: "var(--muted)" }}>
                      Nessun evento registrato.
                    </td>
                  </tr>
                ) : (
                  audit.map((a) => (
                    <tr key={a.id}>
                      <td className="text-sm" style={{ whiteSpace: "nowrap" }}>
                        {new Date(a.created_at).toLocaleString("it-IT")}
                      </td>
                      <td className="text-sm">{a.email ?? "—"}</td>
                      <td className="text-sm">{AZIONE_LABEL[a.azione] ?? a.azione}</td>
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
          </div>
        </section>
      </main>
    </>
  );
}
