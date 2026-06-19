import Link from "next/link";
import Image from "next/image";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/roles";
import { signOut } from "@/app/login/actions";
import { PageTitle } from "./page-title";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;

  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } else {
    // Mock user for localhost UI preview
    user = { email: "mario.rossi@busani.it" } as any;
  }
  
  const isUserAdmin = isAdmin(user);
  
  // Compute initials from email (e.g. mario.rossi@... -> MR)
  const emailStr = user?.email || "";
  const initials = emailStr
    .split("@")[0]
    .split(".")
    .map((part: string) => part[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 2);
  const displayInitials = initials || "U";

  return (
    <div className="flex h-screen bg-[var(--brand-light)] font-sans text-[var(--foreground)] antialiased overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[var(--brand-blue)] text-white flex flex-col shadow-xl z-20 shrink-0">
        <div className="p-6 border-b border-[#3d5970] flex items-center justify-center">
          <Image
            src="/logo-busani-white.svg"
            alt="Busani & Partners Logo"
            width={505}
            height={510}
            priority
            className="w-48 h-auto"
          />
        </div>
        
        <nav className="flex-1 py-6 overflow-y-auto">
          <ul className="space-y-1">
            <li>
              <Link href="/dashboard" className="flex items-center px-6 py-3 hover:bg-[#345168] hover:text-white transition-colors text-[var(--brand-gray)]">
                <svg className="w-5 h-5 mr-3 opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                Dashboard
              </Link>
            </li>
            <li>
              <Link href="/storico" className="flex items-center px-6 py-3 hover:bg-[#345168] hover:text-white transition-colors text-[var(--brand-gray)]">
                <svg className="w-5 h-5 mr-3 opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Storico pratiche
              </Link>
            </li>
            {isUserAdmin && (
              <li>
                <Link href="/admin" className="flex items-center px-6 py-3 hover:bg-[#345168] hover:text-white transition-colors text-[var(--brand-gray)]">
                  <svg className="w-5 h-5 mr-3 opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  Admin
                </Link>
              </li>
            )}
          </ul>
        </nav>
        
        <div className="p-6 border-t border-[#3d5970]">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-[var(--brand-gray)] text-[var(--brand-blue)] flex items-center justify-center font-bold text-sm shrink-0 shadow-sm border border-[#3d5970]">
              {displayInitials}
            </div>
            <div className="ml-3 overflow-hidden text-ellipsis whitespace-nowrap">
              <p className="text-sm font-medium">{user?.email}</p>
              <p className="text-xs text-[var(--brand-gray)]">{isUserAdmin ? "Amministratore" : "Collaboratore"}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm z-10 border-b border-[var(--brand-gray)] shrink-0">
          <div className="flex items-center justify-between px-8 py-4">
            <PageTitle />
            <div className="flex items-center space-x-4">
              <form action={signOut}>
                <button type="submit" className="px-4 py-1.5 text-sm font-semibold text-[var(--brand-blue)] border border-[var(--brand-gray)] rounded hover:border-[var(--brand-blue)] hover:bg-[var(--brand-blue)] hover:text-white transition-all shadow-sm">
                  Logout
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-auto p-8 relative">
          {children}
        </div>
      </main>
    </div>
  );
}
