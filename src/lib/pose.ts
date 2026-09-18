/**
 * Pose et encaissement (ECRANS.md §6) : agrégation des vues mart_delais, mart_pose et mart_encaissement sur une
 * période, calendrier de charge semaine × agence, carnet de la dernière semaine. Les médianes ne s'additionnent pas :
 * sur plusieurs mois, on pondère les médianes mensuelles par les poses (approximation dite dans la fiche D_SIGN_POSE).
 */
import { formatNombre } from "@/lib/format";
import { ajouterMois, moisDe, moisEntre, ratio } from "@/lib/periode";

export interface LigneDelais {
  mois: string;
  poses: number;
  poses_dans_les_delais: number;
  delai_signature_pose_median: number | null;
  delai_pose_encaissement_median: number | null;
}

export interface DelaisAgreges {
  poses: number;
  posesDansLesDelais: number;
  tauxDansLesDelais: number | null;
  delaiSignaturePose: number | null;
  delaiPoseEncaissement: number | null;
}

function moyennePonderee(lignes: readonly LigneDelais[], cle: "delai_signature_pose_median" | "delai_pose_encaissement_median"): number | null {
  let somme = 0;
  let poids = 0;
  for (const l of lignes) {
    const v = l[cle];
    if (v === null || l.poses <= 0) continue;
    somme += v * l.poses;
    poids += l.poses;
  }
  return poids > 0 ? Math.round((somme / poids) * 10) / 10 : null;
}

/** Délais de la période (lignes déjà filtrées sur l'agence et le département voulus). */
export function agregerDelais(lignes: readonly LigneDelais[], debut: string, fin: string): DelaisAgreges | null {
  const retenues = lignes.filter((l) => moisDe(l.mois) >= debut && moisDe(l.mois) <= fin);
  if (retenues.length === 0) return null;
  const poses = retenues.reduce((s, l) => s + l.poses, 0);
  const posesDansLesDelais = retenues.reduce((s, l) => s + l.poses_dans_les_delais, 0);
  return {
    poses, posesDansLesDelais,
    tauxDansLesDelais: ratio(posesDansLesDelais, poses, 100),
    delaiSignaturePose: moyennePonderee(retenues, "delai_signature_pose_median"),
    delaiPoseEncaissement: moyennePonderee(retenues, "delai_pose_encaissement_median"),
  };
}

export interface LignePose {
  semaine: string;
  agence: string;
  capacite_jt_semaine: number;
  jt_poses: number;
  poses: number;
  poses_planifiees: number;
  charge_planifiee_pct: number | null;
  carnet_jours_ouvres: number | null;
  poses_en_retard: number | null;
  dossiers_a_poser: number | null;
}

export interface CelluleCharge {
  semaine: string;
  agence: string;
  /** Charge en pourcentage de la capacité : réalisée (jours-technicien posés) pour une semaine passée, planifiée sinon. */
  charge: number | null;
  type: "realisee" | "planifiee";
  poses: number;
}

/** Semaine (lundi) de la journée publiée : les semaines strictement avant sont réalisées, les autres planifiées. */
export function lundiDe(jour: string): string {
  const d = new Date(`${jour.slice(0, 10)}T00:00:00Z`);
  const decalage = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - decalage);
  return d.toISOString().slice(0, 10);
}

/** Calendrier de charge : les `passees` semaines réalisées avant la semaine courante, puis la semaine courante et les `futures` suivantes, planifiées. */
export function calendrierCharge(lignes: readonly LignePose[], journee: string, agences: readonly string[], passees = 4, futures = 11): { semaines: string[]; cellules: CelluleCharge[] } {
  const courante = lundiDe(journee);
  const toutes = [...new Set(lignes.map((l) => l.semaine.slice(0, 10)))].sort();
  const avant = toutes.filter((s) => s < courante).slice(-passees);
  const apres = toutes.filter((s) => s >= courante).slice(0, futures + 1);
  const semaines = [...avant, ...apres];
  const cellules: CelluleCharge[] = [];
  for (const agence of agences) {
    for (const semaine of semaines) {
      const l = lignes.find((x) => x.agence === agence && x.semaine.slice(0, 10) === semaine);
      const realisee = semaine < courante;
      cellules.push({
        semaine, agence, type: realisee ? "realisee" : "planifiee",
        poses: l ? (realisee ? l.poses : l.poses_planifiees) : 0,
        charge: l ? (realisee ? ratio(l.jt_poses, l.capacite_jt_semaine, 100) : l.charge_planifiee_pct) : null,
      });
    }
  }
  return { semaines, cellules };
}

