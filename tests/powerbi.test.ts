import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { construireZipPowerBi, modeleEtoile } from "@/lib/powerbi";

const VUES = [
  { nom: "mart_kpi_mensuel", lignes: [{ mois: "2026-08-01", agence: "SAI", ca_signe: 371500.5, taux_marge: 23.4 }, { mois: "2026-08-01", agence: "RESEAU", ca_signe: 1900000, taux_marge: null }] },
  { nom: "mart_alertes", lignes: [{ code: "CPV", agence: "BDX", texte: "Bordeaux Métropole ; coût par vente +48 %" }] },
];

describe("modeleEtoile", () => {
  it("décrit chaque table avec son grain, ses clés, ses lignes et ses colonnes", () => {
    const md = modeleEtoile(VUES, "17/09/2026", "18/09/2026");
    expect(md).toContain("| mart_kpi_mensuel.csv | fait | mois × agence (RESEAU = total) | mois, agence | 2 | mois, agence, ca_signe, taux_marge |");
    expect(md).toContain("journée publiée du 17/09/2026");
    expect(md).toContain("sans lien avec Butagaz");
    expect(md).not.toMatch(/[–—―]/);
  });
});

describe("construireZipPowerBi", () => {
  it("produit un zip avec un CSV par vue et le modèle en étoile", () => {
    const zip = unzipSync(construireZipPowerBi(VUES, null, "18/09/2026"));
    expect(Object.keys(zip).sort()).toEqual(["mart_alertes.csv", "mart_kpi_mensuel.csv", "modele_etoile.md"]);
    const csv = strFromU8(zip["mart_kpi_mensuel.csv"] as Uint8Array);
    // BOM UTF-8 en tête du fichier (le décodeur l'absorbe), puis l'en-tête.
    expect(Array.from((zip["mart_kpi_mensuel.csv"] as Uint8Array).slice(0, 3))).toEqual([239, 187, 191]);
    expect(csv.startsWith("mois;agence;ca_signe;taux_marge")).toBe(true);
    expect(csv).toContain("2026-08-01;SAI;371500,5;23,4");
    expect(csv).toContain("2026-08-01;RESEAU;1900000;");
    // Le point-virgule du texte est protégé par des guillemets.
    expect(strFromU8(zip["mart_alertes.csv"] as Uint8Array)).toContain('"Bordeaux Métropole ; coût par vente +48 %"');
  });
});
