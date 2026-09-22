import { describe, expect, it } from "vitest";
import { ROUTES } from "@/app/routes";
import { GUIDES_ECRANS, guideEcran, PROFILS } from "@/lib/guideEcrans";

const TIRETS_LONGS = [0x2014, 0x2013, 0x2015].map((point) => String.fromCodePoint(point));

function textes(valeur: unknown): string[] {
  if (typeof valeur === "string") return [valeur];
  if (Array.isArray(valeur)) return valeur.flatMap(textes);
  if (valeur && typeof valeur === "object") return Object.values(valeur).flatMap(textes);
  return [];
}

describe("guide des écrans", () => {
  it("couvre chaque écran de la navigation, dans le même ordre, et rien d'autre", () => {
    expect(GUIDES_ECRANS.map((g) => g.chemin)).toEqual(ROUTES.filter((r) => r.disponible).map((r) => r.chemin));
    for (const route of ROUTES.filter((r) => r.disponible)) {
      expect(guideEcran(route.chemin)?.libelle).toBe(route.libelle);
    }
    expect(guideEcran("/inconnu")).toBeUndefined();
  });

  it("renseigne chaque rubrique et chaque profil, sans texte vide", () => {
    for (const guide of GUIDES_ECRANS) {
      expect(guide.question.length).toBeGreaterThan(5);
      expect(guide.decision.length).toBeGreaterThan(20);
      expect(guide.contenu.length).toBeGreaterThanOrEqual(3);
      expect(guide.sources.length).toBeGreaterThanOrEqual(1);
      expect(guide.vise.length).toBeGreaterThanOrEqual(2);
      for (const p of PROFILS) expect(guide.lectures[p.code].length).toBeGreaterThan(20);
      for (const t of textes(guide)) expect(t.trim()).toBe(t);
    }
  });

  it("ne porte aucun tiret long, aucun superlatif, aucun nom d'agence réelle", () => {
    for (const t of [...textes(GUIDES_ECRANS), ...textes(PROFILS)]) {
      for (const tiret of TIRETS_LONGS) expect(t).not.toContain(tiret);
      expect(t).not.toMatch(/meilleur|révolutionnaire|exceptionnel/i);
    }
  });

  it("propose à chaque profil un parcours d'écrans existants, sans doublon", () => {
    const chemins = new Set(GUIDES_ECRANS.map((g) => g.chemin));
    for (const p of PROFILS) {
      expect(p.parcours.length).toBeGreaterThanOrEqual(4);
      expect(new Set(p.parcours).size).toBe(p.parcours.length);
      for (const c of p.parcours) expect(chemins.has(c)).toBe(true);
    }
  });
});
