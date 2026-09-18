/**
 * Export Power BI, palier B (ECRANS.md §11, BACKLOG US-044) : les mesures DAX du modèle en étoile et le LISEZMOI.
 * Règle : chaque ratio est recalculé depuis les sommes avec DIVIDE (jamais une moyenne de taux), les lignes de
 * total (RESEAU, TOUS) sont exclues par les mesures, les médianes ne s'agrègent pas et le disent.
 */

export interface MesureDax {
  table: string;
  nom: string;
  expression: string;
  description: string;
}

const HORS_RESEAU = (table: string) => `${table}[agence] <> "RESEAU"`;
const HORS_TOUS = (table: string, colonne: string) => `${table}[${colonne}] <> "TOUS"`;

export const MESURES: readonly MesureDax[] = [
  // Ventes et marge (mesures d'événement, mois de signature).
  { table: "mart_kpi_mensuel", nom: "Ventes signées", expression: `CALCULATE ( SUM ( mart_kpi_mensuel[ventes] ), ${HORS_RESEAU("mart_kpi_mensuel")} )`, description: "Dossiers signés hors annulations connues à la journée publiée." },
  { table: "mart_kpi_mensuel", nom: "CA signé HT", expression: `CALCULATE ( SUM ( mart_kpi_mensuel[ca_signe] ), ${HORS_RESEAU("mart_kpi_mensuel")} )`, description: "Montants HT nets de remise des ventes signées." },
  { table: "mart_kpi_mensuel", nom: "CA posé HT", expression: `CALCULATE ( SUM ( mart_kpi_mensuel[ca_pose] ), ${HORS_RESEAU("mart_kpi_mensuel")} )`, description: "Montants HT des dossiers posés dans le mois." },
  { table: "mart_kpi_mensuel", nom: "Encaissé", expression: `CALCULATE ( SUM ( mart_kpi_mensuel[encaisse] ), ${HORS_RESEAU("mart_kpi_mensuel")} )`, description: "Montants HT encaissés dans le mois." },
  { table: "mart_kpi_mensuel", nom: "Marge brute", expression: `CALCULATE ( SUM ( mart_kpi_mensuel[marge_brute] ), ${HORS_RESEAU("mart_kpi_mensuel")} )`, description: "CA signé moins matériel et pose." },
  { table: "mart_kpi_mensuel", nom: "Taux de marge brute", expression: "DIVIDE ( [Marge brute], [CA signé HT] )", description: "Recalculé depuis les sommes, jamais une moyenne de taux." },
  { table: "mart_kpi_mensuel", nom: "Panier moyen", expression: "DIVIDE ( [CA signé HT], [Ventes signées] )", description: "CA signé par vente." },
  { table: "mart_kpi_mensuel", nom: "Remises", expression: `CALCULATE ( SUM ( mart_kpi_mensuel[remises] ), ${HORS_RESEAU("mart_kpi_mensuel")} )`, description: "Montant des remises accordées." },
  { table: "mart_kpi_mensuel", nom: "Prix catalogue total", expression: `CALCULATE ( SUM ( mart_kpi_mensuel[prix_catalogue_total] ), ${HORS_RESEAU("mart_kpi_mensuel")} )`, description: "Somme des prix catalogue des ventes signées." },
  { table: "mart_kpi_mensuel", nom: "Taux de remise", expression: "DIVIDE ( [Remises], [Prix catalogue total] )", description: "Remises rapportées au prix catalogue, pondérées par construction." },
  { table: "mart_kpi_mensuel", nom: "Coûts d'acquisition", expression: `CALCULATE ( SUM ( mart_kpi_mensuel[couts_acquisition] ), ${HORS_RESEAU("mart_kpi_mensuel")} )`, description: "Coûts des canaux, au prorata des jours publiés pour le mois en cours." },
  { table: "mart_kpi_mensuel", nom: "Marge après acquisition", expression: `CALCULATE ( SUM ( mart_kpi_mensuel[marge_apres_acquisition] ), ${HORS_RESEAU("mart_kpi_mensuel")} )`, description: "Marge brute moins coûts d'acquisition et commissions." },
  { table: "mart_kpi_mensuel", nom: "Résultat d'agence", expression: `CALCULATE ( SUM ( mart_kpi_mensuel[resultat] ), ${HORS_RESEAU("mart_kpi_mensuel")} )`, description: "Marge après acquisition moins charges d'agence." },
  { table: "mart_kpi_mensuel", nom: "Objectif CA", expression: `CALCULATE ( SUM ( mart_kpi_mensuel[objectif_ca] ), ${HORS_RESEAU("mart_kpi_mensuel")} )`, description: "Objectif du mois entier ; multiplier par [Prorata] pour le mois en cours." },
  { table: "mart_kpi_mensuel", nom: "Prorata", expression: `CALCULATE ( MAX ( mart_kpi_mensuel[prorata] ), ${HORS_RESEAU("mart_kpi_mensuel")} )`, description: "Jours publiés / jours du mois (1 pour un mois complet) ; à utiliser au grain mois." },
  { table: "mart_kpi_mensuel", nom: "Écart à l'objectif", expression: "[CA signé HT] - [Objectif CA] * [Prorata]", description: "CA signé moins objectif proratisé." },
  { table: "mart_kpi_mensuel", nom: "Écart à l'objectif (%)", expression: "DIVIDE ( [Écart à l'objectif], [Objectif CA] * [Prorata] )", description: "Écart relatif à l'objectif proratisé." },
  { table: "mart_kpi_mensuel", nom: "CA signé N-1", expression: "CALCULATE ( [CA signé HT], SAMEPERIODLASTYEAR ( dim_date[date] ) )", description: "Nécessite la table dim_date reliée à mart_kpi_mensuel[mois] (voir LISEZMOI)." },
  { table: "mart_kpi_mensuel", nom: "Évolution CA N-1 (%)", expression: "DIVIDE ( [CA signé HT] - [CA signé N-1], [CA signé N-1] )", description: "Écart relatif au même mois de l'année précédente." },
  // Funnel (mesures de cohorte, mois de création du lead) : ligne TOUS des canaux, agences détaillées.
  { table: "mart_funnel", nom: "Leads", expression: `CALCULATE ( SUM ( mart_funnel[leads] ), mart_funnel[canal] = "TOUS", ${HORS_RESEAU("mart_funnel")} )`, description: "Leads créés dans le mois (cohorte), tous canaux." },
  { table: "mart_funnel", nom: "RDV tenus", expression: `CALCULATE ( SUM ( mart_funnel[rdv_tenus] ), mart_funnel[canal] = "TOUS", ${HORS_RESEAU("mart_funnel")} )`, description: "RDV tenus de la cohorte." },
  { table: "mart_funnel", nom: "Devis", expression: `CALCULATE ( SUM ( mart_funnel[devis] ), mart_funnel[canal] = "TOUS", ${HORS_RESEAU("mart_funnel")} )`, description: "Devis émis de la cohorte." },
  { table: "mart_funnel", nom: "Signatures", expression: `CALCULATE ( SUM ( mart_funnel[signatures] ), mart_funnel[canal] = "TOUS", ${HORS_RESEAU("mart_funnel")} )`, description: "Signatures de la cohorte." },
  { table: "mart_funnel", nom: "Signatures nettes", expression: `CALCULATE ( SUM ( mart_funnel[signatures_nettes] ), mart_funnel[canal] = "TOUS", ${HORS_RESEAU("mart_funnel")} )`, description: "Signatures nettes des annulations à 90 jours." },
  { table: "mart_funnel", nom: "Taux de RDV", expression: "DIVIDE ( [RDV tenus], [Leads] )", description: "RDV tenus / leads, sur la cohorte." },
  { table: "mart_funnel", nom: "Taux de devis", expression: "DIVIDE ( [Devis], [RDV tenus] )", description: "Devis / RDV tenus." },
  { table: "mart_funnel", nom: "Taux de signature", expression: "DIVIDE ( [Signatures], [Devis] )", description: "Signatures / devis." },
  { table: "mart_funnel", nom: "Conversion lead vers vente", expression: "DIVIDE ( [Signatures nettes], [Leads] )", description: "À lire sur les cohortes mûres (cohorte_mature = vrai) seulement." },
  // Acquisition (cohortes par canal) : canaux détaillés, agences détaillées.
  { table: "mart_couts_acquisition", nom: "Coût d'acquisition", expression: `CALCULATE ( SUM ( mart_couts_acquisition[cout] ), ${HORS_TOUS("mart_couts_acquisition", "canal")}, ${HORS_RESEAU("mart_couts_acquisition")} )`, description: "Coûts d'acquisition hors commissions." },
  { table: "mart_couts_acquisition", nom: "Leads par canal", expression: `CALCULATE ( SUM ( mart_couts_acquisition[leads] ), ${HORS_TOUS("mart_couts_acquisition", "canal")}, ${HORS_RESEAU("mart_couts_acquisition")} )`, description: "Leads de la cohorte par canal." },
  { table: "mart_couts_acquisition", nom: "Ventes par canal", expression: `CALCULATE ( SUM ( mart_couts_acquisition[ventes] ), ${HORS_TOUS("mart_couts_acquisition", "canal")}, ${HORS_RESEAU("mart_couts_acquisition")} )`, description: "Ventes nettes de la cohorte par canal." },
  { table: "mart_couts_acquisition", nom: "Coût par lead", expression: "DIVIDE ( [Coût d'acquisition], [Leads par canal] )", description: "Coût / leads, recalculé depuis les sommes." },
  { table: "mart_couts_acquisition", nom: "Coût par vente", expression: "DIVIDE ( [Coût d'acquisition], [Ventes par canal] )", description: "Coût / ventes de la cohorte, hors commissions." },
  // Pose et encaissement.
  { table: "mart_pose", nom: "Poses", expression: `CALCULATE ( SUM ( mart_pose[poses] ), ${HORS_RESEAU("mart_pose")} )`, description: "Poses réalisées dans la semaine." },
  { table: "mart_pose", nom: "Capacité de pose (jours-technicien)", expression: `CALCULATE ( SUM ( mart_pose[capacite_jt_semaine] ), ${HORS_RESEAU("mart_pose")} )`, description: "Techniciens actifs × 5 jours." },
  { table: "mart_pose", nom: "Charge de pose (%)", expression: `DIVIDE ( CALCULATE ( SUM ( mart_pose[jt_poses] ), ${HORS_RESEAU("mart_pose")} ), [Capacité de pose (jours-technicien)] )`, description: "Jours-technicien posés rapportés à la capacité." },
  { table: "mart_encaissement", nom: "Encaissements", expression: `CALCULATE ( SUM ( mart_encaissement[encaissements] ), ${HORS_RESEAU("mart_encaissement")} )`, description: "Nombre d'encaissements du mois." },
  { table: "mart_encaissement", nom: "Montant encaissé", expression: `CALCULATE ( SUM ( mart_encaissement[encaisse] ), ${HORS_RESEAU("mart_encaissement")} )`, description: "Montant HT encaissé dans le mois (même valeur que [Encaissé] de mart_kpi_mensuel)." },
  // Forecast (année × agence).
  { table: "mart_forecast", nom: "Réalisé à date", expression: `CALCULATE ( SUM ( mart_forecast[realise_a_date] ), ${HORS_RESEAU("mart_forecast")} )`, description: "CA signé cumulé de l'année à la journée publiée." },
  { table: "mart_forecast", nom: "Objectif annuel", expression: `CALCULATE ( SUM ( mart_forecast[objectif_annuel] ), ${HORS_RESEAU("mart_forecast")} )`, description: "Objectif de CA de l'année." },
  { table: "mart_forecast", nom: "Pipe pondéré", expression: `CALCULATE ( SUM ( mart_forecast[pipe_pondere] ), ${HORS_RESEAU("mart_forecast")} )`, description: "Devis en cours pondérés par le taux de signature par tranche d'âge et l'annulation." },
];