/**
 * Phrase de tendance du carnet contre la semaine précédente, sur les valeurs arrondies telles qu'affichées :
 * « en baisse (26) » à côté de 26 n'est pas acceptable ; en dessous d'un demi-jour d'écart, le carnet est stable.
 */
export function phraseTendanceCarnet(carnet: number | null, precedent: number | null): string {
  if (carnet === null || precedent === null) return "";
  const a = Math.round(carnet), b = Math.round(precedent);
  const sens = a === b ? "stable par rapport à" : a > b ? "en hausse sur" : "en baisse sur";
  return `, ${sens} la semaine précédente (${formatNombre(b)})`;
}

export interface CarnetSemaine {
  semaine: string;
  carnet: number | null;
  carnetPrecedent: number | null;
  posesEnRetard: number | null;
  dossiersAPoser: number | null;
}

/** Carnet de la dernière semaine renseignée au plus tard à la journée publiée, et celui de la semaine précédente. */
export function carnetDerniereSemaine(lignes: readonly LignePose[], agence: string, journee: string): CarnetSemaine | null {
  const courante = lundiDe(journee);
  const retenues = lignes.filter((l) => l.agence === agence && l.semaine.slice(0, 10) <= courante && l.carnet_jours_ouvres !== null).sort((a, b) => a.semaine.localeCompare(b.semaine));
  const derniere = retenues.at(-1);
  if (!derniere) return null;
  const precedente = retenues.at(-2);
  return {
    semaine: derniere.semaine.slice(0, 10), carnet: derniere.carnet_jours_ouvres, carnetPrecedent: precedente?.carnet_jours_ouvres ?? null,
    posesEnRetard: derniere.poses_en_retard, dossiersAPoser: derniere.dossiers_a_poser,
  };
}

export interface LigneEncaissement {
  mois: string;
  encaisse: number;
  encaissements: number;
  delai_pose_encaissement_median: number | null;
  en_attente_encaissement: number | null;
  retards_encaissement: number | null;
  aides_en_attente: number | null;
}

export interface EncaissementAgrege {
  encaisse: number;
  encaissements: number;
  /** Médianes mensuelles pondérées par les encaissements (approximation). */
  delaiPoseEncaissement: number | null;
}

/** Encaissé sur la période (sommes), délai pondéré par les encaissements. */
export function agregerEncaissement(lignes: readonly LigneEncaissement[], debut: string, fin: string): EncaissementAgrege | null {
  const retenues = lignes.filter((l) => moisDe(l.mois) >= debut && moisDe(l.mois) <= fin);
  if (retenues.length === 0) return null;
  let somme = 0;
  let poids = 0;
  for (const l of retenues) {
    if (l.delai_pose_encaissement_median === null || l.encaissements <= 0) continue;
    somme += l.delai_pose_encaissement_median * l.encaissements;
    poids += l.encaissements;
  }
  return {
    encaisse: retenues.reduce((s, l) => s + l.encaisse, 0),
    encaissements: retenues.reduce((s, l) => s + l.encaissements, 0),
    delaiPoseEncaissement: poids > 0 ? Math.round((somme / poids) * 10) / 10 : null,
  };
}

/** Encaissement N-1 de la période, chaque mois ramené au prorata du mois courant correspondant (1 pour un mois complet). */
export function agregerEncaissementN1(lignes: readonly LigneEncaissement[], debut: string, fin: string, prorataParMois: ReadonlyMap<string, number>): EncaissementAgrege | null {
  const ponderees: LigneEncaissement[] = [];
  for (const mois of moisEntre(debut, fin)) {
    const ligne = lignes.find((l) => moisDe(l.mois) === ajouterMois(mois, -12));
    if (!ligne) continue;
    const poids = prorataParMois.get(mois) ?? 1;
    ponderees.push({ ...ligne, encaisse: Math.round(ligne.encaisse * poids), encaissements: Math.round(ligne.encaissements * poids) });
  }
  if (ponderees.length === 0) return null;
  return agregerEncaissement(ponderees, ajouterMois(debut, -12), ajouterMois(fin, -12));
}
