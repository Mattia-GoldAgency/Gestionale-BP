// Codici agevolazione fiscale del Modello Unico (Agevolazione/@Tipo nella DTD SAPES).
// Fonte: DTD Unico18012016 + sources/riferimento-xml-adempimento-unico.md del vault.
// La tabella completa è 0-20 (commento DTD): per le rinnovazioni di uso corrente
// servono solo i codici 8 e 9 (entrambi pre-selezionati di default). Gli altri codici
// sono stati rimossi dalla tendina su richiesta operativa (2026-06-30).

export interface Agevolazione {
  codice: string;
  descrizione: string;
}

export const AGEVOLAZIONI: readonly Agevolazione[] = [
  { codice: "8", descrizione: "DPR 601/73 (credito a medio/lungo termine)" },
  { codice: "9", descrizione: "Credito fondiario a medio/lungo termine (TUB art. 39 c.7)" },
] as const;

// Codici pre-selezionati di default per una rinnovazione (output invariato vs golden).
export const AGEVOLAZIONI_DEFAULT: readonly string[] = ["8", "9"] as const;

export function agevolazioneByCodice(codice: string): Agevolazione | undefined {
  return AGEVOLAZIONI.find((a) => a.codice === codice);
}
