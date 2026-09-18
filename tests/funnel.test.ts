import { describe, expect, it } from "vitest";
import { agregerCoutsParCanal, fluxSankey, matriceCanalAgence, sommerCouts, type LigneCoutCanal } from "@/lib/funnel";

describe("fluxSankey", () => {
  const cohorte = { leads: 100, rdvPlanifies: 50, rdv: 45, devis: 30, signatures: 10, signaturesNettes: 9, poses: 6, encaissements: 4, sansRdv48h: 40, mature: false };

  it("conserve les volumes : chaque étape se répartit entre l'étape suivante, la perte et l'attente", () => {
    const { liens } = fluxSankey(cohorte);
    const sortant = (nom: string) => liens.filter((l) => l.source === nom).reduce((s, l) => s + l.valeur, 0);
    expect(sortant("Leads")).toBe(100);
    expect(sortant("RDV tenus")).toBe(45);
    expect(sortant("Devis")).toBe(30);
    expect(sortant("Signatures")).toBe(10);
    expect(sortant("Poses")).toBe(6);
    expect(liens.find((l) => l.cible === "Annulations")?.valeur).toBe(1);
    expect(liens.find((l) => l.cible === "À poser")?.valeur).toBe(3);
    expect(liens.find((l) => l.cible === "À encaisser")?.valeur).toBe(2);
  });

  it("n'ajoute pas de branche vide", () => {
    const { noeuds, liens } = fluxSankey({ ...cohorte, signaturesNettes: 10, poses: 10, encaissements: 10 });
    expect(noeuds.some((n) => n.nom === "Annulations")).toBe(false);
    expect(noeuds.some((n) => n.nom === "À poser")).toBe(false);
    expect(liens.every((l) => l.valeur > 0)).toBe(true);
  });
});

function cout(mois: string, canal: string, partiel: Partial<LigneCoutCanal> = {}): LigneCoutCanal {
  return { mois, agence: "RESEAU", canal, leads: 100, rdv_tenus: 40, ventes: 10, ca_signe: 100_000, cout: 5_000, delai_lead_rdv_median: 6, ...partiel };
}

describe("agregerCoutsParCanal", () => {
  const lignes = [
    cout("2026-07-01", "site"), cout("2026-08-01", "site", { leads: 200, rdv_tenus: 60, ventes: 10, cout: 5_000, delai_lead_rdv_median: 8 }),
    cout("2026-07-01", "achetes", { leads: 100, rdv_tenus: 20, ventes: 4, cout: 6_500 }),
    cout("2026-07-01", "parrainage", { leads: 20, rdv_tenus: 12, ventes: 5, cout: 1_500 }),
    cout("2026-07-01", "appels", { leads: 30, rdv_tenus: 15, ventes: 3, cout: 0 }),
    cout("2026-07-01", "TOUS", { leads: 250 }),
    cout("2026-06-01", "site", { leads: 999 }),
  ];

  it("somme par canal sur la période et recalcule les ratios", () => {
    const site = agregerCoutsParCanal(lignes, "2026-07", "2026-08").find((c) => c.canal === "site");
    expect(site).toMatchObject({ leads: 300, rdv_tenus: 100, ventes: 20, cout: 10_000, taux_rdv: 33.3, taux_conversion: 6.7, cout_par_lead: 33, cout_par_vente: 500 });
    // Délai : (6 × 100 + 8 × 200) / 300 = 7,3 → 7
    expect(site?.delai_lead_rdv_median).toBe(7);
  });

  it("ignore TOUS et trie par leads décroissants", () => {
    const canaux = agregerCoutsParCanal(lignes, "2026-07", "2026-08");
    expect(canaux.map((c) => c.canal)).toEqual(["site", "achetes", "appels", "parrainage"]);
  });

  it("marque à revoir le canal dont le coût par vente dépasse 1,3 fois la médiane des canaux à coût", () => {
    const canaux = agregerCoutsParCanal(lignes, "2026-07", "2026-08");
    // CPV : site 500, achetés 1 625, parrainage 300 ; appels sans coût (null). Médiane = 500 ; seuil 650.
    expect(canaux.find((c) => c.canal === "achetes")?.a_revoir).toBe(true);
    expect(canaux.find((c) => c.canal === "site")?.a_revoir).toBe(false);
    expect(canaux.find((c) => c.canal === "appels")?.a_revoir).toBeNull();
    expect(canaux.find((c) => c.canal === "appels")?.cout_par_vente).toBe(0);
  });
});

describe("matriceCanalAgence", () => {
  it("cumule leads et signatures nettes par canal et agence sur la période", () => {
    const m = matriceCanalAgence([
      { mois: "2026-07-01", agence: "SAI", canal: "site", leads: 100, signatures_nettes: 8 },
      { mois: "2026-08-01", agence: "SAI", canal: "site", leads: 100, signatures_nettes: 12 },
      { mois: "2026-08-01", agence: "SAI", canal: "TOUS", leads: 300, signatures_nettes: 30 },
      { mois: "2026-08-01", agence: "RESEAU", canal: "site", leads: 900, signatures_nettes: 90 },
      { mois: "2026-06-01", agence: "SAI", canal: "site", leads: 500, signatures_nettes: 50 },
    ], "2026-07", "2026-08");
    expect([...m.keys()]).toEqual(["site|SAI"]);
    expect(m.get("site|SAI")).toEqual({ leads: 200, signatures: 20, taux_conversion: 10 });
  });
});

describe("sommerCouts", () => {
  it("calcule coût par lead et par vente depuis les sommes, null sans dénominateur", () => {
    expect(sommerCouts([{ leads: 100, ventes: 8, cout: 3_000 }, { leads: 50, ventes: 2, cout: 2_000 }])).toEqual({ leads: 150, ventes: 10, cout: 5_000, cpl: 33, cpv: 500 });
    expect(sommerCouts([])).toEqual({ leads: 0, ventes: 0, cout: 0, cpl: null, cpv: null });
  });
});
