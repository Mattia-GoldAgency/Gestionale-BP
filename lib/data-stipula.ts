// Formattazione della data di stipula nel formato dell'atto notarile.
//
// Esempio di riferimento (CLAUDE.md §4):
//   "L'anno duemilaventisei, il giorno venti del mese di maggio"
//
// NOTA: questa è una *anteprima* lato frontend per far rispettare il formato
// all'utente in fase di inserimento. La formattazione autoritativa finale è
// prodotta dal motore Python (atto_core/formatting/numbers.py) in fase di
// assemblaggio del DOCX. Qui non si decide il testo legale, si mostra solo
// come apparirà la data.

const UNITA = [
  "zero",
  "uno",
  "due",
  "tre",
  "quattro",
  "cinque",
  "sei",
  "sette",
  "otto",
  "nove",
  "dieci",
  "undici",
  "dodici",
  "tredici",
  "quattordici",
  "quindici",
  "sedici",
  "diciassette",
  "diciotto",
  "diciannove",
];

const DECINE = [
  "",
  "",
  "venti",
  "trenta",
  "quaranta",
  "cinquanta",
  "sessanta",
  "settanta",
  "ottanta",
  "novanta",
];

export const MESI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

// Cardinale italiano per 0-99 con elisione corretta (ventuno, ventotto, ventitré).
function cardinale0_99(n: number): string {
  if (n < 20) return UNITA[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  let decina = DECINE[d];
  if (u === 0) return decina;
  // Elisione della vocale finale davanti a "uno" e "otto"
  if (u === 1 || u === 8) decina = decina.slice(0, -1);
  // "tre" composto prende l'accento: ventitré, trentatré...
  const unita = u === 3 ? "tré" : UNITA[u];
  return decina + unita;
}

// Anni del 2000-2099 (range realistico per le stipule): "duemila" + resto.
export function annoInLettere(anno: number): string {
  if (anno >= 2000 && anno <= 2099) {
    const resto = anno - 2000;
    return resto === 0 ? "duemila" : "duemila" + cardinale0_99(resto);
  }
  // Fallback prudente fuori range: ritorna il numero così com'è.
  return String(anno);
}

// Giorno del mese. Convenzione notarile: il 1° si scrive "primo".
export function giornoInLettere(giorno: number): string {
  if (giorno === 1) return "primo";
  return cardinale0_99(giorno);
}

// Riceve una data ISO ("YYYY-MM-DD") e produce l'anteprima nel formato atto.
export function dataStipulaInLettere(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const anno = Number(m[1]);
  const mese = Number(m[2]);
  const giorno = Number(m[3]);
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
  return `L'anno ${annoInLettere(anno)}, il giorno ${giornoInLettere(
    giorno
  )} del mese di ${MESI[mese - 1]}`;
}
