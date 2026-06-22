"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin, type Ruolo, ADMIN_EMAILS } from "@/lib/roles";
import { CHIAVI_SEZIONI } from "@/lib/sezioni";
import { generaPassword } from "@/lib/password";
import { logAudit, ipCorrente } from "@/lib/audit";

// Verifica che il chiamante sia admin. Da invocare in ogni azione admin.
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user)) {
    throw new Error("Operazione non autorizzata.");
  }
  return user;
}

export interface UtenteRiga {
  id: string;
  email: string;
  ruolo: Ruolo;
  mustChange: boolean;
  creato: string;
  ultimoAccesso: string | null;
  sezioni: string[];
}

export async function listaUtenti(): Promise<UtenteRiga[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);

  return data.users
    .map((u) => {
      const email = (u.email ?? "").toLowerCase();
      const ruolo: Ruolo =
        ADMIN_EMAILS.includes(email) || u.user_metadata?.role === "admin"
          ? "admin"
          : "collaboratore";
      const sezRaw = u.app_metadata?.sezioni_abilitate;
      const sezioni = Array.isArray(sezRaw)
        ? sezRaw.filter((c): c is string => typeof c === "string")
        : [];
      return {
        id: u.id,
        email: u.email ?? "",
        ruolo,
        mustChange: Boolean(u.user_metadata?.must_change_password),
        creato: u.created_at,
        ultimoAccesso: u.last_sign_in_at ?? null,
        sezioni,
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
}

export interface CreaUtenteResult {
  error?: string;
  ok?: { email: string; password: string };
}

export async function creaUtente(
  _prev: CreaUtenteResult,
  formData: FormData
): Promise<CreaUtenteResult> {
  const me = await requireAdmin();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const ruolo = (String(formData.get("ruolo") ?? "collaboratore") as Ruolo);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Email non valida." };
  }

  const admin = createAdminClient();
  const password = generaPassword();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: ruolo, must_change_password: true },
    // Opt-in: il nuovo utente nasce senza sezioni controllate abilitate.
    // Sarà l'admin ad attivarle dalla griglia permessi.
    app_metadata: { sezioni_abilitate: [] },
  });
  if (error) return { error: error.message };

  await logAudit({
    azione: "crea_utente",
    userId: me.id,
    email: me.email,
    ip: await ipCorrente(),
    dettagli: { nuovoUtente: email, ruolo },
  });

  revalidatePath("/admin");
  return { ok: { email, password } };
}

export async function eliminaUtente(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  if (id === me.id) throw new Error("Non puoi eliminare il tuo stesso account.");
  const admin = createAdminClient();
  const { data: target } = await admin.auth.admin.getUserById(id);
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  await logAudit({
    azione: "elimina_utente",
    userId: me.id,
    email: me.email,
    ip: await ipCorrente(),
    dettagli: { utenteEliminato: target.user?.email ?? id },
  });
  revalidatePath("/admin");
}

export async function cambiaRuolo(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const ruolo = String(formData.get("ruolo") ?? "") as Ruolo;
  if (!id || (ruolo !== "admin" && ruolo !== "collaboratore")) return;
  if (id === me.id)
    throw new Error("Non puoi modificare il ruolo del tuo account.");

  const admin = createAdminClient();
  const { data: cur } = await admin.auth.admin.getUserById(id);
  const { error } = await admin.auth.admin.updateUserById(id, {
    user_metadata: { ...(cur.user?.user_metadata ?? {}), role: ruolo },
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

// Imposta le sezioni controllate abilitate per un utente. Le chiavi arrivano dai
// toggle dell'Admin (formData.getAll("sezioni")) e vengono validate contro il
// registro: nessuna chiave arbitraria può finire in app_metadata.
export async function aggiornaSezioniUtente(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const richieste = formData.getAll("sezioni").map((v) => String(v));
  const sezioni_abilitate = CHIAVI_SEZIONI.filter((c) => richieste.includes(c));

  const admin = createAdminClient();
  const { data: cur } = await admin.auth.admin.getUserById(id);
  const { error } = await admin.auth.admin.updateUserById(id, {
    app_metadata: {
      ...(cur.user?.app_metadata ?? {}),
      sezioni_abilitate,
    },
  });
  if (error) throw new Error(error.message);

  await logAudit({
    azione: "cambia_sezioni",
    userId: me.id,
    email: me.email,
    ip: await ipCorrente(),
    dettagli: { utente: cur.user?.email ?? id, sezioni: sezioni_abilitate },
  });
  revalidatePath("/admin");
}

export interface BackfillResult {
  error?: string;
  aggiornati?: number;
}

// One-time: abilita TUTTE le sezioni controllate attuali a TUTTI i collaboratori
// esistenti, per non togliere accesso a chi già lavora al primo rilascio.
// Gli admin sono saltati (hanno già accesso completo). Da premere una volta.
export async function backfillSezioniCorrenti(): Promise<BackfillResult> {
  const me = await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return { error: error.message };

  let aggiornati = 0;
  for (const u of data.users) {
    const email = (u.email ?? "").toLowerCase();
    const isUserAdmin =
      ADMIN_EMAILS.includes(email) || u.user_metadata?.role === "admin";
    if (isUserAdmin) continue;
    const { error: upErr } = await admin.auth.admin.updateUserById(u.id, {
      app_metadata: {
        ...(u.app_metadata ?? {}),
        sezioni_abilitate: CHIAVI_SEZIONI,
      },
    });
    if (!upErr) aggiornati++;
  }

  await logAudit({
    azione: "backfill_sezioni",
    userId: me.id,
    email: me.email,
    ip: await ipCorrente(),
    dettagli: { aggiornati, sezioni: CHIAVI_SEZIONI },
  });
  revalidatePath("/admin");
  return { aggiornati };
}

export interface ResetResult {
  error?: string;
  ok?: { email: string; password: string };
}

export async function resetPassword(
  _prev: ResetResult,
  formData: FormData
): Promise<ResetResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Utente non valido." };

  const admin = createAdminClient();
  const { data: cur } = await admin.auth.admin.getUserById(id);
  const password = generaPassword();
  const { error } = await admin.auth.admin.updateUserById(id, {
    password,
    user_metadata: {
      ...(cur.user?.user_metadata ?? {}),
      must_change_password: true,
    },
  });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: { email: cur.user?.email ?? "", password } };
}

// --- Registro di audit ---
export interface AuditRiga {
  id: string;
  created_at: string;
  email: string | null;
  azione: string;
  pratica_id: string | null;
  ip: string | null;
  dettagli: Record<string, unknown> | null;
}

export async function ultimiAudit(limit = 50): Promise<AuditRiga[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as AuditRiga[]) ?? [];
}

// --- Impostazioni base ---
export async function salvaImpostazioni(formData: FormData): Promise<void> {
  await requireAdmin();
  const nomeStudio = String(formData.get("nome_studio") ?? "").trim();
  const retention = parseInt(String(formData.get("retention_giorni") ?? ""), 10);

  const admin = createAdminClient();
  const updates: { key: string; value: unknown }[] = [];
  if (nomeStudio) updates.push({ key: "nome_studio", value: nomeStudio });
  if (!Number.isNaN(retention) && retention > 0)
    updates.push({ key: "retention_giorni", value: retention });

  for (const u of updates) {
    await admin
      .from("app_settings")
      .upsert({ key: u.key, value: u.value, updated_at: new Date().toISOString() });
  }
  revalidatePath("/admin");
}
