import { formatMontant, formatNombre, formatProbabilite, formatTaux } from "@/lib/format";

/**
 * Atterrissage (ECRANS.md §5, INDICATEURS.md ATTERR et P_ATTEINTE) : reproduit côté client la formule
 * de mart_forecast pour que le curseur « taux de signature du pipe » recalcule le central, les bornes et
 * la probabilité sans écrire en base. Au curseur par défaut, le résultat est celui de la vue.
 */
export interface HypothesesAtterrissage {
  realiseADate: number;
  objectifAnnuel: number;
  /** Pipe pondéré calculé en SQL (devis en cours × taux par tranche d'âge × (1 - annulation)). */
  pipePondere: number;
  montantDevisEnCours: number;
  /** Somme des mois restants du run-rate saisonnalisé, en euros. */
  projectionRunRate: number;
  moisRestants: number;
  sigmaMensuel: number;
}

export interface Atterrissage {
  pipe: number;
  central: number;
  bas: number;
  haut: number;
  /** Probabilité de dépasser l'objectif, en pourcentage arrondi à 5 points comme en SQL ; null sans objectif. */
  probabilite: number | null;
  ecartPct: number | null;
}

/** Fonction de répartition de la loi normale centrée réduite (Abramowitz et Stegun 7.1.26, erreur < 1,5e-7). */
export function phi(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const densite = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const queue = densite * poly;
  return z >= 0 ? 1 - queue : queue;
}

/** Part du run-rate retenue au-delà des 45 jours couverts par le pipe : max(R - 1,5 ; 0) / R. */
function partRunRate(moisRestants: number): number {
  return moisRestants > 0 ? Math.max(moisRestants - 1.5, 0) / moisRestants : 0;
}

/**
 * Recalcule l'atterrissage. Sans `tauxSignaturePipe`, le pipe SQL est repris tel quel ; avec, le pipe
 * vaut montant des devis en cours × taux (en pourcentage, annulation comprise).
 */
export function recalculerAtterrissage(h: HypothesesAtterrissage, tauxSignaturePipe?: number): Atterrissage {
  const pipe = tauxSignaturePipe === undefined ? h.pipePondere : Math.round((h.montantDevisEnCours * tauxSignaturePipe) / 100);
  // Bornes et probabilité calculées sur le central non arrondi, comme en SQL ; arrondis à l'euro en sortie.
  const centralBrut = h.realiseADate + pipe + h.projectionRunRate * partRunRate(h.moisRestants);
  const largeur = h.sigmaMensuel * Math.sqrt(h.moisRestants);
  let probabilite: number | null = null;
  if (h.objectifAnnuel > 0) {
    if (h.moisRestants === 0) probabilite = h.realiseADate >= h.objectifAnnuel ? 100 : 0;
    else if (h.sigmaMensuel > 0) probabilite = Math.round((100 * phi((centralBrut - h.objectifAnnuel) / largeur)) / 5) * 5;
  }
  const ecartPct = h.objectifAnnuel > 0 ? Math.round(((centralBrut - h.objectifAnnuel) / h.objectifAnnuel) * 1000) / 10 : null;
  return { pipe, central: Math.round(centralBrut), bas: Math.round(centralBrut - largeur), haut: Math.round(centralBrut + largeur), probabilite, ecartPct };
}

export interface Trajectoire {
  /** Douze mois de l'année, « AAAA-MM ». */
  mois: string[];
  /** Cumul réalisé jusqu'au mois courant inclus (à date), null au-delà. */
  realiseCumule: (number | null)[];
  /** Cumul de l'objectif mensuel. */
  objectifCumule: (number | null)[];
  /** Trajectoires projetées du mois courant (point d'attache) à décembre, null avant. */
  central: (number | null)[];
  bas: (number | null)[];
  haut: (number | null)[];
}

/**
 * Trajectoire cumulée de l'année : réalisé mensuel cumulé, objectif cumulé, puis projection mois par mois.
 * Le pipe se convertit sur 45 jours (1,5 mois), le run-rate prend le relais ; l'intervalle s'élargit en racine
 * du nombre de mois, ce qui redonne exactement les bornes de la vue en décembre.
 */
export function trajectoire(annee: number, moisCourant: number, realiseMensuel: readonly (number | null)[], objectifMensuel: readonly (number | null)[], h: HypothesesAtterrissage, tauxSignaturePipe?: number): Trajectoire {
  const mois = Array.from({ length: 12 }, (_, i) => `${annee}-${String(i + 1).padStart(2, "0")}`);
  const a = recalculerAtterrissage(h, tauxSignaturePipe);
  const R = h.moisRestants;
  let cumulRealise = 0;
  let cumulObjectif = 0;
  const realiseCumule: (number | null)[] = [];
  const objectifCumule: (number | null)[] = [];
  const central: (number | null)[] = [];
  const bas: (number | null)[] = [];
  const haut: (number | null)[] = [];
  for (let m = 1; m <= 12; m++) {
    cumulObjectif += objectifMensuel[m - 1] ?? 0;
    objectifCumule.push(Math.round(cumulObjectif));
    if (m <= moisCourant) {
      cumulRealise += realiseMensuel[m - 1] ?? 0;
      realiseCumule.push(Math.round(cumulRealise));
    } else {
      realiseCumule.push(null);
    }
    if (m < moisCourant) {
      central.push(null);
      bas.push(null);
      haut.push(null);
    } else if (m === moisCourant) {
      central.push(Math.round(h.realiseADate));
      bas.push(Math.round(h.realiseADate));
      haut.push(Math.round(h.realiseADate));
    } else {
      const k = m - moisCourant;
      const valeur = h.realiseADate + a.pipe * Math.min(k / 1.5, 1) + (R > 0 ? (h.projectionRunRate / R) * Math.max(k - 1.5, 0) : 0);
      const largeur = h.sigmaMensuel * Math.sqrt(k);
      central.push(Math.round(valeur));
      bas.push(Math.round(valeur - largeur));
      haut.push(Math.round(valeur + largeur));
    }
  }
  return { mois, realiseCumule, objectifCumule, central, bas, haut };
}

