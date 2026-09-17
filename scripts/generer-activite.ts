/**
 * Generateur du jeu simulé (DONNEES.md §3), deterministe : graine 20260922.
 * `npm run generer:activite` regenere et charge tout (2025-01-01 à 2026-12-31),
 * puis publie jusqu'à J-1. `npm run publier -- --jusqua AAAA-MM-JJ` publie seulement.
 *
 * Aucune agence, personne ou entite réelle : bassins, codes, règles ecrites.
 * Les propriétaires occupants par département sont figés ici (Insee 2022, arrondis)
 * pour que le jeu ne depende pas de l'état de la table marche_departement.
 */
import type pg from "pg";
import { Alea } from "./lib/alea";
import { ajouterJours, chargerEnv, connexion, dateUTC, formatDate, insererParLots } from "./lib/bd";

const GRAINE = 20260922;
const LOT_GENERATION = "g20260922-v1";
const DEBUT = dateUTC(2025, 1, 1);
const FIN = dateUTC(2026, 12, 31);

const PROPRIETAIRES: Record<string, number> = {
  "16": 105_000, "17": 210_000, "24": 135_000, "32": 60_000, "33": 470_000, "40": 135_000,
  "47": 105_000, "59": 623_000, "64": 205_000, "79": 115_000, "85": 215_000,
};
const DEPARTEMENTS_AVEC_AGENCE = new Set(["16", "17", "33", "40", "59"]);

interface Agence {
  code: string;
  departement: string;
  commerciaux: number;
  techniciens: number;
  territoires: { departement: string; part: number }[];
}
const AGENCES: Agence[] = [
  { code: "SAI", departement: "17", commerciaux: 6, techniciens: 7, territoires: [{ departement: "17", part: 1 }, { departement: "79", part: 1 }, { departement: "85", part: 1 }] },
  { code: "ANG", departement: "16", commerciaux: 4, techniciens: 4, territoires: [{ departement: "16", part: 1 }, { departement: "24", part: 0.5 }] },
  { code: "MAR", departement: "40", commerciaux: 5, techniciens: 7, territoires: [{ departement: "40", part: 0.4 }, { departement: "64", part: 1 }] },
  { code: "BOR", departement: "40", commerciaux: 4, techniciens: 5, territoires: [{ departement: "40", part: 0.3 }, { departement: "33", part: 0.2 }] },
  { code: "MSN", departement: "40", commerciaux: 4, techniciens: 4, territoires: [{ departement: "40", part: 0.3 }, { departement: "32", part: 1 }, { departement: "47", part: 0.5 }] },
  { code: "BDX", departement: "33", commerciaux: 8, techniciens: 9, territoires: [{ departement: "33", part: 0.45 }] },
  { code: "HGI", departement: "33", commerciaux: 4, techniciens: 5, territoires: [{ departement: "33", part: 0.2 }, { departement: "24", part: 0.5 }, { departement: "47", part: 0.5 }] },
  { code: "ARC", departement: "33", commerciaux: 4, techniciens: 5, territoires: [{ departement: "33", part: 0.15 }] },
  { code: "NOR", departement: "59", commerciaux: 5, techniciens: 6, territoires: [{ departement: "59", part: 1 }] },
];

interface Produit {
  code: string;
  libelle: string;
  prix: number;
  tauxPose: number;
  margeCible: number;
  dureeJt: number;
  aide: number;
  part: number;
  profil: "photovoltaique" | "chauffage" | "plat";
}
const PRODUITS: Produit[] = [
  { code: "PV3", libelle: "Photovoltaïque 3 kWc", prix: 7900, tauxPose: 0.12, margeCible: 0.30, dureeJt: 2, aide: 0, part: 0.18, profil: "photovoltaique" },
  { code: "PV6", libelle: "Photovoltaïque 6 kWc", prix: 12500, tauxPose: 0.12, margeCible: 0.32, dureeJt: 3, aide: 0, part: 0.14, profil: "photovoltaique" },
  { code: "PVB", libelle: "Photovoltaïque avec batterie", prix: 16800, tauxPose: 0.12, margeCible: 0.31, dureeJt: 3.5, aide: 0, part: 0.08, profil: "photovoltaique" },
  { code: "PACAE", libelle: "Pompe à chaleur air-eau", prix: 13900, tauxPose: 0.15, margeCible: 0.28, dureeJt: 4, aide: 4000, part: 0.22, profil: "chauffage" },
  { code: "PACAA", libelle: "Pompe à chaleur air-air", prix: 6200, tauxPose: 0.14, margeCible: 0.33, dureeJt: 2, aide: 0, part: 0.12, profil: "chauffage" },
  { code: "CET", libelle: "Chauffe-eau thermodynamique", prix: 3400, tauxPose: 0.14, margeCible: 0.35, dureeJt: 1, aide: 900, part: 0.12, profil: "plat" },
  { code: "POELE", libelle: "Poêle à granulés", prix: 5600, tauxPose: 0.13, margeCible: 0.32, dureeJt: 1.5, aide: 1800, part: 0.08, profil: "chauffage" },
  { code: "BORNE", libelle: "Borne de recharge", prix: 1600, tauxPose: 0.15, margeCible: 0.36, dureeJt: 0.5, aide: 0, part: 0.06, profil: "plat" },
];
/** Libelles divergents reçus du système source pendant l'intégration de Nord (H4). */
const LIBELLES_DIVERGENTS: Record<string, string> = {
  PV3: "PV 3KW", PV6: "PV 6KW", PVB: "PV + BATTERIE", PACAE: "PAC AIR EAU 11KW",
  PACAA: "PAC AIR/AIR", CET: "CHAUFFE EAU THERMO", POELE: "POELE GRANULES", BORNE: "BORNE 7KW",
};

