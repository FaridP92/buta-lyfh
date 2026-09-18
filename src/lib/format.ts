/**
 * Formatage à la française (docs/DESIGN.md §2, docs/INDICATEURS.md conventions).
 * Espace insécable (U+00A0) avant %, avant l'unité et entre milliers, virgule décimale,
 * (l'espace fine U+202F se rend à 1,3 px dans Instrument Sans : le nombre collait à son unité, relecture du 18 septembre),
 * k€ et M€ à partir de 10 000 et 1 000 000, « n. d. » pour une valeur non calculable.
 */

const ESPACE_FINE = " ";

function estVide(valeur: number | null | undefined): valeur is null | undefined {
  return valeur === null || valeur === undefined || Number.isNaN(valeur);
}

function formatNombreFr(valeur: number, decimales: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valeur).replace(/\u202F/g, ESPACE_FINE); // Intl sépare les milliers par l'espace fine : même caractère partout.
}

/** Unité d'affichage d'une colonne de montants, choisie une fois pour toute la colonne à partir du plus grand montant. */
export type UniteMontant = "eur" | "keur" | "meur";
export function uniteMontantPour(valeurs: readonly (number | null | undefined)[]): UniteMontant {
  const max = Math.max(0, ...valeurs.map((v) => (estVide(v) ? 0 : Math.abs(v))));
  return max >= 1_000_000 ? "meur" : max >= 10_000 ? "keur" : "eur";
}

/** Montant dans une unité imposée (colonne triable, axe de graphique) : les chiffres restent alignés. */
export function formatMontantUnite(valeur: number | null | undefined, unite: UniteMontant, decimales?: number): string {
  if (estVide(valeur)) return "n. d.";
  if (unite === "meur") return `${formatNombreFr(valeur / 1_000_000, decimales ?? 1)}${ESPACE_FINE}M€`;
  if (unite === "keur") return `${formatNombreFr(valeur / 1_000, decimales ?? 1)}${ESPACE_FINE}k€`;
  return `${formatNombreFr(valeur, decimales ?? 0)}${ESPACE_FINE}€`;
}

export function formatMontant(valeur: number | null | undefined): string {
  if (estVide(valeur)) return "n. d.";
  const abs = Math.abs(valeur);
  if (abs >= 1_000_000) {
    return `${formatNombreFr(valeur / 1_000_000, 1)}${ESPACE_FINE}M€`;
  }
  if (abs >= 10_000) {
    return `${formatNombreFr(valeur / 1_000, 1)}${ESPACE_FINE}k€`;
  }
  return `${formatNombreFr(valeur, 0)}${ESPACE_FINE}€`;
}

export function formatTaux(valeur: number | null | undefined, decimales = 1): string {
  if (estVide(valeur)) return "n. d.";
  return `${formatNombreFr(valeur, decimales)}${ESPACE_FINE}%`;
}

/** Probabilité en pourcentage entier, bornée en lecture : « < 1 % » et « > 99 % » plutôt que 0 et 100. */
export function formatProbabilite(valeur: number | null | undefined): string {
  if (estVide(valeur)) return "n. d.";
  if (valeur < 1) return `<${ESPACE_FINE}1${ESPACE_FINE}%`;
  if (valeur > 99) return `>${ESPACE_FINE}99${ESPACE_FINE}%`;
  return formatTaux(valeur, 0);
}

export function formatVariationPoints(valeur: number | null | undefined, decimales = 1): string {
  if (estVide(valeur)) return "n. d.";
  const signe = valeur > 0 ? "+" : "";
  return `${signe}${formatNombreFr(valeur, decimales)}${ESPACE_FINE}pt${Math.abs(valeur) >= 2 ? "s" : ""}`;
}

export function formatDelaiJours(valeur: number | null | undefined): string {
  if (estVide(valeur)) return "n. d.";
  return `${formatNombreFr(Math.round(valeur), 0)}${ESPACE_FINE}j`;
}

export function formatNombre(valeur: number | null | undefined): string {
  if (estVide(valeur)) return "n. d.";
  return formatNombreFr(valeur, 0);
}

/** Nombre à décimales fixes (virgule décimale, espace fine entre milliers) : 2,35 pour deux décimales. */
export function formatNombreDecimal(valeur: number | null | undefined, decimales = 1): string {
  if (estVide(valeur)) return "n. d.";
  return formatNombreFr(valeur, decimales);
}

const REGEX_DATE_SEULE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * new Date("2026-02-15") est interprété en UTC : sur un fuseau à l'ouest de
 * Greenwich, .getDate() peut alors renvoyer le 14. On force une lecture en
 * heure locale pour une chaîne « AAAA-MM-JJ ».
 */
function versDate(date: string | Date): Date {
  if (typeof date !== "string") return date;
  if (REGEX_DATE_SEULE.test(date)) {
    const [annee, mois, jour] = date.split("-").map(Number);
    return new Date(annee as number, (mois as number) - 1, jour as number);
  }
  return new Date(date);
}

const MOIS_ABREGES = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
] as const;

export function formatMoisAbrege(date: string | Date): string {
  const d = versDate(date);
  const mois = MOIS_ABREGES[d.getMonth()];
  return `${mois} ${d.getFullYear()}`;
}

export function formatDateCourte(date: string | Date): string {
  const d = versDate(date);
  const jour = d.getDate().toString().padStart(2, "0");
  const mois = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${jour}/${mois}`;
}

/** Date avec l'année (JJ/MM/AAAA) : pour les millésimes et les échéances qui ne sont pas de l'année en cours. */
export function formatDateAnnee(date: string | Date): string {
  const d = versDate(date);
  return `${formatDateCourte(d)}/${d.getFullYear()}`;
}

export function formatDateHeure(date: string | Date): string {
  const d = versDate(date);
  const jour = d.getDate().toString().padStart(2, "0");
  const mois = (d.getMonth() + 1).toString().padStart(2, "0");
  const heures = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${jour}/${mois} ${heures}:${minutes}`;
}
