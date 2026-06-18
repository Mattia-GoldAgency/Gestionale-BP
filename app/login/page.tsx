import Link from "next/link";
import Image from "next/image";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen bg-[var(--brand-light)] font-sans antialiased">
      {/* Left Column - Image/Brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-[var(--brand-blue)] flex-col justify-between p-12 relative overflow-hidden">
        <div className="relative z-10 w-64">
          <Image
            src="/logo-busani-white.svg"
            alt="Busani & Partners Logo"
            width={505}
            height={510}
            priority
            className="w-full h-auto"
          />
        </div>
        <div className="relative z-10">
          <h2 className="font-title text-4xl text-white font-light leading-tight">
            L&apos;eccellenza notarile<br />
            nell&apos;era digitale.
          </h2>
          <p className="text-[var(--brand-gray)] mt-4 max-w-md">
            Piattaforma riservata per la gestione delle pratiche e degli atti notarili dello studio Busani &amp; Partners.
          </p>
        </div>
        {/* Decorative geometric shape */}
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-white opacity-5 transform rotate-45"></div>
      </div>

      {/* Right Column - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md flex flex-col items-center lg:items-start">
          {/* Mobile logo */}
          <div className="lg:hidden w-48 mb-8 self-start">
            <Image
              src="/logo-busani.png"
              alt="Busani & Partners Logo"
              width={505}
              height={510}
              priority
              className="w-full h-auto"
            />
          </div>

          <h1 className="font-title font-semibold text-3xl text-[var(--brand-blue)] mb-2 self-start">
            Benvenuto
          </h1>
          <p className="text-gray-500 mb-8 self-start">Accedi al tuo account per continuare</p>

          <LoginForm />

          <p className="text-xs text-center lg:text-left mt-8 text-[var(--muted)] w-full">
            Gli account sono gestiti dall&apos;amministratore dello Studio.
            <br />
            <Link href="/privacy" className="underline hover:text-[var(--brand-blue)]">
              Informativa sul trattamento dei dati
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
