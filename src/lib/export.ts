import { strToU8, zipSync } from "fflate";

export interface ColonneExport {
  cle: string;
  libelle: string;
}

type Valeur = string | number | boolean | null | undefined;
export type LigneExport = Record<string, Valeur>;

function texteCellule(v: Valeur): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v).replace(".", ",");
  if (typeof v === "boolean") return v ? "vrai" : "faux";
  return v;
}

/** CSV à la française : séparateur point-virgule, virgule décimale, BOM UTF-8 pour Excel. */
export function versCSV(lignes: readonly LigneExport[], colonnes: readonly ColonneExport[]): string {
  const echapper = (t: string) => (/[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
  const entete = colonnes.map((c) => echapper(c.libelle)).join(";");
  const corps = lignes.map((l) => colonnes.map((c) => echapper(texteCellule(l[c.cle]))).join(";"));
  return "﻿" + [entete, ...corps].join("\r\n") + "\r\n";
}

function xmlEchapper(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function nomColonne(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export interface FeuilleExport {
  nom: string;
  colonnes: readonly ColonneExport[];
  lignes: readonly LigneExport[];
}

function feuilleXML(feuille: FeuilleExport): string {
  const rangee = (index: number, cellules: string[]) => `<row r="${index}">${cellules.join("")}</row>`;
  const entete = feuille.colonnes.map((c, j) => `<c r="${nomColonne(j)}1" t="inlineStr" s="1"><is><t>${xmlEchapper(c.libelle)}</t></is></c>`);
  const corps = feuille.lignes.map((l, i) =>
    rangee(i + 2, feuille.colonnes.map((c, j) => {
      const v = l[c.cle];
      const ref = `${nomColonne(j)}${i + 2}`;
      if (v === null || v === undefined || v === "") return `<c r="${ref}"/>`;
      if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
      if (typeof v === "boolean") return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEchapper(String(v))}</t></is></c>`;
    })),
  );
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${rangee(1, entete)}${corps.join("")}</sheetData></worksheet>`;
}

/**
 * Classeur XLSX minimal (Office Open XML) écrit sans bibliothèque lourde : chaînes en ligne,
 * nombres natifs, en-tête gras et figé. Suffisant pour Excel, Numbers, LibreOffice et Power BI.
 */
export function versXLSX(feuilles: readonly FeuilleExport[]): Uint8Array {
  const nomFeuille = (nom: string) => xmlEchapper(nom.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  const fichiers: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${feuilles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${feuilles.map((f, i) => `<sheet name="${nomFeuille(f.nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${feuilles.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="1" fillId="0" borderId="0" applyFont="1"/></cellXfs></styleSheet>`),
  };
  feuilles.forEach((f, i) => {
    fichiers[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(feuilleXML(f));
  });
  return zipSync(fichiers, { level: 6 });
}

/** Archive zip de fichiers texte (export Power BI). */
export function versZip(fichiers: Record<string, string | Uint8Array>): Uint8Array {
  const entrees: Record<string, Uint8Array> = {};
  for (const [nom, contenu] of Object.entries(fichiers)) entrees[nom] = typeof contenu === "string" ? strToU8(contenu) : contenu;
  return zipSync(entrees, { level: 6 });
}

export function telecharger(nom: string, contenu: string | Uint8Array, type: string): void {
  const blob = new Blob([contenu as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}

export function nomFichier(base: string, extension: string): string {
  const jour = new Date().toISOString().slice(0, 10);
  const propre = base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `buta-lyfh-${propre}-${jour}.${extension}`;
}
