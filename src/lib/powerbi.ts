import { versCSV, versZip, type LigneExport } from "@/lib/export";
import { genererLisezMoi, genererMesuresDax } from "@/lib/dax";

/**
 * Export Power BI (ECRANS.md §11) : un zip avec un CSV par vue mart_ (séparateur point-virgule, décimale à la
 * virgule, UTF-8 avec BOM, ce qu'Excel et Power Query français lisent sans réglage), modele_etoile.md qui décrit
 * le modèle en étoile et les colonnes réellement présentes, mesures.dax et LISEZMOI.md (palier B, src/lib/dax.ts).
 */
export interface VueExportee {
  nom: string;
  lignes: readonly LigneExport[];
}

/** Description du rôle de chaque vue dans le modèle en étoile. */
const ROLES: Record<string, { role: "fait" | "dimension" | "service"; grain: string; cles: string; note?: string }> = {
  mart_kpi_mensuel: { role: "fait", grain: "mois × agence (RESEAU = total)", cles: "mois, agence" },
  mart_funnel: { role: "fait", grain: "mois de création du lead × agence × canal (TOUS = total)", cles: "mois, agence, canal", note: "mesures de cohorte, ne pas additionner avec les mesures d'événement" },
  mart_ventes_produit: { role: "fait", grain: "mois de signature × agence × produit (TOUS = total)", cles: "mois, agence, produit" },
  mart_ecarts: { role: "fait", grain: "mois × agence × comparaison (objectif ou n1)", cles: "mois, agence, comparaison" },
  mart_couts_acquisition: { role: "fait", grain: "mois de création × agence × canal", cles: "mois, agence, canal" },
  mart_delais: { role: "fait", grain: "mois de pose × agence × département", cles: "mois, agence, departement" },
  mart_pose: { role: "fait", grain: "semaine × agence", cles: "semaine, agence" },
  mart_encaissement: { role: "fait", grain: "mois × agence", cles: "mois, agence" },
  mart_forecast: { role: "fait", grain: "agence × année", cles: "agence, annee" },
  mart_remises: { role: "fait", grain: "grain (mois, trimestre, annee) × période × agence", cles: "grain, periode, agence" },
  mart_objectif_mensuel: { role: "fait", grain: "mois × agence", cles: "mois, agence" },
  mart_qualite: { role: "service", grain: "jour × contrôle", cles: "jour, controle" },
  mart_marche_departement: { role: "dimension", grain: "département (96, métropole)", cles: "departement", note: "données réelles (Insee, ADEME, RTE)" },
  mart_marche_commune: { role: "dimension", grain: "commune des onze départements du périmètre", cles: "code_insee", note: "données réelles" },
  mart_automatisation: { role: "service", grain: "exécution n8n", cles: "workflow, debut" },
  mart_alertes: { role: "service", grain: "alerte à la journée publiée", cles: "code, agence" },
  mart_plans_action: { role: "service", grain: "plan d'action", cles: "id" },
  mart_revue_hebdo: { role: "service", grain: "semaine", cles: "semaine" },
  mart_reconciliation_libelles: { role: "service", grain: "agence × libellé source", cles: "agence, libelle_source" },
  mart_fraicheur: { role: "service", grain: "source de données", cles: "source" },
  mart_ia_usage: { role: "service", grain: "jour × fonction IA", cles: "jour, fonction" },
};

function colonnesDe(lignes: readonly LigneExport[]): string[] {
  const cles = new Set<string>();
  for (const l of lignes) for (const k of Object.keys(l)) cles.add(k);
  return [...cles];
}

/** Le modèle en étoile, en Markdown, avec les colonnes réellement exportées. */
export function modeleEtoile(vues: readonly VueExportee[], journeePubliee: string | null, genereLe: string): string {
  const lignes: string[] = [
    "# Buta.Lyfh : modèle en étoile pour Power BI (palier A)",
    "",
    `Export généré le ${genereLe}${journeePubliee ? `, journée publiée du ${journeePubliee}` : ""}. Démonstrateur personnel de Frédéric Poissonnier, sans lien avec Butagaz. Données de marché publiques (Insee, ADEME, RTE, licence ouverte), données d'activité simulées.`,
    "",
    "## Lecture",
    "",
    "- Chaque fichier CSV correspond à une vue `mart_` du schéma `buta` : séparateur point-virgule, décimale à la virgule, encodage UTF-8 avec BOM, dates au format AAAA-MM-JJ.",
    "- Les tables de faits portent une ligne par grain indiqué ; les totaux sont des lignes à part (`RESEAU` pour toutes les agences, `TOUS` pour tous les canaux ou produits) : les filtrer avant d'additionner.",
    "- Deux familles de mesures ne se mélangent pas : mesures d'événement (mois de signature, de pose, d'encaissement) et mesures de cohorte (mois de création du lead).",
    "- Dimensions conseillées dans Power BI : `dim_date` (à partir de la colonne `mois`), agences (codes SAI, ANG, MAR, BOR, MSN, BDX, HGI, ARC, NOR, nommées par bassin), canaux, produits. Les relations se font sur les clés indiquées.",
    "- Aucune mesure n'est recalculée dans les fichiers : les ratios (taux, coûts unitaires) viennent des vues. Pour agréger sur une période, recalculer le ratio depuis les sommes (`DIVIDE(SUM(marge_brute), SUM(ca_signe))`), jamais moyenner des taux.",
    "",
    "## Tables",
    "",
    "| Fichier | Rôle | Grain | Clés | Lignes | Colonnes |",
    "|---|---|---|---|---|---|",
  ];
  for (const v of vues) {
    const r = ROLES[v.nom];
    lignes.push(`| ${v.nom}.csv | ${r?.role ?? "service"} | ${r?.grain ?? "voir INDICATEURS.md"} | ${r?.cles ?? ""} | ${v.lignes.length} | ${colonnesDe(v.lignes).join(", ")} |${r?.note ? ` ${r.note}` : ""}`);
  }
  lignes.push("", "## Mesures et fiches", "", "Les définitions, formules et sens de lecture de chaque indicateur sont dans `docs/INDICATEURS.md` du dépôt et dans la fiche « i » de chaque écran. Les mesures du modèle sont dans `mesures.dax`, la marche à suivre dans `LISEZMOI.md`.", "");
  return lignes.join("\n");
}

/** Construit le zip : un CSV par vue, plus modele_etoile.md, mesures.dax et LISEZMOI.md. */
export function construireZipPowerBi(vues: readonly VueExportee[], journeePubliee: string | null, genereLe: string): Uint8Array {
  const fichiers: Record<string, string> = {};
  for (const v of vues) {
    const colonnes = colonnesDe(v.lignes).map((c) => ({ cle: c, libelle: c }));
    fichiers[`${v.nom}.csv`] = versCSV(v.lignes, colonnes);
  }
  fichiers["modele_etoile.md"] = modeleEtoile(vues, journeePubliee, genereLe);
  fichiers["mesures.dax"] = genererMesuresDax(genereLe);
  fichiers["LISEZMOI.md"] = genererLisezMoi(journeePubliee, genereLe, vues.length);
  return versZip(fichiers);
}
