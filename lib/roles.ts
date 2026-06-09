import type { User } from "@supabase/supabase-js";

export type Ruolo = "admin" | "collaboratore";

// Admin "di sistema": garantiti tali anche senza metadata (fail-safe).
export const ADMIN_EMAILS = ["mattia.bottoni@notaio-busani.it"];

export function ruoloDi(user: Pick<User, "email" | "user_metadata"> | null): Ruolo {
  if (!user) return "collaboratore";
  const email = (user.email ?? "").toLowerCase();
  if (ADMIN_EMAILS.includes(email)) return "admin";
  const r = user.user_metadata?.role;
  return r === "admin" ? "admin" : "collaboratore";
}

export function isAdmin(user: Pick<User, "email" | "user_metadata"> | null): boolean {
  return ruoloDi(user) === "admin";
}

// L'utente deve cambiare password al primo accesso?
export function deveCambiarePassword(
  user: Pick<User, "user_metadata"> | null
): boolean {
  return Boolean(user?.user_metadata?.must_change_password);
}
