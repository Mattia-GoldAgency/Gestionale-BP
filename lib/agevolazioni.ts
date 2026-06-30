// Codici agevolazione fiscale del Modello Unico (Agevolazione/@Tipo nella DTD SAPES).
// Fonte: DTD Unico18012016 + sources/riferimento-xml-adempimento-unico.md del vault.
// La tabella completa è 0-20 (commento DTD): qui i codici di uso corrente per le
// rinnovazioni/iscrizioni. Default rinnovazione = 8 + 9.

export interface Agevolazione {
  codice: string;
  descrizione: string;
}

export const AGEVOLAZIONI: readonly Agevolazione[] = [
  { codice: "0", descrizione: "Nessuna" },
  { codice: "8", descrizione: "DPR 601/73 (credito a medio/lungo termine)" },
  { codice: "9", descrizione: "Credito fondiario a medio/lungo termine (TUB art. 39 c.7)" },
  { codice: "12", descrizione: "Cancellazione/restrizione (importo fisso)" },
  { codice: "15", descrizione: "Fondi rustici a coltivatori diretti" },
  { codice: "18", descrizione: "Esproprio per pubblica utilità" },
] as const;

// Codici pre-selezionati di default per una rinnovazione (output invariato vs golden).
export const AGEVOLAZIONI_DEFAULT: readonly string[] = ["8", "9"] as const;

export function agevolazioneByCodice(codice: string): Agevolazione | undefined {
  return AGEVOLAZIONI.find((a) => a.codice === codice);
}