type Canal = "site_web" | "appels_entrants" | "parrainage" | "partenaires" | "terrain" | "salons" | "leads_achetes" | "base_clients";
const CANAUX: { code: Canal; part: number }[] = [
  { code: "site_web", part: 0.24 }, { code: "appels_entrants", part: 0.14 }, { code: "parrainage", part: 0.10 },
  { code: "partenaires", part: 0.12 }, { code: "terrain", part: 0.16 }, { code: "salons", part: 0.06 },
  { code: "leads_achetes", part: 0.12 }, { code: "base_clients", part: 0.06 },
];
const MOIS_SALON = new Set([3, 6, 10]);
const PART_LEADS_ACHETES_BDX = 0.25;

const FUNNEL = { rdv: 0.45, devis: 0.70, signature: 0.32, annulation: 0.08 };
const ANNULATION_A_DISTANCE = 0.14;
const COMMISSION = 0.04;
const PRIX_LEAD = 65;
const PRIX_LEAD_BDX_H2 = 72;

interface Dossier {
  agence: string;
  commercial: string;
  canal: Canal;
  produit: Produit;
  produitLibelleSource: string | null;
  departement: string;
  empreinte: string;
  dateLead: Date;
  dateRdvPlanifie: Date | null;
  dateRdv: Date | null;
  dateDevis: Date | null;
  montantDevis: number | null;
  dateSignature: Date | null;
  datePose: Date | null;
  dateEncaissement: Date | null;
  dateAnnulation: Date | null;
  motifAnnulation: string | null;
  statut: string | null;
  prixCatalogue: number;
  tauxRemise: number;
  montantHt: number | null;
  coutMateriel: number | null;
  coutPose: number | null;
  commission: number | null;
  aideMontant: number;
  aideVerseeLe: Date | null;
  technicien: string | null;
}

function saison(produit: Produit, mois: number): number {
  if (produit.profil === "photovoltaique") {
    if (mois >= 3 && mois <= 6) return 1.35;
    if (mois === 8) return 0.6;
    return 1;
  }
  if (produit.profil === "chauffage") {
    if (mois >= 9) return 1.4;
    if (mois >= 5 && mois <= 7) return 0.7;
    if (mois === 8) return 0.8;
    return 1;
  }
  return mois === 8 ? 0.8 : 1;
}

function tendance(annee: number, mois: number): number {
  const m2025 = annee === 2025 ? mois - 1 : 11;
  const m2026 = annee === 2026 ? mois : 0;
  return Math.pow(1.01, m2025) * Math.pow(1.005, m2026);
}

function arrondi(x: number, decimales = 2): number {
  const f = Math.pow(10, decimales);
  return Math.round(x * f) / f;
}

function estDistance(departement: string): boolean {
  return !DEPARTEMENTS_AVEC_AGENCE.has(departement);
}

/** H1 Marensin : RDV vers devis en retrait de mars à juin 2026, retour progressif. */
function ajustementDevisH1(agence: string, annee: number, mois: number): number {
  if (agence !== "MAR" || annee !== 2026) return 0;
  if (mois >= 3 && mois <= 6) return -0.10;
  if (mois === 7) return -0.06;
  if (mois === 8) return -0.03;
  return 0;
}

/** H3 Saintonge : remise 4 % vers 9 % à partir d'avril 2026, signature +4 pts. */
function h3Actif(agence: string, annee: number, mois: number): boolean {
  return agence === "SAI" && (annee > 2026 || (annee === 2026 && mois >= 4));
}

