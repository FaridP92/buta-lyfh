/**
 * Catalogue des indicateurs (docs/INDICATEURS.md transcrit en données) : la fiche ouverte
 * par le bouton « i » de chaque carte KPI. Une fiche par code, jamais de chiffre ici.
 */
export type Unite = "eur" | "pct" | "nombre" | "jours" | "pts" | "ratio";
export type Sens = "haut" | "bas" | "volume" | "montant" | "structure" | "prevision";

export interface FicheIndicateur {
  code: string;
  libelle: string;
  definition: string;
  formule: string;
  grain: string;
  vue: string;
  unite: Unite;
  sens: Sens;
  source: string;
  note?: string;
}

const SIMULE = "Données d'activité simulées (générateur déterministe, DONNEES.md §3)";
const MARCHE = "Insee Logement 2022, ADEME DPE, RTE registre, ADEME RGE (Licence Ouverte 2.0)";

export const INDICATEURS: readonly FicheIndicateur[] = [
  { code: "LEADS", libelle: "Leads", definition: "Dossiers créés dans le mois (cohorte de création).", formule: "nombre de dossiers dont la date de lead tombe dans le mois", grain: "mois de création × agence × canal", vue: "mart_funnel", unite: "nombre", sens: "volume", source: SIMULE },
  { code: "TX_RDV", libelle: "Taux de RDV", definition: "Part des leads de la cohorte ayant donné un rendez-vous tenu.", formule: "RDV tenus / leads de la cohorte", grain: "mois de création × agence × canal", vue: "mart_funnel", unite: "pct", sens: "haut", source: SIMULE },
  { code: "TX_DEVIS", libelle: "Taux de devis", definition: "Part des rendez-vous tenus ayant donné un devis.", formule: "devis émis / RDV tenus", grain: "mois de création × agence × canal", vue: "mart_funnel", unite: "pct", sens: "haut", source: SIMULE },
  { code: "TX_SIGN", libelle: "Taux de signature", definition: "Part des devis signés.", formule: "signatures / devis", grain: "mois de création × agence × canal", vue: "mart_funnel", unite: "pct", sens: "haut", source: SIMULE },
  { code: "TX_CONV", libelle: "Conversion lead vers vente", definition: "Part des leads devenus une vente nette d'annulation à 90 jours. Sur la Vue d'ensemble, la valeur affichée est celle de la dernière cohorte close à 90 jours (le mois de création est nommé sous le libellé).", formule: "signatures nettes d'annulation à 90 jours / leads", grain: "mois de création × agence × canal", vue: "mart_funnel", unite: "pct", sens: "haut", source: SIMULE, note: "Une cohorte de moins de 90 jours est affichée en grisé, « cohorte en cours »." },
  { code: "ATTENTE48", libelle: "Leads sans RDV planifié", definition: "Leads créés depuis plus de 48 heures sans rendez-vous planifié, à la journée publiée.", formule: "nombre de leads sans date de RDV planifié créés il y a plus de 48 h", grain: "mois de création × agence × canal", vue: "mart_funnel", unite: "nombre", sens: "bas", source: SIMULE },
  { code: "D_LEAD_RDV", libelle: "Délai lead vers RDV", definition: "Médiane du délai entre la création du lead et le rendez-vous tenu.", formule: "médiane (date RDV tenu - date lead)", grain: "mois de création × agence × canal", vue: "mart_funnel", unite: "jours", sens: "bas", source: SIMULE },
  { code: "CPL", libelle: "Coût par lead", definition: "Coût d'acquisition du canal rapporté aux leads du canal.", formule: "coût du canal / leads du canal", grain: "mois de création × agence × canal", vue: "mart_couts_acquisition", unite: "eur", sens: "bas", source: SIMULE },
  { code: "CPV", libelle: "Coût par vente", definition: "Coût d'acquisition du canal rapporté aux ventes nettes de la cohorte issue du canal.", formule: "coût du canal / ventes nettes de la cohorte du canal", grain: "mois de création × agence × canal", vue: "mart_couts_acquisition", unite: "eur", sens: "bas", source: SIMULE, note: "Commissions commerciales exclues (voir TX_CAC)." },
  { code: "TX_CAC", libelle: "Poids de l'acquisition", definition: "Coûts d'acquisition et commissions du mois rapportés au CA signé du mois.", formule: "(coûts d'acquisition + commissions) / CA signé", grain: "mois × agence", vue: "mart_kpi_mensuel", unite: "pct", sens: "bas", source: SIMULE, note: "15 à 20 % attendus dans la simulation." },
  { code: "VENTES", libelle: "Ventes signées", definition: "Signatures du mois hors dossiers annulés à date.", formule: "nombre de signatures du mois non annulées à la journée publiée", grain: "mois de signature × agence × produit", vue: "mart_ventes_produit", unite: "nombre", sens: "volume", source: SIMULE },
  { code: "TX_ANNUL", libelle: "Taux d'annulation", definition: "Part des signatures du mois annulées dans les 60 jours.", formule: "annulés à 60 jours / signatures (cohorte de signature)", grain: "mois de signature × agence × produit", vue: "mart_ventes_produit", unite: "pct", sens: "bas", source: SIMULE },
  { code: "CA_SIGNE", libelle: "CA signé HT", definition: "Somme des montants HT nets de remise des ventes signées dans le mois.", formule: "somme des montants HT nets de remise", grain: "mois de signature × agence × produit", vue: "mart_ventes_produit", unite: "eur", sens: "montant", source: SIMULE, note: "Base de l'objectif et de l'atterrissage." },
  { code: "CA_POSE", libelle: "CA posé HT", definition: "Somme des montants HT des poses réalisées dans le mois.", formule: "somme des montants HT des poses du mois", grain: "mois de pose × agence", vue: "mart_kpi_mensuel", unite: "eur", sens: "montant", source: SIMULE },
  { code: "PANIER", libelle: "Panier moyen", definition: "CA signé rapporté au nombre de ventes.", formule: "CA signé / ventes", grain: "mois de signature × agence × produit", vue: "mart_ventes_produit", unite: "eur", sens: "montant", source: SIMULE },
  { code: "REMISE", libelle: "Taux de remise", definition: "Remises accordées rapportées aux prix catalogue.", formule: "somme des remises / somme des prix catalogue", grain: "mois de signature × agence × produit", vue: "mart_ventes_produit", unite: "pct", sens: "bas", source: SIMULE, note: "Plus bas = mieux, sous réserve de conversion." },
  { code: "ELAST_REMISE", libelle: "Pente de la remise", definition: "Points de taux de signature des devis gagnés par point de remise, estimés par régression pondérée à effets fixes agence sur les couples agence × mois clos ; lecture économique : niveau de remise qui maximise la marge sous ce modèle linéaire.", formule: "pente b de taux_signature sur remise_moyenne (centrage par agence, poids = devis) ; niveau optimal r* = (m + r0) / 2 - s0 / (2 b) avec m la marge avant remise, s0 le taux de signature et r0 la remise moyenne", grain: "agence × mois de devis", vue: "mart_remises", unite: "pts", sens: "structure", source: SIMULE, note: "Démonstration de méthode sur des données simulées, avec intervalle à 95 % ; jamais une règle applicable à un réseau réel." },
  { code: "MIX", libelle: "Mix produit", definition: "Part de chaque produit dans le CA signé.", formule: "CA signé du produit / CA signé total", grain: "mois de signature × agence × produit", vue: "mart_ventes_produit", unite: "pct", sens: "structure", source: SIMULE },
  { code: "MARGE", libelle: "Marge brute", definition: "CA signé moins coût matériel moins coût de pose.", formule: "CA signé HT - coût matériel - coût de pose", grain: "mois de signature × agence × produit", vue: "mart_ventes_produit", unite: "eur", sens: "montant", source: SIMULE },
  { code: "TX_MARGE", libelle: "Taux de marge brute", definition: "Marge brute rapportée au CA signé.", formule: "marge brute / CA signé", grain: "mois de signature × agence × produit", vue: "mart_ventes_produit", unite: "pct", sens: "haut", source: SIMULE },
  { code: "MARGE_ACQ", libelle: "Marge après acquisition", definition: "Marge brute diminuée des coûts d'acquisition et des commissions commerciales du mois.", formule: "marge brute - coûts d'acquisition - commissions", grain: "mois × agence", vue: "mart_kpi_mensuel", unite: "eur", sens: "montant", source: SIMULE },
  { code: "RESULTAT", libelle: "Résultat d'agence", definition: "Marge après acquisition diminuée des charges d'agence (masse salariale hors commissions, structure, véhicules). Répond à « quelle agence gagne de l'argent ».", formule: "marge après acquisition - charges d'agence", grain: "mois × agence", vue: "mart_kpi_mensuel", unite: "eur", sens: "montant", source: SIMULE },
  { code: "PROD_COM", libelle: "Productivité commerciale", definition: "Ventes nettes par commercial actif.", formule: "ventes / commerciaux actifs", grain: "mois × agence", vue: "mart_kpi_mensuel", unite: "ratio", sens: "haut", source: SIMULE },
  { code: "ECART_CA", libelle: "Décomposition de l'écart de CA", definition: "Écart de chiffre d'affaires signé contre l'objectif ou N-1, décomposé en effet volume, effet mix, effet prix, effet remise ; le résiduel ne contient que les termes croisés.", formule: "volume = (V1 - V0) × PN0 ; mix = V1 × Σ (part1 - part0) × cat0 × (1 - tx0) ; prix = V1 × Σ part1 × (cat1 - cat0) × (1 - tx0) ; remise = V1 × Σ part1 × cat1 × (tx0 - tx1)", grain: "mois × agence × comparaison", vue: "mart_ecarts", unite: "eur", sens: "structure", source: SIMULE, note: "Résiduel contrôlé sous 3 % de l'écart total par test SQL ; nul par construction avec un taux de remise pondéré." },
  { code: "D_SIGN_POSE", libelle: "Délai signature vers pose", definition: "Médiane du délai entre la signature et la pose.", formule: "médiane (date pose - date signature)", grain: "mois de pose × agence × département", vue: "mart_delais", unite: "jours", sens: "bas", source: SIMULE, note: "Sur plusieurs mois, moyenne des médianes mensuelles pondérée par les poses (approximation)." },
  { code: "POSE_DELAI", libelle: "Poses dans les délais", definition: "Part des poses réalisées à moins de 60 jours de la signature.", formule: "poses à moins de 60 jours / poses", grain: "mois de pose × agence × département", vue: "mart_delais", unite: "pct", sens: "haut", source: SIMULE },
  { code: "CARNET", libelle: "Carnet de pose", definition: "Charge de pose restante, en jours ouvrés de l'équipe technique.", formule: "Σ (ventes signées non posées × durée de pose du produit) / (techniciens actifs × 0,8)", grain: "semaine × agence", vue: "mart_pose", unite: "jours", sens: "bas", source: SIMULE, note: "Alerte quand le carnet dépasse 1,3 fois la médiane des douze semaines précédentes de l'agence." },
  { code: "PROD_TECH", libelle: "Productivité pose", definition: "Jours-technicien posés rapportés à la capacité de la semaine.", formule: "jours-technicien posés / (techniciens actifs × 5)", grain: "semaine × agence", vue: "mart_pose", unite: "pct", sens: "haut", source: SIMULE },
  { code: "ENCAISSE", libelle: "Encaissé", definition: "Somme des encaissements du mois.", formule: "somme des montants HT encaissés dans le mois", grain: "mois d'encaissement × agence", vue: "mart_encaissement", unite: "eur", sens: "montant", source: SIMULE },
  { code: "D_ENCAISSE", libelle: "Délai pose vers encaissement", definition: "Médiane du délai entre la pose et l'encaissement.", formule: "médiane (date encaissement - date pose)", grain: "mois × agence", vue: "mart_encaissement", unite: "jours", sens: "bas", source: SIMULE },
  { code: "AIDES_ATT", libelle: "Aides en attente", definition: "Montant des aides simulées non versées à date, portées en mandat financier : l'installateur avance l'aide et la porte en créance.", formule: "Σ aides des dossiers posés non encore versées", grain: "agence, à date", vue: "mart_encaissement", unite: "eur", sens: "montant", source: SIMULE, note: "Hypothèse de simulation, montants à vérifier." },
  { code: "PIPE_POND", libelle: "Pipe pondéré", definition: "Devis en cours de moins de 90 jours, pondérés par le taux de signature observé pour leur tranche d'âge et nets du taux d'annulation.", formule: "Σ montant du devis × taux de signature de la tranche (0 à 30, 31 à 60, 61 à 90 jours, sur 12 mois) × (1 - taux d'annulation 6 mois)", grain: "année × agence", vue: "mart_forecast", unite: "eur", sens: "montant", source: SIMULE },
  { code: "ATTERR", libelle: "Atterrissage", definition: "CA signé attendu en fin d'année : réalisé à date, pipe pondéré sur les 45 prochains jours, puis run-rate trois mois saisonnalisé au-delà de ces 45 jours.", formule: "réalisé + pipe pondéré + projection × (mois restants - 1,5) / mois restants, avec projection = Σ mois restants (run-rate 3 mois × coefficient de saisonnalité) ; bornes = central ± σ mensuel × √(mois restants)", grain: "année × agence", vue: "mart_forecast", unite: "eur", sens: "prevision", source: SIMULE, note: "Intervalle à 68 %, σ estimé sur douze mois." },
  { code: "P_ATTEINTE", libelle: "Probabilité d'atteinte", definition: "Probabilité que l'atterrissage dépasse l'objectif annuel.", formule: "loi normale sur le run-rate (Φ((central - objectif) / (σ × √(mois restants)))), arrondie à 5 points", grain: "année × agence", vue: "mart_forecast", unite: "pct", sens: "prevision", source: SIMULE },
  { code: "QUALITE", libelle: "Score de qualité", definition: "Part pondérée des contrôles de cohérence réussis le matin.", formule: "100 × Σ poids des contrôles OK / Σ poids ; poids 3 pour un contrôle bloquant, 1 sinon", grain: "jour", vue: "mart_qualite", unite: "pct", sens: "haut", source: SIMULE },
  { code: "FLUX_QUALITE", libelle: "Anomalies apparues sur 30 jours", definition: "Lignes en anomalie dont le lead date des 30 jours précédant la journée contrôlée, tous contrôles confondus : le flux, là où le score mesure le stock des anomalies depuis l'intégration.", formule: "Σ sur les douze contrôles des lignes en anomalie avec date de lead > journée contrôlée - 30 jours (colonne flux_30j_jour, calculée par executer_controles)", grain: "jour", vue: "mart_qualite", unite: "nombre", sens: "bas", source: SIMULE, note: "Les contrôles sans date de lead (C10, C11, C12) ne comptent pas dans le flux." },
  { code: "INDICE", libelle: "Indice de potentiel territorial", definition: "Lecture du marché par département, en rangs centiles sur les 96 départements métropolitains. Ce n'est pas une recommandation d'implantation.", formule: "(0,4 × volume + 0,3 × intensité fioul et citerne + 0,3 × intensité F ou G) × (1 - 0,3 × frein / 100) × (1 - 0,3 × saturation / 100)", grain: "département (et commune dans le périmètre)", vue: "mart_marche_departement", unite: "nombre", sens: "haut", source: MARCHE, note: "volume = propriétaires occupants ; intensité fioul et citerne = part des résidences principales au fioul ou au gaz citerne ; intensité F ou G = part des maisons F ou G diagnostiquées ; frein = RGE PAC et PV pour 10 000 maisons ; saturation = installations solaires pour 1 000 maisons." },
];

export function ficheIndicateur(code: string): FicheIndicateur | undefined {
  return INDICATEURS.find((i) => i.code === code);
}

export const LIBELLE_SENS: Record<Sens, string> = {
  haut: "plus haut = mieux",
  bas: "plus bas = mieux",
  volume: "volume",
  montant: "montant",
  structure: "structure",
  prevision: "prévision, hypothèses affichées",
};