export interface AgenceAtterrissage {
  code: string;
  nom: string;
  realise: number;
  objectif: number;
  central: number | null;
  bas: number | null;
  haut: number | null;
  probabilite: number | null;
  ecartPct: number | null;
  pipePondere: number;
  montantDevis: number;
  runRate3m: number;
}

export interface PoseAgence {
  code: string;
  posesEnRetard: number | null;
  panierMoyen: number | null;
}

export interface Signal {
  type: "risque" | "opportunite";
  agence: string;
  texte: string;
  montant: number;
  /** Ce que mesure le montant, pour la colonne. */
  montantLibelle: string;
}

const RETARDS_MINIMUM = 5;

/**
 * Risques et opportunités par règles (ECRANS.md §5). Chaque signal porte un montant en euros et le libellé
 * de ce montant ; le CA posé à risque est une estimation (poses en retard × panier moyen de l'agence) et le dit.
 */
export function risquesEtOpportunites(agences: readonly AgenceAtterrissage[], poses: readonly PoseAgence[]): Signal[] {
  const signaux: Signal[] = [];
  for (const a of agences) {
    const pose = poses.find((p) => p.code === a.code);
    if (pose && pose.posesEnRetard !== null && pose.posesEnRetard >= RETARDS_MINIMUM && pose.panierMoyen !== null) {
      const montant = Math.round(pose.posesEnRetard * pose.panierMoyen);
      signaux.push({ type: "risque", agence: a.nom, montant, montantLibelle: "CA posé à risque (estimation : poses en retard × panier moyen)", texte: `${a.nom} : ${formatNombre(pose.posesEnRetard)} poses en retard, CA posé à risque ${formatMontant(montant)}` });
    }
    if (a.central !== null && a.ecartPct !== null && a.ecartPct <= -10 && a.objectif > 0) {
      signaux.push({ type: "risque", agence: a.nom, montant: a.objectif - a.central, montantLibelle: "écart entre l'objectif et l'atterrissage central", texte: `${a.nom} : atterrissage central ${formatMontant(a.central)}, ${formatTaux(Math.abs(a.ecartPct))} sous l'objectif (${formatMontant(a.objectif)})${a.probabilite !== null ? `, probabilité d'atteinte ${formatProbabilite(a.probabilite)}` : ""}` });
    }
    if (a.runRate3m > 0 && a.montantDevis < a.runRate3m) {
      signaux.push({ type: "risque", agence: a.nom, montant: a.runRate3m - a.montantDevis, montantLibelle: "devis en cours manquants pour couvrir un mois de run-rate", texte: `${a.nom} : ${formatMontant(a.montantDevis)} de devis en cours, moins d'un mois de run-rate (${formatMontant(a.runRate3m)})` });
    }
    if (a.probabilite !== null && a.probabilite >= 50 && a.central !== null && a.ecartPct !== null) {
      signaux.push({ type: "opportunite", agence: a.nom, montant: a.central - a.objectif, montantLibelle: "avance de l'atterrissage central sur l'objectif", texte: `${a.nom} : atterrissage central ${formatMontant(a.central)}, ${a.ecartPct >= 0 ? "+" : ""}${formatTaux(a.ecartPct)} vs objectif, probabilité d'atteinte ${formatProbabilite(a.probabilite)}` });
    } else if (a.haut !== null && a.central !== null && a.haut >= a.objectif && a.central < a.objectif && a.objectif > 0) {
      signaux.push({ type: "opportunite", agence: a.nom, montant: a.objectif - a.central, montantLibelle: "reste à signer pour atteindre l'objectif", texte: `${a.nom} : la borne haute (${formatMontant(a.haut)}) dépasse l'objectif, ${formatMontant(a.objectif - a.central)} à trouver au-delà du central` });
    }
    if (a.runRate3m > 0 && a.pipePondere >= 1.5 * a.runRate3m) {
      signaux.push({ type: "opportunite", agence: a.nom, montant: a.pipePondere - 1.5 * a.runRate3m, montantLibelle: "pipe pondéré au-delà de 45 jours de run-rate", texte: `${a.nom} : pipe pondéré ${formatMontant(a.pipePondere)}, au-dessus de 45 jours de run-rate (${formatMontant(1.5 * a.runRate3m)})` });
    }
  }
  return signaux.sort((x, y) => (x.type === y.type ? y.montant - x.montant : x.type === "risque" ? -1 : 1));
}