/** H2 Bordeaux Métropole : leads achetés doubles à partir d'avril 2026, RDV du canal 30 % vers 23 %. */
function h2Actif(agence: string, annee: number, mois: number): boolean {
  return agence === "BDX" && annee === 2026 && mois >= 4;
}

/** H7 Bassin d'Arcachon : capacite de pose réduite de 25 % de mai a août 2026. */
function h7Actif(agence: string, date: Date): boolean {
  const d = formatDate(date);
  return agence === "ARC" && d >= "2026-04-15" && d <= "2026-08-31";
}

/** H4 Nord : intensite des anomalies d'intégration, décroissante de juin à mi-septembre 2026. */
function intensiteH4(agence: string, dateLead: Date): number {
  if (agence !== "NOR") return 0;
  const debut = dateUTC(2026, 6, 1).getTime();
  const fin = dateUTC(2026, 9, 15).getTime();
  const t = dateLead.getTime();
  if (t < debut || t > fin) return 0;
  return 1 - (t - debut) / (fin - debut);
}

/**
 * Tirage systématique (variance réduite) : chaque element i est retenu avec la probabilité p_i,
 * et le nombre d'éléments retenus vaut la somme des p_i à une unité près. Les taux du modèle
 * s'appliquent donc à chaque cohorte au lieu de se perdre dans le bruit des petits effectifs,
 * sans jamais écrire un résultat : les vues recalculent tout.
 */
const REPORTS = new Map<string, number>();

function selectionSystematique(alea: Alea, probabilites: number[], strate: string): boolean[] {
  const ordre = probabilites.map((_, i) => i);
  for (let i = ordre.length - 1; i > 0; i--) {
    const j = alea.entier(0, i);
    const tmp = ordre[i] as number;
    ordre[i] = ordre[j] as number;
    ordre[j] = tmp;
  }
  const retenus: boolean[] = Array.from({ length: probabilites.length }, () => false);
  // Le reste fractionnaire de la strate est reporte d'une cohorte à la suivante : sur plusieurs
  // mois, le nombre retenu suit la somme des probabilités à une unité près, même pour un petit canal.
  let cumul = REPORTS.get(strate) ?? -alea.uniforme();
  for (const i of ordre) {
    const avant = cumul;
    cumul += Math.min(1, Math.max(0, probabilites[i] ?? 0));
    if (Math.floor(cumul) > Math.floor(avant)) retenus[i] = true;
  }
  REPORTS.set(strate, cumul - Math.floor(cumul) - 1);
  return retenus;
}

/** Tirage systématique par strate (canal) : chaque canal suit ses propres taux à l'unité près. */
function selectionParCanal(alea: Alea, dossiers: Dossier[], probabilites: number[], etape: string): boolean[] {
  const retenus: boolean[] = Array.from({ length: dossiers.length }, () => false);
  const parCanal = new Map<Canal, number[]>();
  dossiers.forEach((d, i) => {
    const liste = parCanal.get(d.canal) ?? [];
    liste.push(i);
    parCanal.set(d.canal, liste);
  });
  for (const [canal, indices] of parCanal) {
    const agence = dossiers[indices[0] as number]?.agence ?? "";
    const choix = selectionSystematique(alea, indices.map((i) => probabilites[i] ?? 0), `${agence}|${canal}|${etape}`);
    indices.forEach((i, k) => { retenus[i] = choix[k] ?? false; });
  }
  return retenus;
}

/** Aleas mensuel sur un taux de cohorte (écart-type relatif 6 %), borne dans [0, 1]. */
function tauxCohorte(alea: Alea, taux: number): number {
  return Math.min(1, Math.max(0, taux * Math.exp(0.06 * alea.normale())));
}

