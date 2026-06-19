"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  creaUtente,
  resetPassword,
  eliminaUtente,
  cambiaRuolo,
  type UtenteRiga,
} from "./actions";
import type { Ruolo } from "@/lib/roles";

interface Credenziale {
  email: string;
  password: string;
  tipo: "nuovo" | "reset";
}

export function UsersManager({ utenti }: { utenti: UtenteRiga[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reveals, setReveals] = useState<Credenziale[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [ruolo, setRuolo] = useState<Ruolo>("collaboratore");

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const filteredUtenti = utenti.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()));
  const sortedUtenti = [...filteredUtenti].sort((a, b) => {
    const cmp = a.email.localeCompare(b.email);
    return sortOrder === "asc" ? cmp : -cmp;
  });

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("email", email);
    fd.set("ruolo", ruolo);
    const res = await creaUtente({}, fd);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.ok) {
      setReveals((r) => [{ ...res.ok!, tipo: "nuovo" }, ...r]);
      setEmail("");
      refresh();
    }
  }

  async function onReset(id: string) {
    setError(null);
    const fd = new FormData();
    fd.set("id", id);
    const res = await resetPassword({}, fd);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.ok) {
      setReveals((r) => [{ ...res.ok!, tipo: "reset" }, ...r]);
      refresh();
    }
  }

  async function onDelete(id: string, em: string) {
    if (!confirm(`Eliminare definitivamente l'utente ${em}?`)) return;
    const fd = new FormData();
    fd.set("id", id);
    try {
      await eliminaUtente(fd);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    }
  }

  async function onRole(id: string, nuovo: Ruolo) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("ruolo", nuovo);
    try {
      await cambiaRuolo(fd);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {reveals.length > 0 ? (
        <div
          className="card p-4"
          style={{ borderColor: "var(--giallo)", background: "color-mix(in srgb, var(--giallo) 8%, white)" }}
        >
          <p className="text-sm font-title" style={{ color: "var(--giallo)" }}>
            ⚠️ Credenziali mostrate una sola volta — copiale e consegnale in modo sicuro.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {reveals.map((c, i) => (
              <li key={i} className="text-sm font-mono flex items-center gap-2 flex-wrap">
                <span>{c.email}</span>
                <span className="select-all px-2 py-0.5 rounded" style={{ background: "var(--brand-gray)" }}>
                  {c.password}
                </span>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() => navigator.clipboard?.writeText(`${c.email} ${c.password}`)}
                >
                  copia
                </button>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  ({c.tipo === "nuovo" ? "nuovo utente" : "reset"} · cambio obbligatorio al 1° accesso)
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form onSubmit={onCreate} className="card p-5 flex flex-col gap-4">
        <h3 className="text-base">Nuovo utente</h3>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="new-email">Email</label>
            <input
              id="new-email"
              type="email"
              className="input"
              placeholder="nome.cognome@notaio-busani.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="new-ruolo">Ruolo</label>
            <select
              id="new-ruolo"
              className="select"
              value={ruolo}
              onChange={(e) => setRuolo(e.target.value as Ruolo)}
            >
              <option value="collaboratore">Collaboratore</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            Crea utente
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          La password viene generata automaticamente e mostrata qui sopra una sola volta.
        </p>
      </form>

      {error ? <p className="field-error">{error}</p> : null}

      <div className="card overflow-hidden">
        <div className="p-4 flex flex-wrap gap-4 items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <input
            type="search"
            className="input max-w-sm"
            placeholder="Cerca utente per email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-ghost text-sm"
            style={{ padding: "0.4rem 0.8rem" }}
            onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")}
          >
            Ordina: {sortOrder === "asc" ? "A-Z ↓" : "Z-A ↑"}
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Ruolo</th>
              <th>1° accesso</th>
              <th>Ultimo accesso</th>
              <th style={{ textAlign: "right" }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {sortedUtenti.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>
                  <select
                    className="select"
                    style={{ padding: "0.3rem 0.5rem", width: "auto" }}
                    value={u.ruolo}
                    onChange={(e) => onRole(u.id, e.target.value as Ruolo)}
                  >
                    <option value="collaboratore">Collaboratore</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>
                  {u.mustChange ? (
                    <span style={{ color: "var(--giallo)" }}>da cambiare</span>
                  ) : (
                    <span style={{ color: "var(--verde)" }}>ok</span>
                  )}
                </td>
                <td className="text-sm" style={{ color: "var(--muted)" }}>
                  {u.ultimoAccesso
                    ? new Date(u.ultimoAccesso).toLocaleString("it-IT")
                    : "mai"}
                </td>
                <td>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: "0.35rem 0.7rem" }}
                      onClick={() => onReset(u.id)}
                    >
                      Reset password
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: "0.35rem 0.7rem" }}
                      onClick={() => onDelete(u.id, u.email)}
                    >
                      Elimina
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
