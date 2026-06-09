"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm() {
  const router = useRouter();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (pwd.length < 10) {
      setError("La password deve avere almeno 10 caratteri.");
      return;
    }
    if (pwd !== confirm) {
      setError("Le due password non coincidono.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: pwd,
      data: { must_change_password: false },
    });
    setPending(false);

    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-6">
      <div>
        <label className="label" htmlFor="pwd">
          Nuova password
        </label>
        <input
          id="pwd"
          type="password"
          autoComplete="new-password"
          className="input"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          required
        />
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Almeno 10 caratteri.
        </p>
      </div>
      <div>
        <label className="label" htmlFor="confirm">
          Conferma password
        </label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>

      {error ? <p className="field-error">{error}</p> : null}

      <button type="submit" className="btn btn-primary mt-2" disabled={pending}>
        {pending ? "Salvataggio…" : "Imposta nuova password"}
      </button>
    </form>
  );
}