function genererDossiers(alea: Alea): Dossier[] {
  const dossiers: Dossier[] = [];
  const effetAgence = new Map<string, number>();
  const effetCommercial = new Map<string, number>();
  for (const agence of AGENCES) {
    effetAgence.set(agence.code, alea.entre(-0.04, 0.04));
    for (let n = 1; n <= agence.commerciaux; n++) {
      effetCommercial.set(`C-${agence.code}-${String(n).padStart(2, "0")}`, alea.entre(-0.06, 0.06));
    }
  }
  let compteurEmpreinte = 0;
  // La saisonnalite redistribue les leads dans l'annee sans en changer le volume annuel.
  const facteurSaisonMoyen =
    Array.from({ length: 12 }, (_, i) => PRODUITS.reduce((s, p) => s + p.part * saison(p, i + 1), 0))
      .reduce((s, x) => s + x, 0) / 12;

  for (const agence of AGENCES) {
    const proprietairesPonderes = agence.territoires.reduce(
      (somme, t) => somme + (PROPRIETAIRES[t.departement] ?? 0) * t.part, 0);
    const base = Math.min(agence.commerciaux * 45, 40 + 0.0007 * proprietairesPonderes);
    const poidsDepartements = agence.territoires.map((t) => (PROPRIETAIRES[t.departement] ?? 0) * t.part);

    for (let annee = 2025; annee <= 2026; annee++) {
      for (let mois = 1; mois <= 12; mois++) {
        const joursDuMois = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
        const mixSaison = PRODUITS.map((p) => p.part * saison(p, mois));
        const facteurSaison = mixSaison.reduce((s, x) => s + x, 0) / facteurSaisonMoyen;
        const bruit = Math.exp(0.12 * alea.normale());
        const nLeads = Math.round(base * tendance(annee, mois) * facteurSaison * bruit);
        const poidsCanaux = CANAUX.map((c) => {
          if (c.code === "salons" && !MOIS_SALON.has(mois)) return 0;
          // Bordeaux Métropole : agence metropolitaine, un quart des leads vient des plateformes.
          if (agence.code === "BDX") return c.code === "leads_achetes" ? PART_LEADS_ACHETES_BDX : c.part * (1 - PART_LEADS_ACHETES_BDX) / 0.88;
          return c.part;
        });

        const creer = (canalForce: Canal | null): Dossier => {
          const produit = PRODUITS[alea.indicePondere(mixSaison)] as Produit;
          const canal = canalForce ?? (CANAUX[alea.indicePondere(poidsCanaux)] as { code: Canal }).code;
          const departement = (agence.territoires[alea.indicePondere(poidsDepartements)] as { departement: string }).departement;
          const commercial = `C-${agence.code}-${String(alea.entier(1, agence.commerciaux)).padStart(2, "0")}`;
          const dateLead = dateUTC(annee, mois, alea.entier(1, joursDuMois));
          compteurEmpreinte += 1;
          return {
            agence: agence.code, commercial, canal, produit, produitLibelleSource: null, departement,
            empreinte: `e${compteurEmpreinte.toString(36)}`, dateLead,
            dateRdvPlanifie: null, dateRdv: null, dateDevis: null, montantDevis: null, dateSignature: null, datePose: null,
            dateEncaissement: null, dateAnnulation: null, motifAnnulation: null, statut: "sans_suite",
            prixCatalogue: arrondi(produit.prix * (1 + alea.entre(-0.12, 0.12)), 0), tauxRemise: 0, montantHt: null,
            coutMateriel: null, coutPose: null, commission: null, aideMontant: 0, aideVerseeLe: null, technicien: null,
          };
        };

        const cohorte: Dossier[] = [];
        for (let i = 0; i < nLeads; i++) cohorte.push(creer(null));
        if (h2Actif(agence.code, annee, mois)) {
          const achetes = cohorte.filter((d) => d.canal === "leads_achetes").length;
          for (let i = 0; i < achetes; i++) cohorte.push(creer("leads_achetes"));
        }

        deroulerFunnel(alea, agence, cohorte, annee, mois, effetAgence.get(agence.code) ?? 0, effetCommercial);

        // Les doublons H4 s'ajoutent à la cohorte pendant le parcours : on parcourt une copie.
        const initiaux = cohorte.slice();
        for (const d of initiaux) {
          const h4 = intensiteH4(agence.code, d.dateLead);
          if (h4 > 0) {
            if (alea.bernoulli(0.12 * h4)) d.produitLibelleSource = LIBELLES_DIVERGENTS[d.produit.code] ?? null;
            if (alea.bernoulli(0.06 * h4)) d.statut = null;
            if (alea.bernoulli(0.03 * h4)) {
              cohorte.push({
                ...d, dateLead: ajouterJours(d.dateLead, alea.entier(1, 20)),
                dateRdvPlanifie: null, dateRdv: null, dateDevis: null, montantDevis: null, dateSignature: null,
                datePose: null, dateEncaissement: null, dateAnnulation: null, motifAnnulation: null,
                statut: "sans_suite", montantHt: null, coutMateriel: null, coutPose: null, commission: null,
                aideMontant: 0, aideVerseeLe: null, technicien: null, produitLibelleSource: null,
              });
            }
          }
        }
        dossiers.push(...cohorte);
      }
    }
  }
  return dossiers;
}

