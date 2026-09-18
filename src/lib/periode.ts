/**
 * Période active (filtre URL `periode`) : un mois « 2026-09 », un trimestre « 2026-T3 »
 * ou l'année à date « 2026 ». Tout est borné par la journée publiée : une période
 * ne contient jamais un mois postérieur à celle-ci.
 */
export type TypePeriode = "mois" | "trimestre" | "annee";

export interface Periode {
  type: TypePeriode;
  /** Premier et dernier mois inclus, AAAA-MM. */
  debut: string;
  fin: string;
  /** Valeur telle qu'elle vit dans l'URL. */
  param: string;
  libelle: string;
}

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"] as const;

export function moisDe(date: string): string {
  return date.slice(0, 7);
}

export function ajouterMois(mois: string, n: number): string {
  const [a, m] = mois.split("-").map(Number) as [number, number];
  const total = a * 12 + (m - 1) + n;
  const annee = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${annee}-${String(mm).padStart(2, "0")}`;
}

export function moisEntre(debut: string, fin: string): string[] {
  const liste: string[] = [];
  let courant = debut;
  while (courant <= fin) {
    liste.push(courant);
    courant = ajouterMois(courant, 1);
  }
  return liste;
}

export function libelleMois(mois: string): string {
  const [a, m] = mois.split("-");
  return `${MOIS_LONGS[Number(m) - 1] ?? m} ${a}`;
}

/** Interprète le paramètre d'URL ; toute valeur invalide retombe sur le mois de la journée publiée. */
export function analyserPeriode(param: string | null | undefined, moisPublie: string): Periode {
  const trimestre = param?.match(/^(\d{4})-T([1-4])$/);
  if (trimestre) {
    const annee = trimestre[1] as string;
    const t = Number(trimestre[2]);
    const debut = `${annee}-${String((t - 1) * 3 + 1).padStart(2, "0")}`;
    const finTheorique = `${annee}-${String(t * 3).padStart(2, "0")}`;
    const fin = finTheorique < moisPublie ? finTheorique : moisPublie;
    if (debut > moisPublie) return analyserPeriode(moisPublie, moisPublie);
    return { type: "trimestre", debut, fin, param: `${annee}-T${t}`, libelle: `T${t} ${annee}${fin < finTheorique ? " à date" : ""}` };
  }
  const annee = param?.match(/^(\d{4})$/);
  if (annee) {
    const a = annee[1] as string;
    const debut = `${a}-01`;
    const finTheorique = `${a}-12`;
    const fin = finTheorique < moisPublie ? finTheorique : moisPublie;
    if (debut > moisPublie) return analyserPeriode(moisPublie, moisPublie);
    return { type: "annee", debut, fin, param: a, libelle: fin < finTheorique ? `${a} à date` : a };
  }
  const mois = param?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  const valeur = mois && (mois[0] as string) <= moisPublie && (mois[0] as string) >= "2025-01" ? (mois[0] as string) : moisPublie;
  return { type: "mois", debut: valeur, fin: valeur, param: valeur, libelle: libelleMois(valeur) };
}

/** Même période un an plus tôt (comparaison N-1) ; null avant 2026 (pas d'historique 2024). */
export function periodeN1(p: Periode): { debut: string; fin: string } | null {
  const debut = ajouterMois(p.debut, -12);
  if (debut < "2025-01") return null;
  return { debut, fin: ajouterMois(p.fin, -12) };
}

/** Options du sélecteur : mois depuis janvier 2025, trimestres et années à date. */
export function optionsPeriode(moisPublie: string): { valeur: string; libelle: string; groupe: TypePeriode }[] {
  const options: { valeur: string; libelle: string; groupe: TypePeriode }[] = [];
  for (const m of moisEntre("2025-01", moisPublie).reverse()) options.push({ valeur: m, libelle: libelleMois(m), groupe: "mois" });
  const [anneePubliee, moisPub] = moisPublie.split("-").map(Number) as [number, number];
  for (let a = anneePubliee; a >= 2025; a--) {
    const tMax = a === anneePubliee ? Math.ceil(moisPub / 3) : 4;
    for (let t = tMax; t >= 1; t--) options.push({ valeur: `${a}-T${t}`, libelle: `T${t} ${a}`, groupe: "trimestre" });
  }
  for (let a = anneePubliee; a >= 2025; a--) options.push({ valeur: String(a), libelle: a === anneePubliee ? `${a} à date` : String(a), groupe: "annee" });
  return options;
}

export interface LigneKpi {
  mois: string;
  leads: number;
  ventes: number;
  ca_signe: number;
  ca_pose: number;
  encaisse: number;
  poses: number;
  marge_brute: number;
  signatures_brutes: number;
  annulees_60j: number;
  couts_acquisition: number;
  commissions: number;
  marge_apres_acquisition: number;
  charges: number;
  resultat: number;
  objectif_ventes: number;
  objectif_ca: number;
  delai_pose_median: number | null;
  commerciaux_actifs: number;
  techniciens_actifs: number;
  /** Part du mois publiée (jours publiés / jours du mois), 1 pour un mois complet. */
  prorata: number;
  jours_publies: number;
  jours_mois: number;
  /** Remises accordées et prix catalogue des ventes du mois, en euros (dénominateur du taux de remise). */
  remises?: number;
  prix_catalogue_total?: number;
}

export interface KpiAgrege {
  mois: number;
  leads: number;
  ventes: number;
  ca_signe: number;
  ca_pose: number;
  encaisse: number;
  poses: number;
  marge_brute: number;
  taux_marge: number | null;
  panier_moyen: number | null;
  /** Remises / prix catalogue des ventes, en pourcentage ; null si les colonnes manquent. */
  taux_remise: number | null;
  signatures_brutes: number;
  annulees_60j: number;
  taux_annulation: number | null;
  couts_acquisition: number;
  commissions: number;
  marge_apres_acquisition: number;
  charges: number;
  resultat: number;
  taux_cac: number | null;
  /** Objectifs du mois entier. */
  objectif_ventes: number;
  objectif_ca: number;
  /** Objectifs proratisés des jours publiés (égaux aux précédents pour des mois complets). */
  objectif_ventes_prorata: number;
  objectif_ca_prorata: number;
  ecart_objectif_pct: number | null;
  /** Prorata du dernier mois de la période (1 si complet) et jours publiés sur jours du mois. */
  prorata: number;
  jours_publies: number;
  jours_mois: number;
  /** Médiane mensuelle si un seul mois ; sinon moyenne des médianes pondérée par les poses (approximation). */
  delai_pose_median: number | null;
  productivite_commerciale: number | null;
}

function ratio(numerateur: number, denominateur: number, facteur = 1, decimales = 1): number | null {
  if (!denominateur) return null;
  const f = Math.pow(10, decimales);
  return Math.round((facteur * numerateur / denominateur) * f) / f;
}

/**
 * Somme des mesures additives d'une liste de lignes mensuelles, ratios recalculés depuis les sommes.
 * `prorataDernierMois` sert à la comparaison N-1 : les mesures du dernier mois de la période N-1
 * sont ramenées à la part publiée du mois en cours (le mois N-1 est complet, le mois courant non).
 */
export function agregerKpi(lignes: readonly LigneKpi[], debut: string, fin: string, options?: { prorataDernierMois?: number }): KpiAgrege | null {
  const retenues = lignes.filter((l) => moisDe(l.mois) >= debut && moisDe(l.mois) <= fin).sort((a, b) => a.mois.localeCompare(b.mois));
  if (retenues.length === 0) return null;
  const dernier = retenues[retenues.length - 1] as LigneKpi;
  const facteur = (l: LigneKpi) => (options?.prorataDernierMois !== undefined && l === dernier ? options.prorataDernierMois : 1);
  const somme = (cle: keyof LigneKpi) => retenues.reduce((s, l) => s + (Number(l[cle]) || 0) * facteur(l), 0);
  const leads = somme("leads"), ventes = somme("ventes"), ca = somme("ca_signe"), marge = somme("marge_brute");
  const sb = somme("signatures_brutes"), an = somme("annulees_60j"), couts = somme("couts_acquisition"), com = somme("commissions");
  const objectifCa = somme("objectif_ca");
  const objectifCaProrata = retenues.reduce((s, l) => s + l.objectif_ca * (l.prorata ?? 1), 0);
  const objectifVentesProrata = retenues.reduce((s, l) => s + l.objectif_ventes * (l.prorata ?? 1), 0);
  const poses = somme("poses");
  const remises = somme("remises"), catalogue = somme("prix_catalogue_total");
  const delaisPonderes = retenues.reduce((s, l) => s + (l.delai_pose_median ?? 0) * l.poses, 0);
  const posesAvecDelai = retenues.reduce((s, l) => s + (l.delai_pose_median === null ? 0 : l.poses), 0);
  const commerciauxMoyens = retenues.reduce((s, l) => s + l.commerciaux_actifs, 0) / retenues.length;
  return {
    mois: retenues.length,
    leads, ventes, ca_signe: ca, ca_pose: somme("ca_pose"), encaisse: somme("encaisse"), poses, marge_brute: marge,
    taux_marge: ratio(marge, ca, 100),
    panier_moyen: ratio(ca, ventes, 1, 0),
    taux_remise: ratio(remises, catalogue, 100),
    signatures_brutes: sb, annulees_60j: an,
    taux_annulation: ratio(an, sb, 100),
    couts_acquisition: couts, commissions: com,
    marge_apres_acquisition: somme("marge_apres_acquisition"), charges: somme("charges"), resultat: somme("resultat"),
    taux_cac: ratio(couts + com, ca, 100),
    objectif_ventes: somme("objectif_ventes"), objectif_ca: objectifCa,
    objectif_ventes_prorata: Math.round(objectifVentesProrata * 10) / 10, objectif_ca_prorata: Math.round(objectifCaProrata),
    ecart_objectif_pct: ratio(ca - objectifCaProrata, objectifCaProrata, 100),
    prorata: dernier.prorata ?? 1, jours_publies: dernier.jours_publies ?? dernier.jours_mois ?? 0, jours_mois: dernier.jours_mois ?? 0,
    delai_pose_median: posesAvecDelai > 0 ? Math.round(delaisPonderes / posesAvecDelai) : null,
    productivite_commerciale: commerciauxMoyens > 0 ? ratio(ventes, commerciauxMoyens, 1, 2) : null,
  };
}

/** Écart relatif en pourcentage entre une valeur et sa comparaison ; null si la comparaison manque ou vaut zéro. */
export function ecartPct(valeur: number | null, comparaison: number | null): number | null {
  if (valeur === null || comparaison === null || !comparaison) return null;
  return Math.round(((valeur - comparaison) / Math.abs(comparaison)) * 1000) / 10;
}

/** Écart en points entre deux taux ; null si l'un manque. */
export function ecartPoints(valeur: number | null, comparaison: number | null): number | null {
  if (valeur === null || comparaison === null) return null;
  return Math.round((valeur - comparaison) * 10) / 10;
}

export interface LigneFunnel {
  mois: string;
  leads: number;
  rdv_tenus: number;
  devis: number;
  signatures: number;
  poses: number;
  encaissements: number;
  cohorte_mature: boolean;
}

export interface CohorteAgregee {
  leads: number;
  rdv: number;
  devis: number;
  signatures: number;
  poses: number;
  encaissements: number;
  /** Vrai seulement si toutes les cohortes de la période ont plus de 90 jours. */
  mature: boolean;
}

/** Cohortes de création additionnées sur la période (les étapes restent rattachées au mois du lead). */
export function agregerFunnel(lignes: readonly LigneFunnel[], debut: string, fin: string): CohorteAgregee | null {
  const retenues = lignes.filter((l) => moisDe(l.mois) >= debut && moisDe(l.mois) <= fin);
  if (retenues.length === 0) return null;
  const somme = (cle: Exclude<keyof LigneFunnel, "mois" | "cohorte_mature">) => retenues.reduce((s, l) => s + l[cle], 0);
  return {
    leads: somme("leads"), rdv: somme("rdv_tenus"), devis: somme("devis"), signatures: somme("signatures"),
    poses: somme("poses"), encaissements: somme("encaissements"), mature: retenues.every((l) => l.cohorte_mature),
  };
}

export interface EtapeFunnel {
  nom: string;
  valeur: number;
  /** Taux par rapport à l'étape précédente, en pourcentage ; null pour la première étape ou un dénominateur nul. */
  taux: number | null;
}

export function etapesFunnel(c: CohorteAgregee): EtapeFunnel[] {
  const brut = [
    ["Leads", c.leads], ["RDV tenus", c.rdv], ["Devis", c.devis], ["Signatures", c.signatures], ["Poses", c.poses], ["Encaissements", c.encaissements],
  ] as const;
  return brut.map(([nom, valeur], i) => {
    const precedente = i > 0 ? brut[i - 1]?.[1] ?? 0 : 0;
    return { nom, valeur, taux: i > 0 && precedente > 0 ? Math.round((valeur / precedente) * 1000) / 10 : null };
  });
}
