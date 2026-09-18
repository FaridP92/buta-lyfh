import { describe, expect, it } from "vitest";
import { phi, recalculerAtterrissage, risquesEtOpportunites, trajectoire, type AgenceAtterrissage, type HypothesesAtterrissage } from "@/lib/forecast";

// Réseau au 17 septembre : trois mois restants, valeurs proches de mart_forecast pour que les ordres de grandeur parlent.
const H: HypothesesAtterrissage = {
  realiseADate: 19_467_080, objectifAnnuel: 29_187_878, pipePondere: 1_531_572, montantDevisEnCours: 13_300_404,
  projectionRunRate: 7_627_963, moisRestants: 3, sigmaMensuel: 305_425,
};

describe("phi", () => {
  it("retrouve les valeurs de table de la loi normale", () => {
    expect(phi(0)).toBeCloseTo(0.5, 6);
    expect(phi(1.96)).toBeCloseTo(0.975, 3);
    expect(phi(-1)).toBeCloseTo(0.1587, 3);
    expect(phi(3)).toBeCloseTo(0.99865, 4);
  });
});

describe("recalculerAtterrissage", () => {
  it("reproduit la formule SQL au curseur par défaut", () => {
    const a = recalculerAtterrissage(H);
    // central = réalisé + pipe + projection × (3 - 1,5) / 3 = 19 467 080 + 1 531 572 + 3 813 981,5
    expect(a.central).toBe(24_812_634);
    expect(a.bas).toBe(Math.round(24_812_633.5 - 305_425 * Math.sqrt(3)));
    expect(a.haut).toBe(Math.round(24_812_633.5 + 305_425 * Math.sqrt(3)));
    expect(a.probabilite).toBe(0);
    expect(a.ecartPct).toBe(-15);
  });

  it("déplace le central avec le curseur et arrondit la probabilité à cinq points", () => {
    // À 45 % de signature du pipe : pipe = 5 985 182, central = 29 266 244, au-dessus de l'objectif de 78 k€ sur un écart-type de 529 k€ : Φ(0,15) = 56 % → 55.
    const a = recalculerAtterrissage(H, 45);
    expect(a.pipe).toBe(5_985_182);
    expect(a.central).toBe(29_266_244);
    expect(a.probabilite).toBe(55);
    expect(a.ecartPct).toBe(0.3);
  });

  it("tranche sans écart-type ou sans mois restant", () => {
    expect(recalculerAtterrissage({ ...H, sigmaMensuel: 0 }).probabilite).toBeNull();
    expect(recalculerAtterrissage({ ...H, moisRestants: 0, realiseADate: 30_000_000 }).probabilite).toBe(100);
    expect(recalculerAtterrissage({ ...H, objectifAnnuel: 0 }).ecartPct).toBeNull();
  });
});

describe("trajectoire", () => {
  const realise = [2e6, 2e6, 2e6, 2e6, 2e6, 2e6, 2e6, 2e6, 1e6, null, null, null];
  const objectif = Array.from({ length: 12 }, () => 2_432_323);

  it("cumule le réalisé jusqu'au mois courant et l'objectif sur l'année", () => {
    const t = trajectoire(2026, 9, realise, objectif, H);
    expect(t.mois[0]).toBe("2026-01");
    expect(t.realiseCumule[8]).toBe(17_000_000);
    expect(t.realiseCumule[9]).toBeNull();
    expect(t.objectifCumule[11]).toBe(29_187_876);
  });

  it("attache la projection au réalisé à date et retrouve les bornes de la vue en décembre", () => {
    const t = trajectoire(2026, 9, realise, objectif, H);
    const a = recalculerAtterrissage(H);
    expect(t.central[7]).toBeNull();
    expect(t.central[8]).toBe(19_467_080);
    // Octobre : pipe aux deux tiers, pas encore de run-rate.
    expect(t.central[9]).toBe(Math.round(19_467_080 + 1_531_572 * (1 / 1.5)));
    expect(t.central[11]).toBe(a.central);
    expect(t.bas[11]).toBe(a.bas);
    expect(t.haut[11]).toBe(a.haut);
    expect(t.haut[9] as number).toBeGreaterThan(t.central[9] as number);
  });
});

describe("risquesEtOpportunites", () => {
  const agences: AgenceAtterrissage[] = [
    { code: "SAI", nom: "Saintonge", realise: 3.6e6, objectif: 5.38e6, central: 4.69e6, bas: 4.55e6, haut: 4.84e6, probabilite: 0, ecartPct: -12.8, pipePondere: 292_935, montantDevis: 2_289_788, runRate3m: 407_238 },
    { code: "ARC", nom: "Bassin d'Arcachon", realise: 1.2e6, objectif: 1.43e6, central: 1.53e6, bas: 1.47e6, haut: 1.59e6, probabilite: 95, ecartPct: 6.7, pipePondere: 55_061, montantDevis: 640_634, runRate3m: 137_591 },
    { code: "BOR", nom: "Born", realise: 1.4e6, objectif: 2.1e6, central: 2.05e6, bas: 1.99e6, haut: 2.12e6, probabilite: 20, ecartPct: -2.4, pipePondere: 260_000, montantDevis: 100_000, runRate3m: 153_717 },
  ];
  const poses = [{ code: "SAI", posesEnRetard: 8, panierMoyen: 9_000 }, { code: "ARC", posesEnRetard: 4, panierMoyen: 9_000 }, { code: "BOR", posesEnRetard: null, panierMoyen: 9_000 }];

  it("signale les poses en retard avec une estimation explicite", () => {
    const s = risquesEtOpportunites(agences, poses);
    const retard = s.find((x) => x.texte.startsWith("Saintonge : 8 poses"));
    expect(retard?.type).toBe("risque");
    expect(retard?.montant).toBe(72_000);
    expect(retard?.montantLibelle).toContain("estimation");
    expect(s.some((x) => x.texte.includes("Bassin d'Arcachon : 4 poses"))).toBe(false);
  });

  it("classe les risques avant les opportunités, par montant décroissant", () => {
    const s = risquesEtOpportunites(agences, poses);
    const types = s.map((x) => x.type);
    expect(types.indexOf("opportunite")).toBe(types.lastIndexOf("risque") + 1);
    const risques = s.filter((x) => x.type === "risque").map((x) => x.montant);
    expect([...risques].sort((a, b) => b - a)).toEqual(risques);
  });

  it("distingue objectif atteignable, borne haute au-dessus, pipe fort et pipe faible", () => {
    const s = risquesEtOpportunites(agences, poses);
    expect(s.some((x) => x.type === "opportunite" && x.texte.includes("Bassin d'Arcachon") && x.texte.includes("probabilité d'atteinte 95\u202f%"))).toBe(true);
    expect(s.some((x) => x.type === "opportunite" && x.texte.includes("Born : la borne haute"))).toBe(true);
    expect(s.some((x) => x.type === "opportunite" && x.texte.includes("Born : pipe pondéré"))).toBe(true);
    expect(s.some((x) => x.type === "risque" && x.texte.includes("Born") && x.texte.includes("moins d'un mois de run-rate"))).toBe(true);
    expect(s.some((x) => x.type === "risque" && x.texte.includes("Saintonge : atterrissage central"))).toBe(true);
  });
});
