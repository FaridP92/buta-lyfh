import { describe, expect, it } from "vitest";
import { extraireNombres, nombresAutorises, nombresNonTraces, normaliserNombre, representations, signesIncoherents } from "../supabase/functions/_partage/nombres.ts";

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
    // Sous le million, la forme en millions n'est plus acceptée (« 0,37 M€ » pour 371 500 € serait un artifice).
    expect(r).not.toContain("0.37");
    expect(representations(2_450_000)).toContain("2.45");
    expect(representations(-27.84)).toContain("27.8");
  });
  it("réserve les formes en milliers et en millions aux valeurs qui les atteignent, et accepte les arrondis ronds", () => {
    expect(representations(17)).not.toContain("0.02");
    expect(representations(17)).not.toContain("0");
    expect(representations(299537)).toContain("300000");
    expect(representations(299537)).toContain("299500");
    expect(representations(29187878)).toContain("29.19");
    expect(representations(950)).not.toContain("0.95");
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
    expect(nombresNonTraces("Soit 238,6 k€ sur 1 agence, près de 239 000 €.", autorises)).toEqual([]);
    // Sous le million, « 0,24 M€ » n'est plus une reformulation acceptée.
    expect(nombresNonTraces("Soit 0,24 M€.", autorises)).toEqual(["0.24"]);
  });
  it("rejette un nombre calculé ou inventé", () => {
    const autorises = nombresAutorises(lignes, "", lignes.length);
    expect(nombresNonTraces("La marge brute atteint donc 53,7 k€ (238,6 × 22,5 %).", autorises)).toEqual(["53.7"]);
    // « 9 » serait accepté par le mois « 09 » de la date : c'est voulu ; « 7 » ne figure nulle part.
    expect(nombresNonTraces("Le réseau compte 7 agences.", autorises)).toEqual(["7"]);
  });
});

describe("nombres en lettres, signes et référentiels", () => {
  const lignes = [{ agence: "MSN", resultat: -17779 }, { agence: "SAI", resultat: 299537 }];
  it("compte les nombres écrits en lettres comme des nombres", () => {
    expect(extraireNombres("Quatre agences terminent en perte, dix-sept en tout.")).toEqual(["4", "17"]);
    expect(extraireNombres("Une agence sur deux, un résultat cent fois vérifié.")).toEqual(["2", "100"]);
    expect(extraireNombres("Le sixième mois, le centile, Marsan.")).toEqual([]);
    const autorises = nombresAutorises(lignes, "", lignes.length);
    expect(nombresNonTraces("Quatre agences sont en perte.", autorises)).toEqual(["4"]);
    expect(nombresNonTraces("Deux agences sont listées.", autorises)).toEqual([]);
  });
  it("rejette un signe qui contredit la valeur des lignes", () => {
    expect(signesIncoherents("Marsan affiche +17 779 € et la Saintonge 299 537 €.", lignes)).toEqual(["+17779"]);
    expect(signesIncoherents("Marsan affiche -17 779 € (-17,8 k€).", lignes)).toEqual([]);
    expect(signesIncoherents("Au 2026-09-01, la Saintonge signe -299 537 €.", lignes)).toEqual(["-299537"]);
    expect(signesIncoherents("Un écart de -3 points inconnu des lignes.", lignes)).toEqual([]);
  });
  it("verse les référentiels en chiffres bruts, sans reformulation", () => {
    const refs = { agences: [{ code: "NOR", departement: "59", ouverture: "2026-06-01" }], journee: "2026-09-18" };
    const autorises = nombresAutorises(lignes, "", lignes.length, refs);
    expect(autorises.has("59")).toBe(true);
    expect(autorises.has("2026")).toBe(true);
    expect(autorises.has("18")).toBe(true);
    expect(autorises.has("60")).toBe(false);
    expect(autorises.has("0.06")).toBe(false);
  });
});
