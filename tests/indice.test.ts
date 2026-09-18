import { describe, expect, it } from "vitest";
import { POIDS_DEFAUT, calculerIndice, poidsParDefaut, recalculerIndices } from "@/lib/indice";

// Charente-Maritime dans mart_marche_departement au 17 septembre 2026.
const CHARENTE_MARITIME = { volume: 70.53, intensiteFioul: 33.68, intensiteFg: 24.21, frein: 50.53, saturation: 66.32 };

describe("calculerIndice", () => {
  it("retrouve l'indice de la vue aux poids par défaut", () => {
    expect(calculerIndice(CHARENTE_MARITIME)).toBe(30.98);
  });

  it("normalise les poids positifs et applique les pénalités", () => {
    // Tout le poids sur le volume : 70,53 × (1 - 0,3 × 0,5053) × (1 - 0,3 × 0,6632) = 47,93
    expect(calculerIndice(CHARENTE_MARITIME, { ...POIDS_DEFAUT, volume: 1, intensiteFioul: 0, intensiteFg: 0 })).toBe(47.93);
    // Sans pénalité : moyenne pondérée seule.
    expect(calculerIndice(CHARENTE_MARITIME, { ...POIDS_DEFAUT, frein: 0, saturation: 0 })).toBe(45.58);
    // Poids doublés : même résultat, la normalisation absorbe l'échelle.
    expect(calculerIndice(CHARENTE_MARITIME, { ...POIDS_DEFAUT, volume: 0.8, intensiteFioul: 0.6, intensiteFg: 0.6 })).toBe(30.98);
  });

  it("refuse une composante manquante ou des poids nuls", () => {
    expect(calculerIndice({ ...CHARENTE_MARITIME, frein: null })).toBeNull();
    expect(calculerIndice(CHARENTE_MARITIME, { ...POIDS_DEFAUT, volume: 0, intensiteFioul: 0, intensiteFg: 0 })).toBeNull();
  });
});

describe("recalculerIndices et poidsParDefaut", () => {
  it("trie par indice recalculé décroissant", () => {
    const liste = recalculerIndices([
      { code: "17", composantes: CHARENTE_MARITIME },
      { code: "75", composantes: { volume: 100, intensiteFioul: 0, intensiteFg: 86.32, frein: 100, saturation: 0 } },
    ], POIDS_DEFAUT);
    expect(liste.map((l) => l.code)).toEqual(["75", "17"]);
    expect(liste[0]?.indiceRecalcule).toBe(46.13);
  });

  it("détecte les poids par défaut", () => {
    expect(poidsParDefaut({ ...POIDS_DEFAUT })).toBe(true);
    expect(poidsParDefaut({ ...POIDS_DEFAUT, frein: 0.2 })).toBe(false);
  });
});
