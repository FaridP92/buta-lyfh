import { describe, expect, it } from "vitest";
import { extraireNombres, nombresAutorises, nombresNonTraces, normaliserNombre, representations } from "../supabase/functions/_partage/nombres.ts";

describe("normaliserNombre et extraireNombres", () => {
  it("ramène les écritures françaises et machine à une même clé", () => {
    expect(normaliserNombre("284,5")).toBe("284.5");
    expect(normaliserNombre("284.5")).toBe("284.5");
    expect(normaliserNombre("1 300")).toBe("1300");
    expect(normaliserNombre("1 300")).toBe("1300");
    expect(normaliserNombre("08")).toBe("8");
    expect(normaliserNombre("2,50")).toBe("2.5");
  });
  it("extrait les nombres d'une phrase française", () => {
    expect(extraireNombres("Sur août 2026, le réseau signe 924,6 k€ contre 1,3 M€ (-27,8 %) avec 111 ventes.")).toEqual(["2026", "924.6", "1.3", "27.8", "111"]);
  });
});

describe("representations et nombresAutorises", () => {
  it("accepte une valeur telle quelle, arrondie, en milliers et en millions", () => {
    const r = representations(371500.5);
    expect(r).toContain("371500.5");
    expect(r).toContain("371501");
    expect(r).toContain("371.5");
    expect(r).toContain("372");
    expect(r).toContain("0.37");
    expect(r).toContain("0.4");
    expect(representations(-27.84)).toContain("27.8");
  });
  it("lit les lignes en profondeur : nombres, numériques en chaîne, dates et codes", () => {
    const a = nombresAutorises([{ mois: "2026-08-01", agence: "C-SAI-01", ca_signe: "1279928", taux: 23.4, detail: { poses: 43 } }], "combien en août 2026 ?", 1);
    expect(a.has("2026")).toBe(true);
    expect(a.has("8")).toBe(true);
    expect(a.has("1")).toBe(true);
    expect(a.has("1.3")).toBe(true);
    expect(a.has("1280")).toBe(true);
    expect(a.has("23.4")).toBe(true);
    expect(a.has("43")).toBe(true);
  });
});

describe("nombresNonTraces", () => {
  const lignes = [{ agence: "SAI", ca_signe: 238553, taux_marge: 22.5, mois: "2026-09-01" }];
  it("laisse passer une réponse dont chaque nombre vient des lignes, à l'unité près", () => {
    const autorises = nombresAutorises(lignes, "CA de la Saintonge en septembre 2026", lignes.length);
    expect(nombresNonTraces("En septembre 2026, la Saintonge signe 238,6 k€ HT avec un taux de marge de 22,5 %.", autorises)).toEqual([]);
    expect(nombresNonTraces("Soit 0,24 M€ sur 1 agence.", autorises)).toEqual([]);
  });
  it("rejette un nombre calculé ou inventé", () => {
    const autorises = nombresAutorises(lignes, "", lignes.length);
    expect(nombresNonTraces("La marge brute atteint donc 53,7 k€ (238,6 × 22,5 %).", autorises)).toEqual(["53.7"]);
    // « 9 » serait accepté par le mois « 09 » de la date : c'est voulu ; « 7 » ne figure nulle part.
    expect(nombresNonTraces("Le réseau compte 7 agences.", autorises)).toEqual(["7"]);
  });
});
