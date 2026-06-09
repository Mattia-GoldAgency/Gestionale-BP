import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client Supabase per Server Component, Server Action e Route Handler.
// Usa la anon key + i cookie di sessione per agire come l'utente loggato (RLS attiva).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll chiamato da un Server Component: ignorabile se il
            // refresh della sessione è gestito dal middleware.
          }
        },
      },
    }
  );
}

// Indica se le variabili Supabase sono configurate (per messaggi UI chiari).
export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
