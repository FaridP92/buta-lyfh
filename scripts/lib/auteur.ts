/**
 * Coordonnées de l'auteur, affichées sur la couverture et le pied des documents générés
 * (fiche de présentation, synthèse). Une seule source : le guide illustré les reprend en clair
 * dans son en-tête, les générateurs les lisent ici.
 */
export const AUTEUR = {
  nom: "Frédéric Poissonnier",
  telephone: "06 19 80 05 61",
  telephoneLien: "tel:+33619800561",
  email: "faridp@free.fr",
  linkedin: "linkedin.com/in/f-poissonnier",
  linkedinLien: "https://www.linkedin.com/in/f-poissonnier/",
} as const;

/** Ligne de coordonnées en HTML (liens tel:, mailto: et LinkedIn), séparateur point médian. */
export function coordonneesHtml(): string {
  return [
    AUTEUR.nom,
    `<a href="${AUTEUR.telephoneLien}">${AUTEUR.telephone}</a>`,
    `<a href="mailto:${AUTEUR.email}">${AUTEUR.email}</a>`,
    `<a href="${AUTEUR.linkedinLien}">${AUTEUR.linkedin}</a>`,
  ].join(" · ");
}
