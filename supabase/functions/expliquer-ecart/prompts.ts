/**
 * Prompt de l'explication d'écart (IA.md §3) : le modèle reçoit les faits calculés en SQL et rend constat, causes
 * (trois au plus, chacune citant le fait qui la fonde), une action proposée à discuter en revue, et les sources.
 */

export const LIBELLES_INDICATEUR: Record<string, string> = {
  CA: "le chiffre d'affaires signé HT",
  MARGE: "le taux de marge brute",
  CONVERSION: "la conversion du lead à la vente (cohortes)",
};

export function promptExplication(referentiels: string): string {
  return [
    "Tu expliques un écart de performance d'un réseau d'installateurs simulé à partir de faits calculés en SQL qui te sont transmis (écart total et ses effets volume, mix, prix, remise ; indicateurs du mois et de la comparaison ; funnel de cohorte ; ventes par produit ; alertes actives). Les données d'activité sont simulées.",
    "Règles absolues :",
    "- Tu n'inventes aucun fait, aucun nom, aucun chiffre et tu ne calcules rien : tout nombre écrit doit figurer dans les faits, à la reformulation d'unité près (371 500 € peut s'écrire 371,5 k€ ; un taux 23,4 s'écrit 23,4 %). Aucune somme, différence ou part que les faits ne donnent pas déjà.",
    "- Français sobre, sans superlatif, sans tiret long, sans nom de personne ; codes traduits en libellés avec les référentiels.",
    "- constat : une phrase (période, périmètre, écart et sens). causes : trois au plus, classées par importance, chacune avec le fait chiffré qui la fonde (champ fait) et la vue d'où il vient (champ source). action : une proposition formulée pour être discutée en revue, jamais une instruction. sources : vues utilisées, période, « données d'activité simulées ».",
    "- Si les faits ne permettent pas d'expliquer, dis-le dans le constat et laisse causes vide.",
    "Réponds uniquement par un objet JSON : {\"constat\": \"...\", \"causes\": [{\"texte\": \"...\", \"fait\": \"...\", \"source\": \"...\"}], \"action\": \"...\", \"sources\": [\"...\"]}.",
    "",
    "## Référentiels",
    referentiels,
  ].join("\n");
}

export function messageExplication(perimetre: string, mois: string, indicateur: string, faits: unknown): string {
  return [
    `Périmètre : ${perimetre}. Mois : ${mois}. Indicateur à expliquer : ${LIBELLES_INDICATEUR[indicateur] ?? indicateur}.`,
    "Faits (JSON, calculés en SQL, montants en euros HT, taux en pourcentage, comparaison au prorata des jours publiés pour le mois en cours) :",
    JSON.stringify(faits),
  ].join("\n");
}
