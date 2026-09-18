/**
 * Automatisations (ECRANS.md §9, AUTOMATISATIONS.md) : catalogue des workflows n8n, libellé du
 * déclencheur, prochaine exécution en heure de Paris, durée lisible. Le journal des exécutions vient
 * de la vue mart_automatisation ; rien n'est calculé ici sur les données d'activité.
 */

export type Declencheur =
  | { type: "quotidien"; heure: number; minute: number }
  | { type: "hebdomadaire"; jourSemaine: number; heure: number; minute: number }
  | { type: "mensuel"; jourMois: number; heure: number; minute: number }
  | { type: "toutes_les_heures"; toutesLes: number; minute: number }
  | { type: "sur_erreur" };

export interface WorkflowCatalogue {
  code: string;
  nom: string;
  declencheur: Declencheur;
  description: string;
  /** Export JSON servi avec le site (copie du dossier n8n/ du dépôt). */
  fichier: string;
}

export const WORKFLOWS: readonly WorkflowCatalogue[] = [
  { code: "WF1", nom: "Journée simulée", declencheur: { type: "quotidien", heure: 6, minute: 0 }, description: "Publie la journée de la veille (idempotent), rafraîchit les vues matérialisées, met à jour le badge de fraîcheur.", fichier: "/n8n/wf1-journee-simulee.json" },
  { code: "WF2", nom: "Contrôles qualité", declencheur: { type: "quotidien", heure: 6, minute: 20 }, description: "Exécute les douze contrôles de cohérence à la journée publiée et envoie la synthèse par email si un contrôle bloquant échoue ou si le score passe sous 90.", fichier: "/n8n/wf2-controles-qualite.json" },
  { code: "WF5", nom: "Santé", declencheur: { type: "toutes_les_heures", toutesLes: 6, minute: 10 }, description: "Vérifie que le site répond 200 avec « Buta.Lyfh » et que l'API renvoie mart_kpi_mensuel ; email au troisième échec consécutif.", fichier: "/n8n/wf5-sante.json" },
  { code: "WF0", nom: "Erreurs", declencheur: { type: "sur_erreur" }, description: "Journalise en erreur tout workflow planté et envoie un email à partir du troisième échec consécutif.", fichier: "/n8n/wf0-erreurs.json" },
];

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;

