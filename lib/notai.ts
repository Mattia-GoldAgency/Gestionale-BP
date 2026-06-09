// Elenco dei notai dello Studio Busani & Partners.
// Fonte: indicazione diretta dello Studio (3 notai). Valore stabile lato app.

export interface Notaio {
  id: string;
  nome: string;
}

export const NOTAI: readonly Notaio[] = [
  { id: "busani", nome: "Angelo Busani" },
  { id: "mannella", nome: "Giuseppe Ottavio Mannella" },
  { id: "ridella", nome: "Giacomo Ridella" },
] as const;

export function notaioById(id: string): Notaio | undefined {
  return NOTAI.find((n) => n.id === id);
}