/** Deroule le funnel d'une cohorte mois x agence, étape par étape, par tirage systématique. */
function deroulerFunnel(
  alea: Alea, agence: Agence, cohorte: Dossier[], annee: number, mois: number,
  effetAgence: number, effetCommercial: Map<string, number>,
): void {
  const h2 = h2Actif(agence.code, annee, mois);
  const h3 = h3Actif(agence.code, annee, mois);

  // Lead vers RDV tenu : taux par canal, aléas mensuel par canal.
  const aleasRdv = new Map<Canal, number>();
  const pRdv = cohorte.map((d) => {
    let taux = FUNNEL.rdv;
    if (d.canal === "leads_achetes") taux = h2 ? 0.23 : 0.30;
    if (d.canal === "base_clients") taux += 0.10;
    if (!aleasRdv.has(d.canal)) aleasRdv.set(d.canal, tauxCohorte(alea, 1));
    return taux * (aleasRdv.get(d.canal) ?? 1);
  });
  const aRdv = selectionParCanal(alea, cohorte, pRdv, "rdv");
  cohorte.forEach((d, i) => {
    if (aRdv[i]) {
      d.dateRdv = ajouterJours(d.dateLead, Math.max(1, alea.logNormale(6, 0.5)));
      const planifie = ajouterJours(d.dateLead, alea.bernoulli(0.85) ? alea.entier(0, 2) : alea.entier(3, 10));
      d.dateRdvPlanifie = planifie.getTime() > d.dateRdv.getTime() ? d.dateRdv : planifie;
    } else if (alea.bernoulli(0.40)) {
      d.dateRdvPlanifie = ajouterJours(d.dateLead, alea.entier(1, 10));
    }
  });

  // RDV vers devis.
  const avecRdv = cohorte.filter((d) => d.dateRdv !== null);
  const aleasDevis = tauxCohorte(alea, 1);
  const pDevis = avecRdv.map((d) => {
    let taux = FUNNEL.devis + effetAgence + ajustementDevisH1(agence.code, annee, mois);
    if (d.canal === "salons") taux -= 0.05;
    return taux * aleasDevis;
  });
  const aDevis = selectionParCanal(alea, avecRdv, pDevis, "devis");
  avecRdv.forEach((d, i) => {
    if (!aDevis[i] || !d.dateRdv) return;
    d.dateDevis = ajouterJours(d.dateRdv, Math.max(0, alea.logNormale(4, 0.5)));
    const remiseMoyenne = h3 ? 0.09 : 0.04;
    d.tauxRemise = arrondi(Math.min(0.15, Math.max(0, remiseMoyenne + 0.015 * alea.normale())), 4);
    d.montantDevis = arrondi(d.prixCatalogue * (1 - d.tauxRemise), 0);
    d.statut = "refus";
  });

  // Devis vers signature : effet commercial par dossier, parrainage, H3.
  const avecDevis = cohorte.filter((d) => d.dateDevis !== null);
  const aleasSign = tauxCohorte(alea, 1);
  const pSign = avecDevis.map((d) => {
    let taux = FUNNEL.signature + (effetCommercial.get(d.commercial) ?? 0);
    if (d.canal === "parrainage") taux += 0.15;
    if (h3) taux += 0.04;
    return taux * aleasSign;
  });
  const aSign = selectionParCanal(alea, avecDevis, pSign, "signature");
  avecDevis.forEach((d, i) => {
    if (!aSign[i] || !d.dateDevis || d.montantDevis === null) return;
    d.dateSignature = ajouterJours(d.dateDevis, Math.max(0, alea.logNormale(12, 0.5)));
    d.montantHt = d.montantDevis;
    // Coûts sur le prix catalogue du dossier (tire a +-12 %) : la marge avant remise vaut la marge cible.
    d.coutMateriel = arrondi(d.prixCatalogue * (1 - d.produit.margeCible - d.produit.tauxPose), 0);
    d.coutPose = arrondi(d.prixCatalogue * d.produit.tauxPose, 0);
    d.commission = arrondi(d.montantHt * COMMISSION, 0);
    d.statut = "signe";
  });

  // Signature vers annulation (H5 : plus élevée à distance), puis pose et encaissement.
  const signes = cohorte.filter((d) => d.dateSignature !== null);
  const aleasAnnul = tauxCohorte(alea, 1);
  const aAnnul: boolean[] = Array.from({ length: signes.length }, () => false);
  for (const distance of [false, true]) {
    const indices = signes.map((d, i) => (estDistance(d.departement) === distance ? i : -1)).filter((i) => i >= 0);
    const choix = selectionSystematique(alea, indices.map(() => (distance ? ANNULATION_A_DISTANCE : FUNNEL.annulation) * aleasAnnul),
      `${agence.code}|annulation|${distance ? "distance" : "sur_place"}`);
    indices.forEach((i, k) => { aAnnul[i] = choix[k] ?? false; });
  }
  signes.forEach((d, i) => {
    if (!d.dateSignature) return;
    if (aAnnul[i]) {
      const retractation = alea.bernoulli(0.60);
      d.dateAnnulation = ajouterJours(d.dateSignature, retractation ? alea.entier(1, 14) : alea.entier(15, 60));
      d.motifAnnulation = retractation ? "retractation" : alea.choix(["financement", "changement d'avis", "autre"]);
      d.statut = "annule";
      return;
    }
    const distance = estDistance(d.departement);
    let delaiPose = alea.logNormale(distance ? 75 : 45, 0.35);
    // H7 : capacite de pose réduite, chaque pose attend en moyenne 22 jours de plus.
    if (h7Actif(agence.code, d.dateSignature)) delaiPose += Math.max(10, 22 + 4 * alea.normale());
    d.datePose = ajouterJours(d.dateSignature, Math.max(7, delaiPose));
    d.technicien = `T-${agence.code}-${String(alea.entier(1, agence.techniciens)).padStart(2, "0")}`;
    d.dateEncaissement = ajouterJours(d.datePose, Math.max(1, alea.logNormale(20, 0.5)));
    d.statut = "encaisse";
    if (d.produit.aide > 0 && alea.bernoulli(0.60)) {
      d.aideMontant = arrondi(d.produit.aide * (1 + alea.entre(-0.15, 0.15)), 0);
      d.aideVerseeLe = ajouterJours(d.datePose, 90);
    }
  });
}

