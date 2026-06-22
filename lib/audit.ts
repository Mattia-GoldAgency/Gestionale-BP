import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "./supabase/admin";

export type AzioneAudit =
  | "login"
  | "upload_pratica"
  | "genera_atto"
  | "download_atto"
  | "download_relazione"
  | "upload_traduzione"
  | "download_traduzione_pronta"
  | "elimina_pratica"
  | "retention_purge"
  | "crea_utente"
  | "elimina_utente"
  | "cambia_sezioni"
  | "backfill_sezioni";

export interface AuditEntry {
  azione: AzioneAudit;
  userId?: string | null;
  email?: string | null;
  dettagli?: Record<string, unknown>;
  praticaId?: string | null;
  ip?: string | null;
}

// Registra un evento di audit. Non deve mai far fallire l'operazione chiamante.
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      user_id: entry.userId ?? null,
      email: entry.email ?? null,
      azione: entry.azione,
      dettagli: entry.dettagli ?? null,
      pratica_id: entry.praticaId ?? null,
      ip: entry.ip ?? (await ipCorrente()),
    });
  } catch {
    // log best-effort: ignora gli errori per non bloccare il flusso.
  }
}

export async function ipCorrente(): Promise<string | null> {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null
    );
  } catch {
    return null;
  }
}
