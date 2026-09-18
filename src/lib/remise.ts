import { formatNombre, formatTaux } from "@/lib/format";

/**
 * ELAST_REMISE (INDICATEURS.md) : pente du taux de signature des devis en fonction du taux de remise,
 * estimée par régression pondérée à effets fixes agence sur les couples agence × mois de mart_remises,
 * puis lecture économique : niveau de remise qui maximise la marge sous ce modèle linéaire, et pente
 * qu'il faudrait pour qu'une remise de référence (8 %) soit ce niveau. Démonstration de méthode sur
 * un jeu simulé, jamais une règle de gestion.
 */
export interface PointRemise {
  agence: string;
  periode: string;
  devis: number;
  signatures: number;
  /** Signatures / devis, en pourcentage. */
  taux_signature: number | null;
  /** Taux de remise moyen des devis, en pourcentage. */
  remise_moyenne: number | null;
  /** (prix catalogue - coûts) / prix catalogue des dossiers signés, en pourcentage. */
  marge_avant_remise: number | null;
  periode_complete: boolean;
}

export interface ElasticiteRemise {
  /** Couples agence × mois retenus et agences représentées. */
  points: number;
  agences: number;
  /** Points de signature gagnés par point de remise, et intervalle à 95 %. */
  pente: number;
  erreurType: number;
  intervalle: [number, number];
  /** Taux de signature moyen (pondéré par les devis), remise moyenne et marge avant remise des points retenus, en pourcentage. */
  tauxSignature: number;
  remiseMoyenne: number;
  margeAvantRemise: number;
  /** Remise qui maximise la marge sous le modèle linéaire, en pourcentage ; 0 quand aucune remise ne se paie. */
  seuil: number;
  /** Même seuil calculé avec la borne haute de l'intervalle : la lecture la plus favorable à la remise. */
  seuilBorneHaute: number;
  /** Remise de référence de la phrase de méthode et pente qu'il faudrait pour qu'elle soit optimale. */
  remiseReference: number;
  penteRequise: number | null;
}

const QUANTILE_95 = 1.96;

/** Point d'une agence × mois exploitable : période close, échantillon suffisant, valeurs présentes. */
function exploitable(p: PointRemise, devisMinimum: number): p is PointRemise & { taux_signature: number; remise_moyenne: number } {
  return p.periode_complete && p.agence !== "RESEAU" && p.devis >= devisMinimum && p.taux_signature !== null && p.remise_moyenne !== null;
}

/**
 * Remise qui maximise D × s(r) × (m - r) quand s(r) = s0 + b (r - r0) : r* = (m + r0) / 2 - s0 / (2 b).
 * Si b est nul ou négatif, ou si r* est négatif, la marge décroît dès la première remise : 0.
 */
export function seuilRentable(pente: number, tauxSignature: number, remiseMoyenne: number, margeAvantRemise: number): number {
  if (pente <= 0) return 0;
  const r = (margeAvantRemise + remiseMoyenne) / 2 - tauxSignature / (2 * pente);
  return r > 0 ? Math.round(r * 10) / 10 : 0;
}

/** Pente pour laquelle la remise de référence serait le niveau optimal : b = s0 / (m + r0 - 2 r_ref). */
export function penteRequise(remiseReference: number, tauxSignature: number, remiseMoyenne: number, margeAvantRemise: number): number | null {
  const denominateur = margeAvantRemise + remiseMoyenne - 2 * remiseReference;
  if (denominateur <= 0) return null;
  return Math.round((tauxSignature / denominateur) * 100) / 100;
}

