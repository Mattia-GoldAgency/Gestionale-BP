import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_EMAILS } from "@/lib/roles";

// Aggiorna la sessione Supabase su ogni richiesta e protegge le rotte private.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Se Supabase non è configurato, lascia passare (le pagine mostrano un avviso).
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/login" || path === "/privacy" || path.startsWith("/auth");

  const redirectTo = (p: string) => {
    const url = request.nextUrl.clone();
    url.pathname = p;
    return NextResponse.redirect(url);
  };

  // Utente non autenticato su rotta privata -> login
  if (!user && !isPublic) return redirectTo("/login");

  if (user) {
    const mustChange = Boolean(user.user_metadata?.must_change_password);
    const email = (user.email ?? "").toLowerCase();
    const isAdmin =
      ADMIN_EMAILS.includes(email) ||
      user.user_metadata?.role === "admin";

    // Cambio password obbligatorio al primo accesso.
    if (mustChange && path !== "/cambia-password" && !isPublic) {
      return redirectTo("/cambia-password");
    }

    // Area admin riservata.
    if (path.startsWith("/admin") && !isAdmin) {
      return redirectTo("/dashboard");
    }

    // Utente autenticato che apre /login -> dashboard
    if (path === "/login") return redirectTo("/dashboard");
  }

  return supabaseResponse;
}
