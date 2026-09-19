import { describe, expect, it } from "vitest";
import { formaterSql, jourParis, libelleCode, libelleNature, totalDuJour } from "../src/lib/analyste";
import { formatDuree } from "../src/lib/format";

describe("totalDuJour et jourParis", () => {
  it("additionne le coût et les appels du jour, toutes fonctions, et ignore les autres jours", () => {
    const usages = [
      { jour: "2026-09-19", fonction: "analyste", appels: 105, cout_eur: 3.627 },
      { jour: "2026-09-19", fonction: "expliquer-ecart", appels: 3, cout_eur: 0.046 },
      { jour: "2026-09-18", fonction: "analyste", appels: 8, cout_eur: 0.2 },
    ];
    expect(totalDuJour(usages, "2026-09-19")).toEqual({ cout: 3.673, appels: 108 });
    expect(totalDuJour(undefined, "2026-09-19")).toEqual({ cout: 0, appels: 0 });
  });
  it("donne le jour en heure de Paris, pas en UTC", () => {
    // 23 h 30 UTC le 18 septembre = 1 h 30 le 19 à Paris (heure d'été).
    expect(jourParis(new Date("2026-09-18T23:30:00Z"))).toBe("2026-09-19");
    expect(jourParis(new Date("2026-09-19T21:59:00Z"))).toBe("2026-09-19");
    expect(jourParis(new Date("2026-09-19T22:30:00Z"))).toBe("2026-09-20");
  });
});

describe("formaterSql", () => {
  it("passe à la ligne avant chaque clause de premier niveau et laisse les sous-requêtes en ligne", () => {
    const sql = "select agence, sum(resultat) as resultat_total from mart_kpi_mensuel where agence <> 'RESEAU' and mois >= (select max(mois) from mart_kpi_mensuel where agence = 'SAI') group by agence order by resultat_total desc limit 200";
    expect(formaterSql(sql)).toBe([
      "select agence, sum(resultat) as resultat_total",
      "from mart_kpi_mensuel",
      "where agence <> 'RESEAU' and mois >= (select max(mois) from mart_kpi_mensuel where agence = 'SAI')",
      "group by agence",
      "order by resultat_total desc",
      "limit 200",
    ].join("\n"));
  });
  it("ne coupe pas un mot qui contient une clause", () => {
    expect(formaterSql("select fromage, limite from t limit 5")).toBe("select fromage, limite\nfrom t\nlimit 5");
  });
});

describe("libellés", () => {
  const refs = [{ code: "SAI", libelle: "Saintonge" }, { code: "leads_achetes", libelle: "Leads achetés" }];
  it("traduit un code connu et laisse le reste", () => {
    expect(libelleCode("SAI", refs)).toBe("Saintonge");
    expect(libelleCode("RESEAU", refs)).toBe("Réseau");
    expect(libelleCode("TOUS", refs)).toBe("Tous");
    expect(libelleCode("17", refs)).toBe("17");
  });
  it("nomme la nature des données", () => {
    expect(libelleNature("reel")).toBe("marché réel");
    expect(libelleNature("mixte")).toBe("simulé et marché réel");
    expect(libelleNature(undefined)).toBe("simulé");
  });
  it("formate une durée en secondes avec l'espace insécable", () => {
    expect(formatDuree(8940)).toBe("8,9 s");
    expect(formatDuree(60)).toBe("< 0,1 s");
    expect(formatDuree(null)).toBe("n. d.");
  });
});
