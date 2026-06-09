import Link from "next/link";
import { Brand } from "@/components/brand";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-md p-8">
        <Brand subtitle="Accesso riservato ai collaboratori" />
        <LoginForm />
        <p
          className="text-xs text-center mt-6"
          style={{ color: "var(--muted)" }}
        >
          Gli account sono gestiti dall&apos;amministratore dello Studio.
          <br />
          <Link href="/privacy" className="underline">
            Informativa sul trattamento dei dati
          </Link>
        </p>
      </div>
    </main>
  );
}
