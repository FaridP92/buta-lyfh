import { describe, expect, it } from "vitest";
import { agregerDelais, agregerEncaissement, agregerEncaissementN1, calendrierCharge, carnetDerniereSemaine, lundiDe, phraseTendanceCarnet } from "@/lib/pose";

describe("phraseTendanceCarnet", () => {
  it("compare les valeurs arrondies telles qu'affichées : 26,4 contre 25,8 est stable, pas en hausse", () => {
    expect(phraseTendanceCarnet(26.4, 25.8)).toBe(", stable par rapport à la semaine précédente (26)");
    expect(phraseTendanceCarnet(42.9, 35)).toBe(", en hausse sur la semaine précédente (35)");
    expect(phraseTendanceCarnet(14.5, 16.2)).toBe(", en baisse sur la semaine précédente (16)");
    expect(phraseTendanceCarnet(26, null)).toBe("");
  });
});

describe("agregerDelais", () => {
  const lignes = [
    { mois: "2026-07-01", poses: 100, poses_dans_les_delais: 60, delai_signature_pose_median: 50, delai_pose_encaissement_median: 20 },
    { mois: "2026-08-01", poses: 50, poses_dans_les_delais: 20, delai_signature_pose_median: 80, delai_pose_encaissement_median: null },
    { mois: "2026-09-01", poses: 0, poses_dans_les_delais: 0, delai_signature_pose_median: null, delai_pose_encaissement_median: null },
  ];
  it("somme les poses, recalcule le taux depuis les sommes et pondère les médianes par les poses", () => {
    expect(agregerDelais(lignes, "2026-07", "2026-09")).toEqual({ poses: 150, posesDansLesDelais: 80, tauxDansLesDelais: 53.3, delaiSignaturePose: 60, delaiPoseEncaissement: 20 });
    expect(agregerDelais(lignes, "2026-09", "2026-09")).toEqual({ poses: 0, posesDansLesDelais: 0, tauxDansLesDelais: null, delaiSignaturePose: null, delaiPoseEncaissement: null });
    expect(agregerDelais(lignes, "2026-10", "2026-10")).toBeNull();
  });
});

describe("calendrier de charge et carnet", () => {
  const ligne = (semaine: string, agence: string, extra: Partial<Parameters<typeof calendrierCharge>[0][number]> = {}) => ({
    semaine, agence, capacite_jt_semaine: 20, jt_poses: 0, poses: 0, poses_planifiees: 0, charge_planifiee_pct: null, carnet_jours_ouvres: null, poses_en_retard: null, dossiers_a_poser: null, ...extra,
  });
  const lignes = [
    ligne("2026-08-31", "SAI", { jt_poses: 8, poses: 3, carnet_jours_ouvres: 30 }),
    ligne("2026-09-07", "SAI", { jt_poses: 10, poses: 4, carnet_jours_ouvres: 35, poses_en_retard: 6, dossiers_a_poser: 90 }),
    ligne("2026-09-14", "SAI", { jt_poses: 16, poses: 6, carnet_jours_ouvres: 42.9, poses_en_retard: 8, dossiers_a_poser: 100 }),
    ligne("2026-09-21", "SAI", { poses_planifiees: 11, charge_planifiee_pct: 55 }),
    ligne("2026-09-28", "SAI", { poses_planifiees: 9, charge_planifiee_pct: 45 }),
    ligne("2026-09-14", "ARC", { jt_poses: 4.5, poses: 2, carnet_jours_ouvres: 14.5 }),
  ];
  it("trouve le lundi d'une date", () => {
    expect(lundiDe("2026-09-17")).toBe("2026-09-14");
    expect(lundiDe("2026-09-14")).toBe("2026-09-14");
    expect(lundiDe("2026-09-20")).toBe("2026-09-14");
  });
  it("sépare semaines réalisées (jours-technicien posés / capacité) et planifiées (charge planifiée de la vue)", () => {
    // Journée du 17/09 : la semaine courante (14/09) et les suivantes sont planifiées, 2 semaines passées demandées.
    const c = calendrierCharge(lignes, "2026-09-17", ["SAI", "ARC"], 2, 2);
    expect(c.semaines).toEqual(["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
    expect(c.cellules.find((x) => x.agence === "SAI" && x.semaine === "2026-09-07")).toEqual({ semaine: "2026-09-07", agence: "SAI", type: "realisee", poses: 4, charge: 50 });
    expect(c.cellules.find((x) => x.agence === "SAI" && x.semaine === "2026-09-21")).toEqual({ semaine: "2026-09-21", agence: "SAI", type: "planifiee", poses: 11, charge: 55 });
    expect(c.cellules.find((x) => x.agence === "ARC" && x.semaine === "2026-09-21")?.charge).toBeNull();
  });
  it("retient le dernier carnet renseigné au plus tard à la journée, avec la semaine précédente", () => {
    expect(carnetDerniereSemaine(lignes, "SAI", "2026-09-17")).toEqual({ semaine: "2026-09-14", carnet: 42.9, carnetPrecedent: 35, posesEnRetard: 8, dossiersAPoser: 100 });
    expect(carnetDerniereSemaine(lignes, "SAI", "2026-09-08")).toEqual({ semaine: "2026-09-07", carnet: 35, carnetPrecedent: 30, posesEnRetard: 6, dossiersAPoser: 90 });
    expect(carnetDerniereSemaine(lignes, "NOR", "2026-09-17")).toBeNull();
  });
});

describe("agregerEncaissement", () => {
  const lignes = [
    { mois: "2026-08-01", encaisse: 100000, encaissements: 10, delai_pose_encaissement_median: 20, en_attente_encaissement: 50000, retards_encaissement: 1, aides_en_attente: 8000 },
    { mois: "2026-09-01", encaisse: 50000, encaissements: 5, delai_pose_encaissement_median: 26, en_attente_encaissement: 60000, retards_encaissement: 2, aides_en_attente: 9000 },
  ];
  it("somme l'encaissé et pondère le délai par les encaissements", () => {
    expect(agregerEncaissement(lignes, "2026-08", "2026-09")).toEqual({ encaisse: 150000, encaissements: 15, delaiPoseEncaissement: 22 });
    expect(agregerEncaissement(lignes, "2026-07", "2026-07")).toBeNull();
  });
  it("ramène l'encaissé N-1 au prorata du mois en cours", () => {
    const n1 = [{ mois: "2025-09-01", encaisse: 90000, encaissements: 9, delai_pose_encaissement_median: 21, en_attente_encaissement: null, retards_encaissement: null, aides_en_attente: null }];
    expect(agregerEncaissementN1(n1, "2026-09", "2026-09", new Map([["2026-09", 17 / 30]]))).toEqual({ encaisse: 51000, encaissements: 5, delaiPoseEncaissement: 21 });
    expect(agregerEncaissementN1(n1, "2026-10", "2026-10", new Map())).toBeNull();
  });
});
