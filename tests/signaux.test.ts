import { describe, expect, it } from "vitest";
import { SEUILS_SIGNAL, signalVariation } from "@/lib/signaux";

describe("signalVariation", () => {
  it("ne signale rien sans valeur", () => {
    expect(signalVariation(undefined)).toBeNull();
    expect(signalVariation({ valeur: null, unite: "pct" })).toBeNull();
    expect(signalVariation({ valeur: Number.NaN, unite: "pts" })).toBeNull();
  });

  it("ne signale rien dans la zone ordinaire", () => {
    expect(signalVariation({ valeur: -19.9, unite: "pct" })).toBeNull();
    expect(signalVariation({ valeur: 9.9, unite: "pct" })).toBeNull();
    expect(signalVariation({ valeur: -4.9, unite: "pts" })).toBeNull();
    expect(signalVariation({ valeur: 2.9, unite: "pts" })).toBeNull();
    expect(signalVariation({ valeur: 0, unite: "pct" })).toBeNull();
  });

  it("alarme à partir de -20 % ou -5 points, seuil inclus", () => {
    expect(signalVariation({ valeur: SEUILS_SIGNAL.pct.alarme, unite: "pct" })).toBe("alarme");
    expect(signalVariation({ valeur: -27.8, unite: "pct" })).toBe("alarme");
    expect(signalVariation({ valeur: SEUILS_SIGNAL.pts.alarme, unite: "pts" })).toBe("alarme");
    expect(signalVariation({ valeur: -8.2, unite: "pts" })).toBe("alarme");
  });

  it("célèbre à partir de +10 % ou +3 points, seuil inclus", () => {
    expect(signalVariation({ valeur: SEUILS_SIGNAL.pct.celebration, unite: "pct" })).toBe("celebration");
    expect(signalVariation({ valeur: 36.8, unite: "pct" })).toBe("celebration");
    expect(signalVariation({ valeur: SEUILS_SIGNAL.pts.celebration, unite: "pts" })).toBe("celebration");
    expect(signalVariation({ valeur: 4.5, unite: "pts" })).toBe("celebration");
  });

  it("inverse le sens quand plus bas vaut mieux (délai, coût, annulation)", () => {
    expect(signalVariation({ valeur: -25, unite: "pct", plusBasMieux: true })).toBe("celebration");
    expect(signalVariation({ valeur: 25, unite: "pct", plusBasMieux: true })).toBe("alarme");
    expect(signalVariation({ valeur: 12, unite: "pct", plusBasMieux: true })).toBeNull();
    expect(signalVariation({ valeur: 6, unite: "pts", plusBasMieux: true })).toBe("alarme");
    expect(signalVariation({ valeur: -3, unite: "pts", plusBasMieux: true })).toBe("celebration");
    expect(signalVariation({ valeur: -4, unite: "pct", plusBasMieux: true })).toBeNull();
  });
});