function hhmm(heure: number, minute: number): string {
  return `${heure.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

export function libelleDeclencheur(d: Declencheur): string {
  switch (d.type) {
    case "quotidien": return `chaque jour à ${hhmm(d.heure, d.minute)}`;
    case "hebdomadaire": return `chaque ${JOURS[d.jourSemaine] ?? "semaine"} à ${hhmm(d.heure, d.minute)}`;
    case "mensuel": return `le ${d.jourMois === 1 ? "1er" : d.jourMois} du mois à ${hhmm(d.heure, d.minute)}`;
    case "toutes_les_heures": return `toutes les ${d.toutesLes} heures (minute ${d.minute})`;
    case "sur_erreur": return "à l'échec d'un autre workflow";
  }
}

interface HeureLocale { annee: number; mois: number; jour: number; heure: number; minute: number; jourSemaine: number }

/** Heure murale à Paris d'un instant, et décalage (ms) à ajouter à une heure murale de Paris pour retrouver l'instant UTC. */
function heureParis(instant: Date, fuseau: string): { locale: HeureLocale; decalageMs: number } {
  const parties = new Intl.DateTimeFormat("fr-FR", { timeZone: fuseau, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", weekday: "short" }).formatToParts(instant);
  const lire = (type: string) => Number(parties.find((p) => p.type === type)?.value ?? "0");
  const jourCourt = parties.find((p) => p.type === "weekday")?.value ?? "";
  const jourSemaine = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."].indexOf(jourCourt);
  const locale = { annee: lire("year"), mois: lire("month"), jour: lire("day"), heure: lire("hour"), minute: lire("minute"), jourSemaine: jourSemaine < 0 ? 0 : jourSemaine };
  const murale = Date.UTC(locale.annee, locale.mois - 1, locale.jour, locale.heure, locale.minute);
  const secondes = instant.getUTCSeconds() * 1000 + instant.getUTCMilliseconds();
  return { locale, decalageMs: instant.getTime() - secondes - murale };
}

/**
 * Prochaine exécution strictement après `maintenant`, calculée sur l'heure murale de Paris puis ramenée en UTC.
 * Le décalage horaire retenu est celui de l'instant courant (un changement d'heure dans l'intervalle décale d'une heure).
 */
export function prochaineExecution(d: Declencheur, maintenant: Date, fuseau = "Europe/Paris"): Date | null {
  if (d.type === "sur_erreur") return null;
  const { locale, decalageMs } = heureParis(maintenant, fuseau);
  const maintenantMural = Date.UTC(locale.annee, locale.mois - 1, locale.jour, locale.heure, locale.minute);
  let candidat: number;
  if (d.type === "toutes_les_heures") {
    const base = Date.UTC(locale.annee, locale.mois - 1, locale.jour, 0, d.minute);
    candidat = base;
    while (candidat <= maintenantMural) candidat += d.toutesLes * 3_600_000;
  } else if (d.type === "quotidien") {
    candidat = Date.UTC(locale.annee, locale.mois - 1, locale.jour, d.heure, d.minute);
    if (candidat <= maintenantMural) candidat += 86_400_000;
  } else if (d.type === "hebdomadaire") {
    candidat = Date.UTC(locale.annee, locale.mois - 1, locale.jour, d.heure, d.minute);
    let decalageJours = (d.jourSemaine - locale.jourSemaine + 7) % 7;
    if (decalageJours === 0 && candidat <= maintenantMural) decalageJours = 7;
    candidat += decalageJours * 86_400_000;
  } else {
    candidat = Date.UTC(locale.annee, locale.mois - 1, d.jourMois, d.heure, d.minute);
    if (candidat <= maintenantMural) candidat = Date.UTC(locale.annee, locale.mois, d.jourMois, d.heure, d.minute);
  }
  return new Date(candidat + decalageMs);
}

/** Durée en secondes rendue lisible : « 0,4 s », « 21 s », « 2 min 05 s ». */
export function formatDuree(secondes: number | null | undefined): string {
  if (secondes === null || secondes === undefined || Number.isNaN(secondes)) return "n. d.";
  if (secondes < 10) return `${secondes.toFixed(1).replace(".", ",")} s`;
  if (secondes < 60) return `${Math.round(secondes)} s`;
  const minutes = Math.floor(secondes / 60);
  const reste = Math.round(secondes - minutes * 60);
  return `${minutes} min ${reste.toString().padStart(2, "0")} s`;
}

export const LIBELLES_STATUT: Record<string, { texte: string; statut: "succes" | "attention" | "alerte" | "neutre" }> = {
  ok: { texte: "réussi", statut: "succes" },
  deja_publie: { texte: "déjà publié", statut: "succes" },
  alerte: { texte: "alerte envoyée", statut: "attention" },
  erreur: { texte: "en erreur", statut: "alerte" },
};

export function libelleStatut(statut: string): { texte: string; statut: "succes" | "attention" | "alerte" | "neutre" } {
  return LIBELLES_STATUT[statut] ?? { texte: statut, statut: "neutre" };
}

export interface LigneJournal {
  workflow: string;
  debute_le: string;
  statut: string;
  duree_s?: number | null;
}

export interface ResumeJournal {
  executions: number;
  reussites: number;
  erreurs: number;
  /** Part des exécutions sans erreur, en pourcentage ; null sans exécution. */
  taux_reussite: number | null;
  derniere_erreur: LigneJournal | null;
}

/** Résumé du journal sur une fenêtre glissante (exécutions dont le début est postérieur ou égal à `depuis`). */
export function resumerJournal(lignes: readonly LigneJournal[], depuis: Date): ResumeJournal {
  const fenetre = lignes.filter((l) => new Date(l.debute_le).getTime() >= depuis.getTime());
  const erreurs = fenetre.filter((l) => l.statut === "erreur");
  const executions = fenetre.length;
  const derniere = [...erreurs].sort((a, b) => b.debute_le.localeCompare(a.debute_le))[0] ?? null;
  return {
    executions,
    reussites: executions - erreurs.length,
    erreurs: erreurs.length,
    taux_reussite: executions > 0 ? Math.round((1000 * (executions - erreurs.length)) / executions) / 10 : null,
    derniere_erreur: derniere,
  };
}