interface CoutCanal { mois: string; agence: string; canal: Canal; montant: number }

function genererCouts(dossiers: Dossier[]): CoutCanal[] {
  const couts = new Map<string, CoutCanal>();
  const ajouter = (mois: string, agence: string, canal: Canal, montant: number) => {
    const cle = `${mois}|${agence}|${canal}`;
    const existant = couts.get(cle);
    if (existant) existant.montant += montant;
    else couts.set(cle, { mois, agence, canal, montant });
  };
  for (const agence of AGENCES) {
    for (let annee = 2025; annee <= 2026; annee++) {
      for (let mois = 1; mois <= 12; mois++) {
        const cle = formatDate(dateUTC(annee, mois, 1));
        ajouter(cle, agence.code, "site_web", 4500);
        ajouter(cle, agence.code, "appels_entrants", 0);
        ajouter(cle, agence.code, "terrain", 12000);
        ajouter(cle, agence.code, "base_clients", 0);
        ajouter(cle, agence.code, "parrainage", 0);
        ajouter(cle, agence.code, "partenaires", 0);
        ajouter(cle, agence.code, "leads_achetes", 0);
        if (MOIS_SALON.has(mois)) ajouter(cle, agence.code, "salons", 6000);
      }
    }
  }
  for (const d of dossiers) {
    const moisLead = formatDate(dateUTC(d.dateLead.getUTCFullYear(), d.dateLead.getUTCMonth() + 1, 1));
    if (d.canal === "leads_achetes") {
      const prix = h2Actif(d.agence, d.dateLead.getUTCFullYear(), d.dateLead.getUTCMonth() + 1) ? PRIX_LEAD_BDX_H2 : PRIX_LEAD;
      ajouter(moisLead, d.agence, "leads_achetes", prix);
    }
    if (d.dateSignature && d.statut !== "annule" && d.montantHt !== null) {
      const moisSign = formatDate(dateUTC(d.dateSignature.getUTCFullYear(), d.dateSignature.getUTCMonth() + 1, 1));
      if (d.canal === "parrainage") ajouter(moisSign, d.agence, "parrainage", 300);
      if (d.canal === "partenaires") ajouter(moisSign, d.agence, "partenaires", arrondi(d.montantHt * 0.08, 0));
    }
  }
  return [...couts.values()].filter((c) => c.mois <= formatDate(FIN)).map((c) => ({ ...c, montant: arrondi(c.montant, 0) }));
}

function genererCharges(): { mois: string; agence: string; sc: number; st: number; structure: number; vehicules: number }[] {
  const lignes = [];
  for (const agence of AGENCES) {
    for (let annee = 2025; annee <= 2026; annee++) {
      for (let mois = 1; mois <= 12; mois++) {
        lignes.push({
          mois: formatDate(dateUTC(annee, mois, 1)), agence: agence.code,
          sc: 3200 * agence.commerciaux, st: 3600 * agence.techniciens, structure: 6000, vehicules: 450 * agence.techniciens,
        });
      }
    }
  }
  return lignes;
}

