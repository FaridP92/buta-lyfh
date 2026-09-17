import { describe, expect, it } from "vitest";
import { agregerKpi, ajouterMois, analyserPeriode, ecartPct, ecartPoints, moisEntre, optionsPeriode, periodeN1, type LigneKpi } from "@/lib/periode";

const PUBLIE = "2026-09";

describe("analyserPeriode", () => {
  it("lit un mois valide", () => {
    const p = analyserPeriode("2026-06", PUBLIE);
    expect(p).toMatchObject({ type: "mois", debut: "2026-06", fin: "2026-06", libelle: "juin 2026" });
  });
  it("retombe sur le mois publié si le paramètre est absent, futur ou invalide", () => {
    expect(analyserPeriode(null, PUBLIE).debut).toBe("2026-09");
    expect(analyserPeriode("2026-12", PUBLIE).debut).toBe("2026-09");
    expect(analyserPeriode("n'importe quoi", PUBLIE).debut).toBe("2026-09");
    expect(analyserPeriode("2024-06", PUBLIE).debut).toBe("2026-09");
  });
  it("borne un trimestre en cours à la journée publiée", () => {
    const p = analyserPeriode("2026-T3", PUBLIE);
    expect(p).toMatchObject({ type: "trimestre", debut: "2026-07", fin: "2026-09", libelle: "T3 2026" });
    expect(analyserPeriode("2026-T3", "2026-08")).toMatchObject({ debut: "2026-07", fin: "2026-08", libelle: "T3 2026 à date" });
    expect(analyserPeriode("2026-T1", PUBLIE)).toMatchObject({ debut: "2026-01", fin: "2026-03", libelle: "T1 2026" });
  });
  it("borne l'année à date", () => {
    expect(analyserPeriode("2026", PUBLIE)).toMatchObject({ type: "annee", debut: "2026-01", fin: "2026-09", libelle: "2026 à date" });
    expect(analyserPeriode("2025", PUBLIE)).toMatchObject({ debut: "2025-01", fin: "2025-12", libelle: "2025" });
  });
});

describe("mois", () => {
  it("ajoute et retranche des mois en passant les années", () => {
    expect(ajouterMois("2026-01", -1)).toBe("2025-12");
    expect(ajouterMois("2025-11", 3)).toBe("2026-02");
  });
  it("liste les mois d'un intervalle inclusif", () => {
    expect(moisEntre("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("donne N-1 seulement à partir de 2026", () => {
    expect(periodeN1(analyserPeriode("2026-03", PUBLIE))).toEqual({ debut: "2025-03", fin: "2025-03" });
    expect(periodeN1(analyserPeriode("2025-03", PUBLIE))).toBeNull();
  });
  it("propose mois, trimestres et années à date sans dépasser la journée publiée", () => {
    const options = optionsPeriode(PUBLIE);
    expect(options[0]).toMatchObject({ valeur: "2026-09", groupe: "mois" });
    expect(options.filter((o) => o.groupe === "trimestre").map((o) => o.valeur)).toEqual(["2026-T3", "2026-T2", "2026-T1", "2025-T4", "2025-T3", "2025-T2", "2025-T1"]);
    expect(options.filter((o) => o.groupe === "annee").map((o) => o.libelle)).toEqual(["2026 à date", "2025"]);
  });
});

function ligne(mois: string, sur: Partial<LigneKpi> = {}): LigneKpi {
  return {
    mois, leads: 100, ventes: 10, ca_signe: 100_000, ca_pose: 80_000, encaisse: 70_000, poses: 8, marge_brute: 30_000,
    signatures_brutes: 11, annulees_60j: 1, couts_acquisition: 12_000, commissions: 4_000, marge_apres_acquisition: 14_000,
    charges: 20_000, resultat: -6_000, objectif_ventes: 12, objectif_ca: 110_000, delai_pose_median: 40,
    commerciaux_actifs: 4, techniciens_actifs: 5, ...sur,
  };
}

describe("agregerKpi", () => {
  it("somme les mesures additives et recalcule les ratios depuis les sommes", () => {
    const a = agregerKpi([ligne("2026-07"), ligne("2026-08", { ca_signe: 200_000, marge_brute: 50_000, ventes: 20, poses: 16, delai_pose_median: 60 }), ligne("2026-09")], "2026-07", "2026-08");
    expect(a).not.toBeNull();
    expect(a?.mois).toBe(2);
    expect(a?.ca_signe).toBe(300_000);
    expect(a?.taux_marge).toBe(26.7);
    expect(a?.panier_moyen).toBe(10_000);
    expect(a?.taux_annulation).toBe(9.1);
    expect(a?.taux_cac).toBe(10.7);
    expect(a?.ecart_objectif_pct).toBe(36.4);
    expect(a?.delai_pose_median).toBe(53);
    expect(a?.productivite_commerciale).toBe(7.5);
  });
  it("renvoie null sans ligne dans la période", () => {
    expect(agregerKpi([ligne("2026-07")], "2026-08", "2026-09")).toBeNull();
  });
  it("ne divise jamais par zéro", () => {
    const a = agregerKpi([ligne("2026-07", { ca_signe: 0, ventes: 0, signatures_brutes: 0, objectif_ca: 0, poses: 0, delai_pose_median: null, commerciaux_actifs: 0 })], "2026-07", "2026-07");
    expect(a?.taux_marge).toBeNull();
    expect(a?.panier_moyen).toBeNull();
    expect(a?.taux_annulation).toBeNull();
    expect(a?.ecart_objectif_pct).toBeNull();
    expect(a?.delai_pose_median).toBeNull();
    expect(a?.productivite_commerciale).toBeNull();
  });
});

describe("écarts", () => {
  it("calcule l'écart relatif et l'écart en points", () => {
    expect(ecartPct(115, 100)).toBe(15);
    expect(ecartPct(90, 100)).toBe(-10);
    expect(ecartPct(100, 0)).toBeNull();
    expect(ecartPct(null, 100)).toBeNull();
    expect(ecartPoints(32.4, 30.1)).toBe(2.3);
    expect(ecartPoints(null, 1)).toBeNull();
  });
});
