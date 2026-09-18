import { describe, expect, it } from "vitest";
import { formatDuree, libelleDeclencheur, libelleStatut, prochaineExecution, resumerJournal, WORKFLOWS } from "@/lib/automatisations";

describe("prochaineExecution (heure de Paris, été : UTC+2)", () => {
  it("quotidien : plus tard le même jour, sinon le lendemain", () => {
    // 18 septembre 2026 04:00 UTC = 06:00 Paris
    expect(prochaineExecution({ type: "quotidien", heure: 6, minute: 20 }, new Date("2026-09-18T04:00:00Z"))?.toISOString()).toBe("2026-09-18T04:20:00.000Z");
    expect(prochaineExecution({ type: "quotidien", heure: 6, minute: 0 }, new Date("2026-09-18T04:00:00Z"))?.toISOString()).toBe("2026-09-19T04:00:00.000Z");
    expect(prochaineExecution({ type: "quotidien", heure: 6, minute: 0 }, new Date("2026-09-18T22:30:00Z"))?.toISOString()).toBe("2026-09-19T04:00:00.000Z");
  });
  it("toutes les 6 heures à la minute 10 : 00:10, 06:10, 12:10, 18:10 Paris", () => {
    expect(prochaineExecution({ type: "toutes_les_heures", toutesLes: 6, minute: 10 }, new Date("2026-09-18T09:30:00Z"))?.toISOString()).toBe("2026-09-18T10:10:00.000Z");
    expect(prochaineExecution({ type: "toutes_les_heures", toutesLes: 6, minute: 10 }, new Date("2026-09-18T20:00:00Z"))?.toISOString()).toBe("2026-09-18T22:10:00.000Z");
  });
  it("hebdomadaire lundi 07:00 et mensuel le 1er à 03:00", () => {
    // Vendredi 18 septembre 2026 -> lundi 21 septembre 07:00 Paris = 05:00 UTC
    expect(prochaineExecution({ type: "hebdomadaire", jourSemaine: 1, heure: 7, minute: 0 }, new Date("2026-09-18T09:30:00Z"))?.toISOString()).toBe("2026-09-21T05:00:00.000Z");
    expect(prochaineExecution({ type: "mensuel", jourMois: 1, heure: 3, minute: 0 }, new Date("2026-09-18T09:30:00Z"))?.toISOString()).toBe("2026-10-01T01:00:00.000Z");
    expect(prochaineExecution({ type: "sur_erreur" }, new Date())).toBeNull();
  });
  it("hiver : le décalage retenu est celui de l'instant courant (UTC+1)", () => {
    expect(prochaineExecution({ type: "quotidien", heure: 6, minute: 0 }, new Date("2026-12-10T10:00:00Z"))?.toISOString()).toBe("2026-12-11T05:00:00.000Z");
  });
});

describe("libellés et durées", () => {
  it("décrit chaque déclencheur en français", () => {
    expect(libelleDeclencheur({ type: "quotidien", heure: 6, minute: 0 })).toBe("chaque jour à 06:00");
    expect(libelleDeclencheur({ type: "hebdomadaire", jourSemaine: 1, heure: 7, minute: 0 })).toBe("chaque lundi à 07:00");
    expect(libelleDeclencheur({ type: "mensuel", jourMois: 1, heure: 3, minute: 0 })).toBe("le 1er du mois à 03:00");
    expect(libelleDeclencheur({ type: "toutes_les_heures", toutesLes: 6, minute: 10 })).toBe("toutes les 6 heures (minute 10)");
    expect(libelleDeclencheur({ type: "sur_erreur" })).toBe("à l'échec d'un autre workflow");
  });
  it("formate les durées", () => {
    expect(formatDuree(0.42)).toBe("0,4 s");
    expect(formatDuree(21.3)).toBe("21 s");
    expect(formatDuree(125)).toBe("2 min 05 s");
    expect(formatDuree(null)).toBe("n. d.");
  });
  it("traduit les statuts du journal et garde un repli neutre", () => {
    expect(libelleStatut("ok")).toEqual({ texte: "réussi", statut: "succes" });
    expect(libelleStatut("deja_publie").texte).toBe("déjà publié");
    expect(libelleStatut("alerte").statut).toBe("attention");
    expect(libelleStatut("erreur").statut).toBe("alerte");
    expect(libelleStatut("inconnu")).toEqual({ texte: "inconnu", statut: "neutre" });
  });
  it("le catalogue porte un fichier d'export par workflow", () => {
    expect(WORKFLOWS.map((w) => w.code)).toEqual(["WF1", "WF2", "WF5", "WF0"]);
    for (const w of WORKFLOWS) expect(w.fichier).toMatch(/^\/n8n\/wf\d-[a-z-]+\.json$/);
  });
});

describe("resumerJournal", () => {
  const lignes = [
    { workflow: "WF1", debute_le: "2026-09-18T04:00:00Z", statut: "ok" },
    { workflow: "WF2", debute_le: "2026-09-18T04:20:00Z", statut: "alerte" },
    { workflow: "WF5", debute_le: "2026-09-18T10:10:00Z", statut: "erreur" },
    { workflow: "WF5", debute_le: "2026-09-17T22:10:00Z", statut: "erreur" },
    { workflow: "WF1", debute_le: "2026-09-10T04:00:00Z", statut: "ok" },
  ];
  it("compte les exécutions de la fenêtre, les erreurs et retrouve la dernière", () => {
    const r = resumerJournal(lignes, new Date("2026-09-17T00:00:00Z"));
    expect(r).toEqual({ executions: 4, reussites: 2, erreurs: 2, taux_reussite: 50, derniere_erreur: lignes[2] });
    expect(resumerJournal([], new Date())).toEqual({ executions: 0, reussites: 0, erreurs: 0, taux_reussite: null, derniere_erreur: null });
  });
});
