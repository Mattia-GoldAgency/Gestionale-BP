import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Convenzione "proxy" di Next.js 16 (ex middleware): refresh sessione + guardia rotte.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Esegui su tutte le rotte tranne /api (che gestiscono l'auth da sole),
  // asset statici e immagini.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
