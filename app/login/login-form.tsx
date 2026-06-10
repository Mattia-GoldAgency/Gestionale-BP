"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initial);

  return (
    <form action={formAction} className="flex flex-col gap-6 w-full">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="email">
          Indirizzo Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full px-0 py-2 bg-transparent border-0 border-b-2 border-[var(--brand-gray)] focus:ring-0 focus:border-[var(--brand-blue)] transition-colors text-[var(--brand-blue)] placeholder-gray-400"
          placeholder="nome.cognome@notaio-busani.it"
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700" htmlFor="password">
            Password
          </label>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full px-0 py-2 bg-transparent border-0 border-b-2 border-[var(--brand-gray)] focus:ring-0 focus:border-[var(--brand-blue)] transition-colors text-[var(--brand-blue)] placeholder-gray-400"
          placeholder="••••••••"
        />
      </div>

      {state.error ? <p className="field-error">{state.error}</p> : null}

      <button type="submit" className="w-full mt-4 bg-[var(--brand-blue)] text-white font-title font-semibold py-4 px-4 rounded shadow-lg hover:shadow-xl hover:bg-[#1f303e] transition-all duration-300 tracking-wide" disabled={pending}>
        {pending ? "ACCESSO IN CORSO…" : "ACCEDI ALLA PIATTAFORMA"}
      </button>
    </form>
  );
}
