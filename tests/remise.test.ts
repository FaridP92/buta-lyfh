import { describe, expect, it } from "vitest";
import { estimerElasticite, penteRequise, phraseRemise, seuilRentable, type PointRemise } from "@/lib/remise";

function point(agence: string, periode: string, devis: number, tauxSignature: number, remise: number, complete = true): PointRemise {
  return {
    agence, periode, devis, signatures: Math.round((devis * tauxSignature) / 100),
    taux_signature: tauxSignature, remise_moyenne: remise, marge_avant_remise: 30, periode_complete: complete,
  };
}

// Agence A : remise fixe à 4 %, signature à 30 % ; agence B : 4 % puis 9 %, signature 34 % puis 38 % (+0,8 point par point).
const JEU: PointRemise[] = [
  point("A", "2026-01-01", 100, 30, 4), point("A", "2026-02-01", 100, 30, 4), point("A", "2026-03-01", 100, 30, 4), point("A", "2026-04-01", 100, 30, 4),
  point("B", "2026-01-01", 100, 34, 4), point("B", "2026-02-01", 100, 34, 4), point("B", "2026-03-01", 100, 38, 9), point("B", "2026-04-01", 100, 38, 9),
];

describe("estimerElasticite", () => {
  it("retrouve la pente plantée sans être trompée par l'effet agence", () => {
    const e = estimerElasticite(JEU);
    expect(e).not.toBeNull();
    expect(e?.points).toBe(8);
    expect(e?.agences).toBe(2);
    // Ajustement exact : résidus nuls, erreur type nulle, intervalle réduit à la pente.
    expect(e?.pente).toBeCloseTo(0.8, 6);
    expect(e?.erreurType).toBe(0);
    expect(e?.intervalle).toEqual([0.8, 0.8]);
  });

  it("agrège taux de signature, remise et marge en pondérant par les devis", () => {
    const e = estimerElasticite(JEU);
    expect(e?.tauxSignature).toBe(33); // (4 × 30 + 2 × 34 + 2 × 38) / 8
    expect(e?.remiseMoyenne).toBe(5.3); // (6 × 4 + 2 × 9) / 8 = 5,25 arrondi à une décimale
    expect(e?.margeAvantRemise).toBe(30);
  });

  it("ignore les périodes non closes, les petits échantillons et le réseau", () => {
    const points = [...JEU, point("A", "2026-05-01", 100, 50, 12, false), point("B", "2026-05-01", 5, 50, 12), point("RESEAU", "2026-01-01", 500, 50, 12)];
    expect(estimerElasticite(points)?.pente).toBeCloseTo(0.8, 6);
  });

  it("renvoie null sans variation de remise ou avec trop peu de points", () => {
    expect(estimerElasticite(JEU.filter((p) => p.agence === "A"))).toBeNull();
    expect(estimerElasticite(JEU.slice(0, 3))).toBeNull();
  });

  it("estime une erreur type positive quand les points ne sont pas alignés", () => {
    const bruite = JEU.map((p, i) => ({ ...p, taux_signature: (p.taux_signature as number) + (i % 2 === 0 ? 1 : -1) }));
    const e = estimerElasticite(bruite);
    expect(e?.erreurType).toBeGreaterThan(0);
    expect(e?.intervalle[0]).toBeLessThan(e?.pente as number);
    expect(e?.intervalle[1]).toBeGreaterThan(e?.pente as number);
  });
});

describe("seuilRentable et penteRequise", () => {
  it("vaut zéro quand la pente ne paie aucune remise", () => {
    // r* = (30 + 4) / 2 - 32 / (2 × 0,8) = 17 - 20 < 0
    expect(seuilRentable(0.8, 32, 4, 30)).toBe(0);
    expect(seuilRentable(0, 32, 4, 30)).toBe(0);
  });

  it("retrouve un optimum intérieur quand la pente est forte", () => {
    // r* = 17 - 32 / 3,6 = 8,11
    expect(seuilRentable(1.8, 32, 4, 30)).toBe(8.1);
  });

  it("calcule la pente pour laquelle 8 % serait optimal", () => {
    // b = 32 / (30 + 4 - 16) = 1,78
    expect(penteRequise(8, 32, 4, 30)).toBe(1.78);
    expect(penteRequise(20, 32, 4, 30)).toBeNull();
  });
});

describe("phraseRemise", () => {
  it("dit qu'aucune remise ne se paie et la pente qu'il faudrait", () => {
    const phrase = phraseRemise(estimerElasticite(JEU));
    expect(phrase).toContain("retrouve 0,8 point de signature par point de remise");
    expect(phrase).toContain("aucun niveau de remise n'augmente la marge");
    expect(phrase).toMatch(/il faudrait 1,\d+ point de signature par point de remise pour qu'une remise de 8\u202f% soit le bon niveau/);
    expect(phrase).toContain("pas une règle applicable à un réseau réel");
  });

  it("annonce le niveau optimal quand il existe", () => {
    const e = estimerElasticite(JEU);
    const fort = e ? { ...e, pente: 1.8, intervalle: [1.5, 2.1] as [number, number], seuil: 8.1, seuilBorneHaute: 9.4 } : null;
    expect(phraseRemise(fort)).toContain("la marge est maximale autour de 8,1\u202f% de remise (9,4\u202f% à la borne haute");
  });

  it("explique l'absence d'estimation", () => {
    expect(phraseRemise(null)).toContain("Pas assez de couples");
  });
});
