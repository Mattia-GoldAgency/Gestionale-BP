"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4 mt-6">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          placeholder="nome.cognome@studiobusani.it"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          placeholder="••••••••"
        />
      </div>

      {state.error ? <p className="field-error">{state.error}</p> : null}

      <button type="submit" className="btn btn-primary mt-2" disabled={pending}>
        {pending ? "Accesso in corso…" : "Accedi"}
      </button>
    </form>
  );
}
