"use server";

import { redirect } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { logAudit, ipCorrente } from "@/lib/audit";

export interface LoginState {
  error?: string;
}

export async function signIn(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  if (!supabaseConfigured()) {
    return {
      error:
        "Supabase non è ancora configurato (variabili NEXT_PUBLIC_SUPABASE_*). Contatta l'amministratore.",
    };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Inserisci email e password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Credenziali non valide. Riprova." };
  }

  await logAudit({
    azione: "login",
    userId: data.user?.id,
    email: data.user?.email,
    ip: await ipCorrente(),
  });

  // redirect lancia un'eccezione di navigazione: deve stare fuori da try/catch.
  redirect("/dashboard");
}

export async function signOut() {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
