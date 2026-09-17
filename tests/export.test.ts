import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { nomFichier, versCSV, versXLSX } from "@/lib/export";

const colonnes = [
  { cle: "agence", libelle: "Agence" },
  { cle: "ca", libelle: "CA signé (€)" },
  { cle: "taux", libelle: "Taux ; virgule" },
];
const lignes = [
  { agence: "Saintonge", ca: 123456, taux: 31.5 },
  { agence: 'Bassin "d\'Arcachon"', ca: null, taux: 0 },
];

describe("versCSV", () => {
  it("écrit un CSV français avec BOM, point-virgule et virgule décimale", () => {
    const csv = versCSV(lignes, colonnes);
    expect(csv.startsWith("﻿")).toBe(true);
    const l = csv.replace("﻿", "").split("\r\n");
    expect(l[0]).toBe('Agence;CA signé (€);"Taux ; virgule"');
    expect(l[1]).toBe("Saintonge;123456;31,5");
    expect(l[2]).toBe('"Bassin ""d\'Arcachon""";;0');
  });
});

describe("versXLSX", () => {
  it("produit une archive OOXML lisible avec une feuille, des nombres et des chaînes", () => {
    const zip = versXLSX([{ nom: "Agences", colonnes, lignes }]);
    const fichiers = unzipSync(zip);
    expect(Object.keys(fichiers).sort()).toEqual([
      "[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml",
    ]);
    const feuille = strFromU8(fichiers["xl/worksheets/sheet1.xml"] as Uint8Array);
    expect(feuille).toContain('<c r="B2"><v>123456</v></c>');
    expect(feuille).toContain("<t>Saintonge</t>");
    expect(feuille).toContain("Bassin &quot;d'Arcachon&quot;");
    expect(feuille).toContain('<c r="B3"/>');
    expect(strFromU8(fichiers["xl/workbook.xml"] as Uint8Array)).toContain('name="Agences"');
  });
});

describe("nomFichier", () => {
  it("normalise le nom et date le fichier", () => {
    expect(nomFichier("Ventes et marge : agences", "csv")).toMatch(/^buta-lyfh-ventes-et-marge-agences-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
