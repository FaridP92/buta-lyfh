import { describe, expect, it } from "vitest";
import {
  formatDateCourte,
  formatDateAnnee,
  formatNombreDecimal,
  formatDelaiJours,
  formatMoisAbrege,
  formatMontant,
  formatNombre,
  formatProbabilite,
  formatTaux,
  formatVariationPoints,
} from "@/lib/format";

describe("formatMontant", () => {
  it("affiche n. d. pour une valeur absente", () => {
    expect(formatMontant(null)).toBe("n. d.");
    expect(formatMontant(undefined)).toBe("n. d.");
    expect(formatMontant(Number.NaN)).toBe("n. d.");
  });

  it("affiche les euros sans décimale sous 10 000", () => {
    expect(formatMontant(0)).toBe("0 €");
    expect(formatMontant(1234)).toBe("1 234 €");
  });

  it("bascule en k€ à partir de 10 000", () => {
    expect(formatMontant(12_500)).toBe("12,5 k€");
  });

  it("bascule en M€ à partir de 1 000 000", () => {
    expect(formatMontant(2_340_000)).toBe("2,3 M€");
  });
});

describe("formatTaux", () => {
  it("affiche une décimale avec la virgule française et l'espace fine", () => {
    expect(formatTaux(12.34)).toBe("12,3 %");
  });

  it("affiche n. d. pour une valeur absente", () => {
    expect(formatTaux(null)).toBe("n. d.");
  });
});

describe("formatProbabilite", () => {
  it("borne la lecture sous 1 % et au-dessus de 99 %", () => {
    expect(formatProbabilite(0.2)).toBe("< 1 %");
    expect(formatProbabilite(99.7)).toBe("> 99 %");
  });

  it("arrondit à l'entier entre les deux bornes", () => {
    expect(formatProbabilite(42.6)).toBe("43 %");
    expect(formatProbabilite(null)).toBe("n. d.");
  });
});

describe("formatVariationPoints", () => {
  it("ajoute le signe plus pour une variation positive", () => {
    expect(formatVariationPoints(4.2)).toBe("+4,2 pts");
  });

  it("ne force pas de signe pour une variation négative", () => {
    expect(formatVariationPoints(-1.5)).toBe("-1,5 pt");
  });
});

describe("formatDelaiJours", () => {
  it("arrondit et suffixe j", () => {
    expect(formatDelaiJours(44.6)).toBe("45 j");
  });
});

describe("formatNombre", () => {
  it("groupe les milliers avec l'espace fine", () => {
    expect(formatNombre(1600)).toBe("1 600");
  });
});

describe("formatMoisAbrege", () => {
  it("abrège à la française", () => {
    expect(formatMoisAbrege("2026-02-15")).toBe("févr. 2026");
  });
});

describe("formatDateCourte", () => {
  it("formate en JJ/MM", () => {
    expect(formatDateCourte("2026-09-21")).toBe("21/09");
  });
});

describe("formatDateAnnee", () => {
  it("garde l'année pour les millésimes et les échéances lointaines", () => {
    expect(formatDateAnnee("2022-01-01")).toBe("01/01/2022");
    expect(formatDateAnnee("2027-06-30")).toBe("30/06/2027");
  });
});

describe("formatNombreDecimal", () => {
  it("écrit des décimales fixes à la française", () => {
    expect(formatNombreDecimal(2.345, 1)).toBe("2,3");
    expect(formatNombreDecimal(1234.5, 2)).toBe("1 234,50");
    expect(formatNombreDecimal(null)).toBe("n. d.");
  });
});
