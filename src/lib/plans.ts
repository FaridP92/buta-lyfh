/**
 * Plans d'action et rituels (ECRANS.md §7) : résumé des plans (comptes et gains additionnés, rien d'autre) et calendrier
 * des revues, données de référence du démonstrateur.
 */

export interface LignePlan {
  statut: string;
  gain_attendu: number | null;
  avancement: number | null;
}

export interface ResumePlans {
  total: number;
  en_cours: number;
  planifies: number;
  termines: number;
  /** Somme des gains attendus des plans non terminés, en euros. */
  gain_attendu_ouvert: number;
  /** Somme des gains attendus des plans terminés, en euros. */
  gain_attendu_termine: number;
}

export function resumerPlans(plans: readonly LignePlan[]): ResumePlans {
  const somme = (liste: readonly LignePlan[]) => liste.reduce((s, p) => s + (p.gain_attendu ?? 0), 0);
  const termines = plans.filter((p) => p.statut === "terminé");
  return {
    total: plans.length,
    en_cours: plans.filter((p) => p.statut === "en cours").length,
    planifies: plans.filter((p) => p.statut === "planifié").length,
    termines: termines.length,
    gain_attendu_ouvert: somme(plans.filter((p) => p.statut !== "terminé")),
    gain_attendu_termine: somme(termines),
  };
}

export function statutPlan(statut: string): { texte: string; statut: "succes" | "attention" | "neutre" | "alerte" } {
  if (statut === "terminé") return { texte: "terminé", statut: "succes" };
  if (statut === "en cours") return { texte: "en cours", statut: "attention" };
  if (statut === "planifié") return { texte: "planifié", statut: "neutre" };
  return { texte: statut, statut: "neutre" };
}

export interface Rituel {
  code: string;
  nom: string;
  frequence: string;
  moment: string;
  duree: string;
  participants: string;
  ordreDuJour: string[];
  indicateurs: string[];
  ecran: string;
}

export const RITUELS: readonly Rituel[] = [
  {
    code: "pipe", nom: "Revue de pipe", frequence: "hebdomadaire", moment: "lundi 09:00, après la revue générée à 07:00", duree: "30 minutes", participants: "responsables d'agence, Responsable Performance",
    ordreDuJour: ["Leads de la semaine et leads sans rendez-vous à 48 heures", "Devis en attente de plus de 30 jours, par agence", "Signatures de la semaine contre la semaine précédente", "Décisions proposées par la revue hebdomadaire, suivi de celles de la semaine passée"],
    indicateurs: ["LEADS", "ATTENTE48", "TX_SIGN", "PIPE_POND"], ecran: "/funnel",
  },
  {
    code: "marge", nom: "Revue de marge", frequence: "mensuelle", moment: "le 5 du mois, sur le mois clos", duree: "45 minutes", participants: "direction commerciale, responsables d'agence, contrôle de gestion",
    ordreDuJour: ["Écart de CA décomposé : volume, mix, prix, remise", "Taux de marge brute et marge après acquisition par agence", "Remises : distribution par agence, plafonds", "Coût par vente par canal, canaux à revoir"],
    indicateurs: ["ECART_CA", "TX_MARGE", "MARGE_ACQ", "REMISE", "CPV"], ecran: "/ventes",
  },
  {
    code: "forecast", nom: "Revue de forecast", frequence: "mensuelle", moment: "le 10 du mois", duree: "30 minutes", participants: "direction commerciale, direction financière, Responsable Performance",
    ordreDuJour: ["Atterrissage central, bornes, probabilité d'atteinte", "Hypothèses : pipe pondéré, taux de signature du pipe, run-rate", "Risques et opportunités par agence", "Carnet de pose et CA posé à risque"],
    indicateurs: ["ATTERR", "PIPE_POND", "P_ATTEINTE", "CARNET"], ecran: "/forecast",
  },
  {
    code: "performance", nom: "Revue de performance", frequence: "trimestrielle", moment: "premier mois du trimestre, sur le trimestre clos", duree: "2 heures", participants: "comité de direction, responsables d'agence",
    ordreDuJour: ["Objectifs et réalisé du trimestre par agence", "Plans d'action : gains obtenus contre gains attendus", "Qualité des données : score, contrôles, référentiels", "Territoires : marché réel, couverture à distance, potentiel non servi"],
    indicateurs: ["VENTES", "CA_SIGNE", "RESULTAT", "QUALITE", "INDICE"], ecran: "/",
  },
];
