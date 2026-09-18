import { describe, expect, it } from "vitest";
import { resumerPlans, RITUELS, statutPlan } from "@/lib/plans";
import { INDICATEURS } from "@/lib/indicateurs";

describe("plans d'action et rituels", () => {
  it("résume les plans par statut et additionne les gains attendus", () => {
    const r = resumerPlans([
      { statut: "en cours", gain_attendu: 9000, avancement: 40 },
      { statut: "planifié", gain_attendu: 35000, avancement: 10 },
      { statut: "terminé", gain_attendu: 15000, avancement: 100 },
      { statut: "en cours", gain_attendu: null, avancement: 0 },
    ]);
    expect(r).toEqual({ total: 4, en_cours: 2, planifies: 1, termines: 1, gain_attendu_ouvert: 44000, gain_attendu_termine: 15000 });
    expect(resumerPlans([]).gain_attendu_ouvert).toBe(0);
  });
  it("traduit les statuts en pastilles", () => {
    expect(statutPlan("terminé").statut).toBe("succes");
    expect(statutPlan("en cours").statut).toBe("attention");
    expect(statutPlan("planifié").statut).toBe("neutre");
    expect(statutPlan("autre")).toEqual({ texte: "autre", statut: "neutre" });
  });
  it("chaque rituel cite des indicateurs du catalogue", () => {
    const codes = new Set(INDICATEURS.map((i) => i.code));
    expect(RITUELS).toHaveLength(4);
    for (const r of RITUELS) for (const c of r.indicateurs) expect(codes.has(c), `${r.code} : ${c}`).toBe(true);
  });
});
