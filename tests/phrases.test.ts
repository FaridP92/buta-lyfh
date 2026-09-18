import { describe, expect, it } from "vitest";
import { phrasesDuMois, sommerEffets, type FaitsMois } from "@/lib/phrases";

const base: FaitsMois = {
  perimetre: "le réseau",
  periodeLibelle: "septembre 2026",
  comparaisonLibelle: "l'objectif",
  caSigne: 2_940_000,
  caComparaison: 2_820_000,
  ventes: 312,
  ventesComparaison: 298,
  tauxMarge: 27.9,
  tauxMargeComparaison: 28.7,
  ecart: { total: 120_000, volume: 140_000, mix: 8_000, prix: 3_000, remise: -31_000, residuel: 0 },
  alertes: ["Bordeaux Métropole : coût par vente des leads achetés +44 % vs T1", "Nord : 73 dossiers à qualifier, référentiel en cours d'alignement"],
};

describe("phrasesDuMois", () => {
  it("écrit trois phrases sourcées et formatées à la française", () => {
    const [p1, p2, p3] = phrasesDuMois(base);
    expect(p1).toBe("Le réseau a signé 2,9 M€ HT sur septembre 2026, 4,3 % au-dessus de l'objectif (2,8 M€), avec 312 ventes contre 298.");
    expect(p2).toBe("L'écart de +120,0 k€ tient d'abord au volume (+140,0 k€, plus que l'écart lui-même, compensé par les autres effets) ; les remises retirent 31,0 k€.");
    expect(p3).toBe("Le taux de marge brute est à 27,9 %, -0,8 pt vs l'objectif ; 2 alertes du matin, dont : Bordeaux Métropole : coût par vente des leads achetés +44 % vs T1 ; Nord : 73 dossiers à qualifier, référentiel en cours d'alignement.");
  });

  it("mentionne le prorata du mois en cours", () => {
    const [p1] = phrasesDuMois({ ...base, prorata: { joursPublies: 16, joursMois: 30 } });
    expect(p1).toContain("au-dessus de l'objectif au prorata des 16 jours publiés sur 30 (2,8\u202FM€)");
  });

  it("dit l'absence de comparaison avec son motif", () => {
    const [p1] = phrasesDuMois({ ...base, comparaisonLibelle: "N-1", caComparaison: null, motifSansComparaison: "pas d'historique 2024" });
    expect(p1).toContain("comparaison indisponible : pas d'historique 2024");
  });

  it("gère l'écart négatif, la part de l'effet dominant et l'absence d'alerte", () => {
    const [p1, p2, p3] = phrasesDuMois({
      ...base, caSigne: 2_500_000, ecart: { total: -320_000, volume: -200_000, mix: -100_000, prix: 5_000, remise: -25_000, residuel: 0 },
      alertes: [], tauxMargeComparaison: null,
    });
    expect(p1).toContain("11,3 % en retrait de l'objectif");
    expect(p2).toBe("L'écart de -320,0 k€ tient d'abord au volume (-200,0 k€, soit 63 % de l'écart) ; le mix produit retire 100,0 k€.");
    expect(p3).toBe("Le taux de marge brute est à 27,9 % ; aucune alerte du matin.");
  });

  it("somme les effets de plusieurs mois", () => {
    expect(sommerEffets([])).toBeNull();
    expect(sommerEffets([{ total: 1, volume: 2, mix: 3, prix: 4, remise: 5, residuel: 0 }, { total: 10, volume: 20, mix: 30, prix: 40, remise: 50, residuel: 1 }]))
      .toEqual({ total: 11, volume: 22, mix: 33, prix: 44, remise: 55, residuel: 1 });
  });
});
