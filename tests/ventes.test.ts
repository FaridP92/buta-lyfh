import { describe, expect, it } from "vitest";
import { agregerVentes, agregerVentesPar, serieMensuelleParProduit, type LigneVenteProduit } from "@/lib/ventes";
import { expliquerEcart } from "@/lib/phrases";

function ligne(mois: string, agence: string, produit: string, partiel: Partial<LigneVenteProduit> = {}): LigneVenteProduit {
  return {
    mois, agence, produit, ventes: 10, signatures_brutes: 12, annulees_60j: 1, ca_signe: 100_000, marge_brute: 30_000,
    prix_catalogue_moyen: 10_400, taux_remise: 4, signatures_a_distance: 4, taux_annulation_a_distance: 25, taux_annulation_sur_place: 0,
    ...partiel,
  };
}

const LIGNES: LigneVenteProduit[] = [
  ligne("2026-01-01", "SAI", "PV3"),
  ligne("2026-02-01", "SAI", "PV3", { ventes: 20, signatures_brutes: 24, annulees_60j: 3, ca_signe: 180_000, marge_brute: 45_000, prix_catalogue_moyen: 10_000, taux_remise: 10, signatures_a_distance: 8, taux_annulation_a_distance: 12.5, taux_annulation_sur_place: 12.5 }),
  ligne("2026-03-01", "SAI", "PV3"),
  ligne("2026-02-01", "SAI", "PAC", { ventes: 5, ca_signe: 70_000, marge_brute: 14_000 }),
  ligne("2026-02-01", "ANG", "PV3", { ventes: 8, ca_signe: 80_000, marge_brute: 20_000 }),
];

describe("agregerVentes", () => {
  it("somme les mesures et recalcule les ratios depuis les sommes", () => {
    const a = agregerVentes(LIGNES.filter((l) => l.agence === "SAI" && l.produit === "PV3"), "2026-01", "2026-02");
    expect(a?.mois).toBe(2);
    expect(a?.ventes).toBe(30);
    expect(a?.ca_signe).toBe(280_000);
    expect(a?.taux_marge).toBe(26.8); // 75 000 / 280 000
    expect(a?.panier_moyen).toBe(9333);
    // Remise pondérée par le prix catalogue : (4 % × 104 000 + 10 % × 200 000) / 304 000 = 7,95 %
    expect(a?.taux_remise).toBe(7.9);
    expect(a?.taux_annulation).toBe(11.1); // 4 / 36
  });

  it("reconstitue les taux d'annulation à distance et sur place", () => {
    const a = agregerVentes(LIGNES.filter((l) => l.agence === "SAI" && l.produit === "PV3"), "2026-01", "2026-02");
    expect(a?.signatures_a_distance).toBe(12);
    expect(a?.signatures_sur_place).toBe(24);
    // (25 % × 4 + 12,5 % × 8) / 12 = 16,7 % ; (0 × 8 + 12,5 % × 16) / 24 = 8,3 %
    expect(a?.taux_annulation_a_distance).toBe(16.7);
    expect(a?.taux_annulation_sur_place).toBe(8.3);
  });

  it("renvoie null hors période", () => {
    expect(agregerVentes(LIGNES, "2025-01", "2025-12")).toBeNull();
  });
});

describe("agregerVentesPar", () => {
  it("groupe par produit sur la période", () => {
    const parProduit = agregerVentesPar(LIGNES.filter((l) => l.agence === "SAI"), "produit", "2026-02", "2026-02");
    expect([...parProduit.keys()]).toEqual(["PV3", "PAC"]);
    expect(parProduit.get("PAC")?.ca_signe).toBe(70_000);
    expect(parProduit.get("PAC")?.taux_marge).toBe(20);
  });

  it("groupe par agence", () => {
    const parAgence = agregerVentesPar(LIGNES.filter((l) => l.produit === "PV3"), "agence", "2026-01", "2026-03");
    expect(parAgence.get("SAI")?.ventes).toBe(40);
    expect(parAgence.get("ANG")?.ventes).toBe(8);
  });
});

describe("serieMensuelleParProduit", () => {
  it("aligne les produits sur les mois et calcule le taux de marge mensuel", () => {
    const s = serieMensuelleParProduit(LIGNES.filter((l) => l.agence === "SAI"), ["PV3", "PAC"], "2026-01", "2026-03", "ca_signe");
    expect(s.mois).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(s.series[0]?.valeurs).toEqual([100_000, 180_000, 100_000]);
    expect(s.series[1]?.valeurs).toEqual([null, 70_000, null]);
    expect(s.tauxMarge).toEqual([30, 23.6, 30]); // février : 59 000 / 250 000
  });
});

describe("expliquerEcart", () => {
  const faits = {
    perimetre: "le réseau", periodeLibelle: "août 2026", comparaisonLibelle: "l'objectif" as const,
    caRealise: 1_900_000, caComparaison: 2_044_000, ventes: 217, ventesComparaison: 231,
    tauxRemise: 4.6, tauxRemiseComparaison: 4,
    effets: { total: -144_000, volume: -120_000, mix: 3_000, prix: -5_000, remise: -22_000, residuel: 0 },
    journeePubliee: "17/09/2026",
  };

  it("écrit le constat avec l'écart en euros et en pourcentage", () => {
    const e = expliquerEcart(faits);
    expect(e.constat).toBe("Sur août 2026, le réseau signe 1,9\u202fM€ HT contre 2,0\u202fM€ pour l'objectif : écart de -144,0\u202fk€ (-7,0\u202f%).");
  });

  it("classe les causes par poids et détaille volume et remises", () => {
    const e = expliquerEcart(faits);
    expect(e.causes[0]).toBe("Le volume : -120,0\u202fk€ (217 ventes contre 231), 83 % de l'écart.");
    expect(e.causes[1]).toBe("Les remises : -22,0\u202fk€ (taux moyen 4,6\u202f% contre 4,0\u202f%), 15 % de l'écart.");
    expect(e.causes).toHaveLength(4);
  });

  it("propose l'action du premier effet défavorable et cite la source", () => {
    const e = expliquerEcart(faits);
    expect(e.action).toContain("Revoir l'alimentation du funnel");
    expect(e.sources).toContain("mart_ecarts");
    expect(e.sources).toContain("sans modèle de langage");
  });

  it("sécurise la production quand l'écart est favorable", () => {
    const e = expliquerEcart({ ...faits, caRealise: 2_100_000, effets: { total: 56_000, volume: 60_000, mix: 0, prix: 0, remise: -4_000, residuel: 0 } });
    expect(e.action).toContain("Écart favorable");
  });
});
