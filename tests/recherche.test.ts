import { describe, expect, it } from "vitest";
import { correspond, normaliser } from "@/lib/recherche";

describe("recherche de la palette", () => {
  it("ignore accents et casse", () => {
    expect(normaliser("Écart à l'objectif")).toBe("ecart a l'objectif");
    expect(correspond(normaliser("Bassin d'Arcachon ARC agence"), "arcachon")).toBe(true);
    expect(correspond(normaliser("Taux de marge brute TX_MARGE"), "Marge Brute")).toBe(true);
  });

  it("exige chaque mot de la requête", () => {
    expect(correspond(normaliser("Coût par vente CPV"), "cout lead")).toBe(false);
    expect(correspond(normaliser("Coût par vente CPV"), "cout  vente")).toBe(true);
    expect(correspond(normaliser("Ventes et marge"), "")).toBe(true);
  });
});