/** Fichier mesures.dax : une mesure par bloc, groupées par table, prêtes à coller dans Power BI (Nouvelle mesure). */
export function genererMesuresDax(genereLe: string): string {
  const lignes: string[] = [
    "// Buta.Lyfh : mesures DAX du modèle en étoile (palier B).",
    `// Généré le ${genereLe}. Démonstrateur personnel de Frédéric Poissonnier, sans lien avec Butagaz. Données d'activité simulées, marché réel (Insee, ADEME, RTE).`,
    "// Convention : les ratios sont recalculés avec DIVIDE depuis les sommes, jamais moyennés ; les lignes de total (agence RESEAU, canal ou produit TOUS) sont exclues par les mesures.",
    "// Créez chaque mesure dans la table indiquée (Nouvelle mesure, puis coller l'expression après le signe égal).",
    "",
  ];
  let tableCourante = "";
  for (const m of MESURES) {
    if (m.table !== tableCourante) {
      tableCourante = m.table;
      lignes.push(`// ---- Table ${m.table} ----`, "");
    }
    lignes.push(`// ${m.description}`, `${m.nom} =`, m.expression, "");
  }
  return lignes.join("\n");
}

/** LISEZMOI.md de l'export : import des CSV, dimensions, relations, mesures et pièges. */
export function genererLisezMoi(journeePubliee: string | null, genereLe: string, nombreDeTables: number): string {
  return [
    "# Buta.Lyfh : export pour Power BI",
    "",
    `Export généré le ${genereLe}${journeePubliee ? `, journée publiée du ${journeePubliee}` : ""}. Démonstrateur personnel de Frédéric Poissonnier, sans lien avec Butagaz. Données de marché publiques (Insee, ADEME, RTE, licence ouverte), données d'activité simulées.`,
    "",
    "## Contenu",
    `- ${nombreDeTables} fichiers CSV, un par vue \`mart_\` (séparateur point-virgule, décimale à la virgule, UTF-8 avec BOM, dates AAAA-MM-JJ).`,
    "- `modele_etoile.md` : rôle, grain, clés et colonnes de chaque table.",
    "- `mesures.dax` : les mesures du modèle, prêtes à coller.",
    "",
    "## Import dans Power BI Desktop",
    "1. Obtenir les données, Texte/CSV, choisir chaque fichier ; délimiteur point-virgule, encodage 65001 (UTF-8) ; paramètres régionaux du fichier : Français (France) pour lire la virgule décimale.",
    "2. Dans Power Query, typer les colonnes `mois`, `semaine`, `jour` en Date et les montants en Nombre décimal.",
    "3. Créer la table de dates : `dim_date = CALENDAR ( DATE ( 2025, 1, 1 ), DATE ( 2026, 12, 31 ) )`, la marquer comme table de dates, ajouter les colonnes année et mois (`mois = DATE ( YEAR ( [date] ), MONTH ( [date] ), 1 )`).",
    "4. Créer les dimensions depuis les CSV `dim_agence` (code, nom_bassin), `dim_canal`, `dim_produit` si vous les exportez, ou depuis les codes présents dans les faits (Power Query : supprimer les doublons).",
    "",
    "## Relations (un vers plusieurs, filtre à sens unique)",
    "- `dim_date[mois]` vers `mart_kpi_mensuel[mois]`, `mart_funnel[mois]`, `mart_couts_acquisition[mois]`, `mart_ventes_produit[mois]`, `mart_ecarts[mois]`, `mart_encaissement[mois]`, `mart_objectif_mensuel[mois]` ; `dim_date[date]` vers `mart_pose[semaine]` et `mart_qualite[jour]`.",
    "- `dim_agence[code]` vers chaque colonne `agence` ; `dim_canal[code]` vers `mart_funnel[canal]` et `mart_couts_acquisition[canal]` ; `dim_produit[code]` vers `mart_ventes_produit[produit]`.",
    "- Les lignes de total (`RESEAU`, `TOUS`) restent dans les faits : les mesures de `mesures.dax` les excluent ; si vous écrivez vos propres mesures, filtrez-les vous-même.",
    "",
    "## Pièges",
    "- Ne jamais moyenner un taux : recalculer avec `DIVIDE ( SUM ( numérateur ), SUM ( dénominateur ) )`. Les colonnes de taux des vues servent à la lecture au grain de la vue, pas à l'agrégation.",
    "- Deux familles ne s'additionnent pas : mesures d'événement (mois de signature, de pose, d'encaissement) et mesures de cohorte (mois de création du lead : `mart_funnel`, `mart_couts_acquisition`). Une cohorte de moins de 90 jours n'a pas fini de convertir (`cohorte_mature`).",
    "- Les médianes (`delai_*_median`, `remise_mediane`) ne s'agrègent pas : lisez-les au grain de la vue ou recalculez-les depuis les dossiers, qui ne sont pas exportés.",
    "- Mois en cours : comparer au prorata des jours publiés (`prorata`, `jours_publies`, `jours_mois` de `mart_kpi_mensuel`).",
    "- Les montants sont en euros HT ; les taux des vues sont en pourcentage (23,4 = 23,4 %) alors que les mesures DAX rendent des ratios (0,234) à formater en pourcentage.",
    "",
    "Définitions et formules : `docs/INDICATEURS.md` du dépôt et fiche « i » de chaque écran.",
    "",
  ].join("\n");
}
