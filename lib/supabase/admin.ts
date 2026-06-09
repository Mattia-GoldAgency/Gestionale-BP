import "server-only";
import { createClient } from "@supabase/supabase-js";

// Client con privilegi service_role: BYPASSA la RLS. Usare ESCLUSIVAMENTE in
// Server Action / Route Handler protetti da guardia admin. Mai lato client.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata.");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function serviceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
