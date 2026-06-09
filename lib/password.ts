import "server-only";
import { randomInt } from "node:crypto";

// Genera una password robusta e leggibile (no caratteri ambigui come O/0/l/1).
const MAIUSC = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MINUSC = "abcdefghijkmnpqrstuvwxyz";
const NUMERI = "23456789";
const SIMBOLI = "!@#$%&*?";

function pick(set: string): string {
  return set[randomInt(set.length)];
}

export function generaPassword(lunghezza = 14): string {
  const tutti = MAIUSC + MINUSC + NUMERI + SIMBOLI;
  // Garantisce almeno un carattere per categoria.
  const base = [pick(MAIUSC), pick(MINUSC), pick(NUMERI), pick(SIMBOLI)];
  for (let i = base.length; i < lunghezza; i++) base.push(pick(tutti));
  // Mescola (Fisher-Yates con randomInt).
  for (let i = base.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join("");
}
