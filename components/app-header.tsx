import Link from "next/link";
import Image from "next/image";
import { signOut } from "@/app/login/actions";

export function AppHeader({
  email,
  isAdmin = false,
}: {
  email?: string | null;
  isAdmin?: boolean;
}) {
  return (
    <header
      className="w-full border-b"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Image
            src="/pittogramma-busani.svg"
            alt="Studio Notarile Busani &amp; Partners"
            width={505}
            height={510}
            priority
            className="h-7 w-auto"
          />
          <span className="font-title font-semibold tracking-tight">
            Gestionale Busani &amp; Partners
          </span>
        </Link>
        <div className="flex items-center gap-4">
          {isAdmin ? (
            <Link href="/admin" className="text-sm font-title" style={{ color: "var(--accent)" }}>
              Amministrazione
            </Link>
          ) : null}
          {email ? (
            <span className="text-sm" style={{ color: "var(--muted)" }}>
              {email}
            </span>
          ) : null}
          <form action={signOut}>
            <button type="submit" className="btn btn-ghost" style={{ padding: "0.4rem 0.8rem" }}>
              Esci
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