interface Objectif { mois: string; agence: string; produit: string; ventes: number; prix: number; remise: number }

function genererObjectifs(alea: Alea, dossiers: Dossier[]): Objectif[] {
  const realise = new Map<string, number>();
  for (const d of dossiers) {
    if (!d.dateSignature || d.statut === "annule") continue;
    const cle = `${d.dateSignature.getUTCFullYear()}|${d.dateSignature.getUTCMonth() + 1}|${d.agence}|${d.produit.code}`;
    realise.set(cle, (realise.get(cle) ?? 0) + 1);
  }
  const objectifs: Objectif[] = [];
  for (const agence of AGENCES) {
    const ambition = alea.entre(0.92, 1.08);
    for (const produit of PRODUITS) {
      const annuel2025 = Array.from({ length: 12 }, (_, i) => realise.get(`2025|${i + 1}|${agence.code}|${produit.code}`) ?? 0)
        .reduce((s, x) => s + x, 0);
      const poidsSaison = Array.from({ length: 12 }, (_, i) => saison(produit, i + 1));
      const sommeSaison = poidsSaison.reduce((s, x) => s + x, 0);
      for (let mois = 1; mois <= 12; mois++) {
        const budget2025 = (annuel2025 * ambition * (poidsSaison[mois - 1] ?? 1)) / sommeSaison;
        objectifs.push({ mois: formatDate(dateUTC(2025, mois, 1)), agence: agence.code, produit: produit.code,
          ventes: arrondi(budget2025, 1), prix: produit.prix, remise: 0.04 });
        const realise2025 = realise.get(`2025|${mois}|${agence.code}|${produit.code}`) ?? 0;
        const facteur = agence.code === "NOR" ? 1.10 : 1.15;
        objectifs.push({ mois: formatDate(dateUTC(2026, mois, 1)), agence: agence.code, produit: produit.code,
          ventes: arrondi(realise2025 * facteur, 1), prix: produit.prix, remise: 0.04 });
      }
    }
  }
  return objectifs;
}

function controlesGenerateur(dossiers: Dossier[], couts: CoutCanal[]): void {
  const erreurs: string[] = [];
  for (const d of dossiers) {
    const dates = [d.dateLead, d.dateRdv, d.dateDevis, d.dateSignature, d.datePose, d.dateEncaissement].filter((x): x is Date => x !== null);
    for (let i = 1; i < dates.length; i++) {
      if ((dates[i] as Date).getTime() < (dates[i - 1] as Date).getTime()) erreurs.push(`dates non chronologiques ${d.empreinte}`);
    }
    if (d.montantHt !== null && (d.montantHt < d.produit.prix * 0.6 || d.montantHt > d.produit.prix * 1.4)) erreurs.push(`montant hors bornes ${d.empreinte}`);
    if (d.dateDevis && !d.dateRdv) erreurs.push(`devis sans rdv ${d.empreinte}`);
    if (d.dateSignature && !d.dateDevis) erreurs.push(`signature sans devis ${d.empreinte}`);
    if (d.datePose && !d.dateSignature) erreurs.push(`pose sans signature ${d.empreinte}`);
  }
  const caSigne = dossiers.filter((d) => d.dateSignature && d.statut !== "annule").reduce((s, d) => s + (d.montantHt ?? 0), 0);
  const commissions = dossiers.filter((d) => d.dateSignature && d.statut !== "annule").reduce((s, d) => s + (d.commission ?? 0), 0);
  const coutsAcquisition = couts.reduce((s, c) => s + c.montant, 0) + commissions;
  const poids = coutsAcquisition / caSigne;
  if (poids < 0.12 || poids > 0.22) erreurs.push(`poids de l'acquisition hors 12 a 22 % : ${(poids * 100).toFixed(1)} %`);
  console.log(`contrôles générateur : ${dossiers.length} dossiers, CA signe ${Math.round(caSigne / 1000)} k€, acquisition ${(poids * 100).toFixed(1)} % du CA`);
  if (erreurs.length > 0) {
    console.error(erreurs.slice(0, 20).join("\n"));
    throw new Error(`${erreurs.length} erreur(s) du générateur`);
  }
}

