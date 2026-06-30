import JSZip from "jszip";

// Costruttore di un .docx leggero e leggibile per il "report" della rinnovazione
// (si scarica accanto all'XML). Riusa l'approccio OOXML minimale di lib/docx.ts ma
// con un minimo di formattazione (titolo, sezioni in grassetto, elenchi puntati),
// così il report è subito comprensibile. Zero dipendenze nuove: solo JSZip (già usato).

export type StileRiga = "titolo" | "sottotitolo" | "sezione" | "normale" | "voce" | "spazio";

export interface RigaReport {
  testo: string;
  stile?: StileRiga;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Dimensioni in half-point (28 = 14pt). Grassetto e spaziatura per stile.
const STILI: Record<StileRiga, { sz: number; bold: boolean; after: number; prefisso?: string }> = {
  titolo: { sz: 32, bold: true, after: 80 },
  sottotitolo: { sz: 20, bold: false, after: 200 },
  sezione: { sz: 24, bold: true, after: 60 },
  normale: { sz: 22, bold: false, after: 60 },
  voce: { sz: 22, bold: false, after: 20, prefisso: "•  " },
  spazio: { sz: 12, bold: false, after: 0 },
};

function paragrafo({ testo, stile = "normale" }: RigaReport): string {
  const s = STILI[stile];
  const txt = esc((s.prefisso ?? "") + testo);
  const rPr = `<w:rPr>${s.bold ? "<w:b/>" : ""}<w:sz w:val="${s.sz}"/><w:szCs w:val="${s.sz}"/></w:rPr>`;
  return (
    `<w:p><w:pPr><w:spacing w:after="${s.after}"/></w:pPr>` +
    `<w:r>${rPr}<w:t xml:space="preserve">${txt}</w:t></w:r></w:p>`
  );
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

export async function buildReportDocx(righe: RigaReport[]): Promise<Blob> {
  const body = righe.map(paragrafo).join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr/></w:body>
</w:document>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.folder("_rels")!.file(".rels", RELS);
  zip.folder("word")!.file("document.xml", document);
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