export function estimerElasticite(points: readonly PointRemise[], options?: { devisMinimum?: number; remiseReference?: number }): ElasticiteRemise | null {
  const devisMinimum = options?.devisMinimum ?? 20;
  const remiseReference = options?.remiseReference ?? 8;
  const retenus = points.filter((p) => exploitable(p, devisMinimum));
  const agences = new Set(retenus.map((p) => p.agence));
  if (retenus.length < agences.size + 3 || agences.size === 0) return null;

  // Poids normalisés (somme = n) pour que la variance résiduelle garde l'échelle d'une observation.
  const totalDevis = retenus.reduce((s, p) => s + p.devis, 0);
  const n = retenus.length;
  const poids = retenus.map((p) => (p.devis * n) / totalDevis);

  // Effets fixes agence : centrage pondéré de x et y par agence.
  const moyennes = new Map<string, { sw: number; sx: number; sy: number }>();
  retenus.forEach((p, i) => {
    const m = moyennes.get(p.agence) ?? { sw: 0, sx: 0, sy: 0 };
    const w = poids[i] as number;
    m.sw += w;
    m.sx += w * p.remise_moyenne;
    m.sy += w * p.taux_signature;
    moyennes.set(p.agence, m);
  });
  let sxx = 0;
  let sxy = 0;
  const xc: number[] = [];
  const yc: number[] = [];
  retenus.forEach((p, i) => {
    const m = moyennes.get(p.agence) as { sw: number; sx: number; sy: number };
    const w = poids[i] as number;
    const x = p.remise_moyenne - m.sx / m.sw;
    const y = p.taux_signature - m.sy / m.sw;
    xc.push(x);
    yc.push(y);
    sxx += w * x * x;
    sxy += w * x * y;
  });
  if (sxx <= 0) return null;
  const pente = sxy / sxx;

  const degresLiberte = n - agences.size - 1;
  if (degresLiberte < 1) return null;
  let sce = 0;
  retenus.forEach((_, i) => {
    const residu = (yc[i] as number) - pente * (xc[i] as number);
    sce += (poids[i] as number) * residu * residu;
  });
  const erreurType = Math.sqrt(sce / degresLiberte / sxx);

  const totalSignatures = retenus.reduce((s, p) => s + p.signatures, 0);
  const tauxSignature = (100 * totalSignatures) / totalDevis;
  const remiseMoyenne = retenus.reduce((s, p) => s + p.devis * p.remise_moyenne, 0) / totalDevis;
  const avecMarge = retenus.filter((p) => p.marge_avant_remise !== null);
  const devisAvecMarge = avecMarge.reduce((s, p) => s + p.devis, 0);
  const margeAvantRemise = devisAvecMarge > 0 ? avecMarge.reduce((s, p) => s + p.devis * (p.marge_avant_remise as number), 0) / devisAvecMarge : 0;

  const arrondi = (v: number) => Math.round(v * 100) / 100;
  const penteHaute = pente + QUANTILE_95 * erreurType;
  return {
    points: n,
    agences: agences.size,
    pente: arrondi(pente),
    erreurType: arrondi(erreurType),
    intervalle: [arrondi(pente - QUANTILE_95 * erreurType), arrondi(penteHaute)],
    tauxSignature: Math.round(tauxSignature * 10) / 10,
    remiseMoyenne: Math.round(remiseMoyenne * 10) / 10,
    margeAvantRemise: Math.round(margeAvantRemise * 10) / 10,
    seuil: seuilRentable(pente, tauxSignature, remiseMoyenne, margeAvantRemise),
    seuilBorneHaute: seuilRentable(penteHaute, tauxSignature, remiseMoyenne, margeAvantRemise),
    remiseReference,
    penteRequise: penteRequise(remiseReference, tauxSignature, remiseMoyenne, margeAvantRemise),
  };
}

/** « 0,8 point », « 1,25 point », « 2 points » : deux décimales au plus, sans zéro inutile. */
function pointsTexte(valeur: number): string {
  const v = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(valeur);
  return `${v} point${Math.abs(valeur) >= 2 ? "s" : ""}`;
}

/** Phrase de méthode du bloc Remises (ECRANS.md §4) : vraie sur les données, jamais une règle de gestion. */
export function phraseRemise(e: ElasticiteRemise | null): string {
  if (!e) return "Pas assez de couples agence × mois clos pour estimer la pente du taux de signature en fonction de la remise.";
  const [bas, haut] = e.intervalle;
  const estimation = `Dans ce jeu simulé, la régression à effets fixes agence sur ${formatNombre(e.points)} couples agence × mois (${formatNombre(e.agences)} agences) retrouve ${pointsTexte(e.pente)} de signature par point de remise (intervalle à 95 % : ${pointsTexte(bas)} à ${pointsTexte(haut)}), cohérent avec l'hypothèse posée dans le générateur (Saintonge : +4 points de signature pour +5 points de remise).`;
  let lecture: string;
  if (e.seuil > 0) {
    lecture = `À cette pente, avec ${formatTaux(e.margeAvantRemise)} de marge avant remise et ${formatTaux(e.tauxSignature)} de signature, la marge est maximale autour de ${formatTaux(e.seuil)} de remise (${formatTaux(e.seuilBorneHaute)} à la borne haute de l'intervalle).`;
  } else {
    const requise = e.penteRequise === null ? "" : ` ; il faudrait ${pointsTexte(e.penteRequise)} de signature par point de remise pour qu'une remise de ${formatTaux(e.remiseReference, 0)} soit le bon niveau`;
    const borne = e.seuilBorneHaute > 0 ? ` (à la borne haute de l'intervalle, le niveau optimal serait de ${formatTaux(e.seuilBorneHaute)})` : "";
    lecture = `À cette pente, avec ${formatTaux(e.margeAvantRemise)} de marge avant remise et ${formatTaux(e.tauxSignature)} de signature, aucun niveau de remise n'augmente la marge : chaque point cédé coûte plus qu'il ne rapporte${requise}${borne}.`;
  }
  return `${estimation} ${lecture} Démonstration de méthode sur des données simulées, pas une règle applicable à un réseau réel.`;
}
