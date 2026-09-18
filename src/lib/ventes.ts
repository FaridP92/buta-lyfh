import { moisDe } from "@/lib/periode";

/**
 * Agrégation de mart_ventes_produit sur une période (ECRANS.md §4) : sommes des mesures additives,
 * ratios recalculés depuis les sommes. Le taux de remise est pondéré par le prix catalogue des ventes
 * (prix catalogue moyen × ventes) ; les taux d'annulation à distance et sur place sont pondérés par
 * leurs dénominateurs, ce qui reconstitue le ratio des sommes à l'arrondi SQL près (une décimale).
 */
export interface LigneVenteProduit {
  mois: string;
  agence: string;
  produit: string;
  ventes: number;
  signatures_brutes: number;
  annulees_60j: number;
  ca_signe: number | null;
  marge_brute: number | null;
  prix_catalogue_moyen: number | null;
  taux_remise: number | null;
  signatures_a_distance: number;
  taux_annulation_a_distance: number | null;
  taux_annulation_sur_place: number | null;
}

export interface VentesAgregees {
  mois: number;
  ventes: number;
  signatures_brutes: number;
  annulees_60j: number;
  ca_signe: number;
  marge_brute: number;
  taux_marge: number | null;
  panier_moyen: number | null;
  taux_remise: number | null;
  taux_annulation: number | null;
  signatures_a_distance: number;
  signatures_sur_place: number;
  taux_annulation_a_distance: number | null;
  taux_annulation_sur_place: number | null;
}

function ratio(numerateur: number, denominateur: number, facteur = 1, decimales = 1): number | null {
  if (!denominateur) return null;
  const f = Math.pow(10, decimales);
  return Math.round((facteur * numerateur / denominateur) * f) / f;
}

export function agregerVentes(lignes: readonly LigneVenteProduit[], debut: string, fin: string): VentesAgregees | null {
  const retenues = lignes.filter((l) => moisDe(l.mois) >= debut && moisDe(l.mois) <= fin);
  if (retenues.length === 0) return null;
  const somme = (f: (l: LigneVenteProduit) => number | null | undefined) => retenues.reduce((s, l) => s + (f(l) ?? 0), 0);
  const ventes = somme((l) => l.ventes);
  const ca = somme((l) => l.ca_signe);
  const marge = somme((l) => l.marge_brute);
  const signatures = somme((l) => l.signatures_brutes);
  const annulees = somme((l) => l.annulees_60j);
  const catalogue = somme((l) => (l.prix_catalogue_moyen ?? 0) * l.ventes);
  const remises = somme((l) => ((l.taux_remise ?? 0) / 100) * (l.prix_catalogue_moyen ?? 0) * l.ventes);
  const aDistance = somme((l) => l.signatures_a_distance);
  const surPlace = signatures - aDistance;
  const annuleesDistance = somme((l) => ((l.taux_annulation_a_distance ?? 0) / 100) * l.signatures_a_distance);
  const annuleesSurPlace = somme((l) => ((l.taux_annulation_sur_place ?? 0) / 100) * (l.signatures_brutes - l.signatures_a_distance));
  return {
    mois: new Set(retenues.map((l) => moisDe(l.mois))).size,
    ventes, signatures_brutes: signatures, annulees_60j: annulees, ca_signe: ca, marge_brute: marge,
    taux_marge: ratio(marge, ca, 100),
    panier_moyen: ratio(ca, ventes, 1, 0),
    taux_remise: ratio(remises, catalogue, 100),
    taux_annulation: ratio(annulees, signatures, 100),
    signatures_a_distance: aDistance, signatures_sur_place: surPlace,
    taux_annulation_a_distance: ratio(annuleesDistance, aDistance, 100),
    taux_annulation_sur_place: ratio(annuleesSurPlace, surPlace, 100),
  };
}

/** Agrégats par valeur d'une clé (produit ou agence), dans l'ordre d'apparition des lignes. */
export function agregerVentesPar(lignes: readonly LigneVenteProduit[], cle: "produit" | "agence", debut: string, fin: string): Map<string, VentesAgregees> {
  const groupes = new Map<string, LigneVenteProduit[]>();
  for (const l of lignes) {
    const valeur = l[cle];
    const groupe = groupes.get(valeur);
    if (groupe) groupe.push(l);
    else groupes.set(valeur, [l]);
  }
  const resultat = new Map<string, VentesAgregees>();
  for (const [valeur, groupe] of groupes) {
    const agrege = agregerVentes(groupe, debut, fin);
    if (agrege) resultat.set(valeur, agrege);
  }
  return resultat;
}

/** Série mensuelle d'une mesure par produit (barres empilées) : mois croissants, produits dans l'ordre donné. */
export function serieMensuelleParProduit(lignes: readonly LigneVenteProduit[], produits: readonly string[], debut: string, fin: string, mesure: "ca_signe" | "ventes" | "marge_brute"): { mois: string[]; series: { produit: string; valeurs: (number | null)[] }[]; tauxMarge: (number | null)[] } {
  const retenues = lignes.filter((l) => moisDe(l.mois) >= debut && moisDe(l.mois) <= fin);
  const mois = [...new Set(retenues.map((l) => moisDe(l.mois)))].sort();
  const series = produits.map((produit) => ({
    produit,
    valeurs: mois.map((m) => {
      const ligne = retenues.find((l) => l.produit === produit && moisDe(l.mois) === m);
      return ligne ? (ligne[mesure] ?? 0) : null;
    }),
  }));
  const tauxMarge = mois.map((m) => {
    const duMois = retenues.filter((l) => moisDe(l.mois) === m && produits.includes(l.produit));
    const ca = duMois.reduce((s, l) => s + (l.ca_signe ?? 0), 0);
    const marge = duMois.reduce((s, l) => s + (l.marge_brute ?? 0), 0);
    return ratio(marge, ca, 100);
  });
  return { mois, series, tauxMarge };
}
