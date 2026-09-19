/**
 * Signaux animés des cartes KPI (DESIGN.md §11) : une carte dont l'écart est très défavorable
 * éclate, une carte très au-dessus de sa comparaison lance un feu d'artifice. La règle vit ici,
 * testée, pour qu'aucun seuil ne soit décidé dans un composant.
 *
 * Seuils : en pourcentage (montants, volumes), alarme à -20 % et au-delà, célébration à +10 % et
 * au-delà ; en points (taux), alarme à -5 points, célébration à +3 points. Un indicateur
 * « plus bas = mieux » (délai, coût, annulation) inverse le sens.
 */
export type Signal = "alarme" | "celebration";

export interface VariationSignal {
  valeur: number | null | undefined;
  unite: "pct" | "pts";
  plusBasMieux?: boolean;
}

export const SEUILS_SIGNAL = {
  pct: { alarme: -20, celebration: 10 },
  pts: { alarme: -5, celebration: 3 },
} as const;

/** Signal à jouer pour une variation, ou null quand l'écart reste dans la zone ordinaire. */
export function signalVariation(variation: VariationSignal | undefined): Signal | null {
  if (!variation || variation.valeur === null || variation.valeur === undefined || Number.isNaN(variation.valeur)) return null;
  const sens = variation.plusBasMieux ? -variation.valeur : variation.valeur;
  const seuils = SEUILS_SIGNAL[variation.unite];
  if (sens <= seuils.alarme) return "alarme";
  if (sens >= seuils.celebration) return "celebration";
  return null;
}
