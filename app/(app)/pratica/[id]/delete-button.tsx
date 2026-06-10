"use client";

import { useState } from "react";
import { eliminaPratica } from "./actions";

export function DeletePraticaButton({ praticaId }: { praticaId: string }) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (
      !confirm(
        "Eliminare definitivamente questa pratica e tutti i file associati? L'operazione non è reversibile."
      )
    )
      return;
    setPending(true);
    try {
      await eliminaPratica(praticaId);
    } catch {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-danger"
      onClick={onClick}
      disabled={pending}
    >
      {pending ? "Eliminazione…" : "Elimina pratica e file"}
    </button>
  );
}
