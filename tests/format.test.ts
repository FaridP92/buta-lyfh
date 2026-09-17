import { describe, expect, it } from "vitest";
import {
  formatDateCourte,
  formatDelaiJours,
  formatMoisAbrege,
  formatMontant,
  formatNombre,
  formatTaux,
  formatVariationPoints,
} from "@/lib/format";

describe("formatMontant", () => {
  it("affiche n. d. pour une valeur absente", () => {
    expect(formatMontant(null)).toBe("n. d.");
    expect(formatMontant(undefined)).toBe("n. d.");
    expect(formatMontant(Number.NaN)).toBe("n. d.");
  });

  it("affiche les euros sans decimale sous 10 000", () => {
    expect(formatMontant(0)).toBe("0 €");
    expect(formatMontant(1234)).toBe("1 234 €");
  });

  it("bascule en k€ a partir de 10 000", () => {
    expect(formatMontant(12_500)).toBe("12,5 k€");
  });

  it("bascule en M€ a partir de 1 000 000", () => {
    expect(formatMontant(2_340_000)).toBe("2,3 M€");
  });
});

describe("formatTaux", () => {
  it("affiche une decimale avec la virgule francaise et l'espace fine", () => {
    expect(formatTaux(12.34)).toBe("12,3 %");
  });

  it("affiche n. d. pour une valeur absente", () => {
    expect(formatTaux(null)).toBe("n. d.");
  });
});

describe("formatVariationPoints", () => {
  it("ajoute le signe plus pour une variation positive", () => {
    expect(formatVariationPoints(4.2)).toBe("+4,2 pts");
  });

  it("ne force pas de signe pour une variation negative", () => {
    expect(formatVariationPoints(-1.5)).toBe("-1,5 pt");
  });
});

describe("formatDelaiJours", () => {
  it("arrondit et suffixe j", () => {
    expect(formatDelaiJours(44.6)).toBe("45 j");
  });
});

describe("formatNombre", () => {
  it("groupe les milliers avec l'espace fine", () => {
    expect(formatNombre(1600)).toBe("1 600");
  });
});

describe("formatMoisAbrege", () => {
  it("abrege a la francaise", () => {
    expect(formatMoisAbrege("2026-02-15")).toBe("fevr. 2026");
  });
});

describe("formatDateCourte", () => {
  it("formate en JJ/MM", () => {
    expect(formatDateCourte("2026-09-21")).toBe("21/09");
  });
});