async function charger(dossiers: Dossier[], couts: CoutCanal[], jusqua: string): Promise<void> {
  const client = await connexion();
  try {
    await client.query("begin");
    await client.query("truncate buta.fait_dossier, buta.fait_cout_canal, buta.charge_agence, buta.objectif");
    const colonnes = [
      "agence", "commercial", "canal", "produit", "produit_libelle_source", "departement", "empreinte_contact",
      "date_lead", "date_rdv_planifie", "date_rdv", "date_devis", "montant_devis", "date_signature", "date_pose",
      "date_encaissement", "date_annulation", "motif_annulation", "statut", "prix_catalogue", "taux_remise",
      "montant_ht", "cout_materiel", "cout_pose", "commission", "aide_montant", "aide_versee_le", "technicien",
      "publie", "lot_generation",
    ];
    const f = (x: Date | null) => (x ? formatDate(x) : null);
    const lignes = dossiers.map((d) => [
      d.agence, d.commercial, d.canal, d.produit.code, d.produitLibelleSource, d.departement, d.empreinte,
      f(d.dateLead), f(d.dateRdvPlanifie), f(d.dateRdv), f(d.dateDevis), d.montantDevis, f(d.dateSignature), f(d.datePose),
      f(d.dateEncaissement), f(d.dateAnnulation), d.motifAnnulation, d.statut, d.prixCatalogue, d.tauxRemise,
      d.montantHt, d.coutMateriel, d.coutPose, d.commission, d.aideMontant, f(d.aideVerseeLe), d.technicien,
      false, LOT_GENERATION,
    ]);
    const n = await insererParLots(client, "buta.fait_dossier", colonnes, lignes, 800);
    console.log(`fait_dossier : ${n} lignes`);
    const nc = await insererParLots(client, "buta.fait_cout_canal", ["mois", "agence", "canal", "montant"],
      couts.map((c) => [c.mois, c.agence, c.canal, c.montant]));
    console.log(`fait_cout_canal : ${nc} lignes`);
    const charges = genererCharges();
    const nch = await insererParLots(client, "buta.charge_agence",
      ["mois", "agence", "salaires_commerciaux", "salaires_techniciens", "structure", "vehicules"],
      charges.map((c) => [c.mois, c.agence, c.sc, c.st, c.structure, c.vehicules]));
    console.log(`charge_agence : ${nch} lignes`);
    const objectifs = genererObjectifs(new Alea(GRAINE + 1), dossiers);
    const no = await insererParLots(client, "buta.objectif",
      ["mois", "agence", "produit", "ventes", "prix_catalogue_cible", "taux_remise_cible"],
      objectifs.map((o) => [o.mois, o.agence, o.produit, o.ventes, o.prix, o.remise]));
    console.log(`objectif : ${no} lignes`);
    await client.query("commit");
    await publier(client, jusqua);
  } catch (erreur) {
    await client.query("rollback").catch(() => undefined);
    throw erreur;
  } finally {
    await client.end();
  }
}

async function publier(client: pg.Client, jusqua: string): Promise<void> {
  const resultat = await client.query(
    "update buta.fait_dossier set publie = true where date_lead <= $1 and not publie", [jusqua]);
  await client.query(
    `insert into buta.source_fraicheur (source, date_reference, ingere_le, prochaine)
     values ('journee_simulee', $1, now(), ($1::date + 1))
     on conflict (source) do update set date_reference = excluded.date_reference, ingere_le = now(), prochaine = excluded.prochaine`,
    [jusqua]);
  console.log(`publie jusqu'au ${jusqua} : ${resultat.rowCount ?? 0} dossier(s) nouvellement publie(s)`);
}

function lireArgument(nom: string): string | undefined {
  const index = process.argv.indexOf(nom);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function principal(): Promise<void> {
  const hier = ajouterJours(new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())), -1);
  const jusqua = lireArgument("--jusqua") ?? formatDate(hier);
  if (jusqua < formatDate(DEBUT) || jusqua > formatDate(FIN)) throw new Error(`--jusqua hors période : ${jusqua}`);

  if (process.argv.includes("--publier")) {
    chargerEnv();
    const client = await connexion();
    try {
      await publier(client, jusqua);
    } finally {
      await client.end();
    }
    return;
  }

  const alea = new Alea(GRAINE);
  const dossiers = genererDossiers(alea);
  dossiers.sort((a, b) => a.dateLead.getTime() - b.dateLead.getTime() || a.agence.localeCompare(b.agence) || a.empreinte.localeCompare(b.empreinte));
  const couts = genererCouts(dossiers);
  controlesGenerateur(dossiers, couts);
  if (process.argv.includes("--sans-chargement")) return;
  chargerEnv();
  await charger(dossiers, couts, jusqua);
}

principal().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});
