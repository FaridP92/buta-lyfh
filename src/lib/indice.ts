/**
 * INDICE (INDICATEURS.md) : indice de potentiel territorial recalculé côté client quand l'utilisateur
 * déplace les poids. Les composantes sont des rangs centiles (0 à 100) calculés en SQL ; ici seule la
 * pondération change. Aux poids par défaut, le résultat est celui de la vue.
 */
export interface Composantes {
  volume: number;
  intensiteFioul: number;
  intensiteFg: number;
  frein: number;
  saturation: number;
}

export interface Poids {
  /** Poids des trois composantes positives, normalisés entre eux au calcul. */
  volume: number;
  intensiteFioul: number;
  intensiteFg: number;
  /** Intensité des deux pénalités : indice × (1 - poids × composante / 100). */
  frein: number;
  saturation: number;
}

export const POIDS_DEFAUT: Poids = { volume: 0.4, intensiteFioul: 0.3, intensiteFg: 0.3, frein: 0.3, saturation: 0.3 };

export const LIBELLES_COMPOSANTES: Record<keyof Composantes, string> = {
  volume: "Volume de propriétaires occupants",
  intensiteFioul: "Intensité fioul et gaz citerne",
  intensiteFg: "Intensité maisons F ou G",
  frein: "Frein concurrence (RGE pour 10 000 maisons)",
  saturation: "Saturation solaire (pour 1 000 maisons)",
};

/** Indice 0 à 100, deux décimales ; null si une composante manque. */
export function calculerIndice(c: Partial<Record<keyof Composantes, number | null>>, poids: Poids = POIDS_DEFAUT): number | null {
  const { volume, intensiteFioul, intensiteFg, frein, saturation } = c;
  if ([volume, intensiteFioul, intensiteFg, frein, saturation].some((v) => v === null || v === undefined || Number.isNaN(v))) return null;
  const sommePositifs = poids.volume + poids.intensiteFioul + poids.intensiteFg;
  if (sommePositifs <= 0) return null;
  const base = (poids.volume * (volume as number) + poids.intensiteFioul * (intensiteFioul as number) + poids.intensiteFg * (intensiteFg as number)) / sommePositifs;
  const valeur = base * (1 - (poids.frein * (frein as number)) / 100) * (1 - (poids.saturation * (saturation as number)) / 100);
  return Math.round(Math.max(0, valeur) * 100) / 100;
}

export function poidsParDefaut(poids: Poids): boolean {
  return (Object.keys(POIDS_DEFAUT) as (keyof Poids)[]).every((k) => Math.abs(poids[k] - POIDS_DEFAUT[k]) < 1e-9);
}

/** Recalcule l'indice d'une liste de territoires ; renvoie la liste triée par indice décroissant. */
export function recalculerIndices<T extends { composantes: Partial<Record<keyof Composantes, number | null>> }>(territoires: readonly T[], poids: Poids): (T & { indiceRecalcule: number | null })[] {
  return territoires
    .map((t) => ({ ...t, indiceRecalcule: calculerIndice(t.composantes, poids) }))
    .sort((a, b) => (b.indiceRecalcule ?? -1) - (a.indiceRecalcule ?? -1));
}
