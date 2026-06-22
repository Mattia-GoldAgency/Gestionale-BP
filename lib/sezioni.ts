import type { User } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/roles";

// Registro centrale delle sezioni soggette a permesso per-utente.
// Punto unico di verità: per aggiungere una sezione controllabile in futuro
// basta una riga qui (e i toggle nell'Admin, il blocco nel middleware e il
// filtro delle card si adeguano da soli).
//
// NB: lo Storico pratiche NON è qui: è SEMPRE accessibile (ognuno vede solo le
// proprie pratiche via RLS).

export interface SezioneApp {
  // chiave stabile salvata in app_metadata.sezioni_abilitate
  chiave: string;
  // etichetta mostrata nelle card / nell'Admin
  etichetta: string;
  // destinazione principale (link della card in dashboard)
  href: string;
  // descrizione mostrata nella card
  descrizione: string;
  // prefissi URL protetti da questo permesso (una sezione può avere più rotte:
  // es. "Scrittura atti" copre sia l'hub /scrittura-atti sia lo strumento /mutui)
  rotte: string[];
}

export const SEZIONI_CONTROLLATE: SezioneApp[] = [
  {
    chiave: "scrittura-atti",
    etichetta: "Scrittura atti",
    href: "/scrittura-atti",
    descrizione: "Sezione dedicata alla redazione e automazione degli atti.",
    rotte: ["/scrittura-atti", "/mutui"],
  },
  {
    chiave: "traduzioni",
    etichetta: "Traduzioni e Trascrizioni testo",
    href: "/traduzioni",
    descrizione: "Servizio di traduzione e trascrizione dei documenti.",
    rotte: ["/traduzioni"],
  },
];

// Tutte le chiavi sezione attualmente esistenti.
export const CHIAVI_SEZIONI = SEZIONI_CONTROLLATE.map((s) => s.chiave);

type UtentePermessi =
  | Pick<User, "email" | "user_metadata" | "app_metadata">
  | null;

// Insieme delle sezioni a cui l'utente può accedere.
// - admin: tutte (sempre)
// - collaboratore: quelle elencate in app_metadata.sezioni_abilitate
//   (opt-in: assente/non valido => nessuna)
export function sezioniAbilitateDi(user: UtentePermessi): Set<string> {
  if (isAdmin(user)) return new Set(CHIAVI_SEZIONI);
  const raw = user?.app_metadata?.sezioni_abilitate;
  if (!Array.isArray(raw)) return new Set<string>();
  return new Set(raw.filter((c): c is string => typeof c === "string"));
}

export function puoAccedere(user: UtentePermessi, chiave: string): boolean {
  return sezioniAbilitateDi(user).has(chiave);
}

// Data una path, restituisce la sezione controllata a cui appartiene (o null).
// Usata dal middleware per bloccare l'accesso diretto via URL.
export function sezionePerPath(path: string): SezioneApp | null {
  for (const s of SEZIONI_CONTROLLATE) {
    for (const r of s.rotte) {
      if (path === r || path.startsWith(r + "/")) return s;
    }
  }
  return null;
}
