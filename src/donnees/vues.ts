import { z } from "zod";

/**
 * Référentiel des vues mart_ (DONNEES.md §4.5) : un schéma Zod par vue, validé à la réception.
 * Les colonnes numériques arrivent de PostgREST en nombres ; les dates en AAAA-MM-JJ.
 * passthrough : une colonne ajoutée côté SQL ne casse pas le front ; une colonne attendue absente, si.
 */
const nombre = z.number();
const nombreOuNul = z.number().nullable();
const date = z.string();

export const VUES = {
  mart_kpi_mensuel: z
    .object({
      mois: date, agence: z.string(), leads: nombre, ventes: nombre, ca_signe: nombre, ca_pose: nombre, encaisse: nombre,
      poses: nombre, marge_brute: nombre, taux_marge: nombreOuNul, panier_moyen: nombreOuNul, taux_remise: nombreOuNul,
      signatures_brutes: nombre, annulees_60j: nombre, cohorte_annulation_mature: z.boolean(), taux_annulation: nombreOuNul,
      delai_pose_median: nombreOuNul, couts_acquisition: nombre, commissions: nombre, marge_apres_acquisition: nombre,
      charges: nombre, resultat: nombre, taux_cac: nombreOuNul, commerciaux_actifs: nombre, techniciens_actifs: nombre,
      productivite_commerciale: nombreOuNul, objectif_ventes: nombre, objectif_ca: nombre, ecart_objectif_pct: nombreOuNul,
    })
    .passthrough(),
  mart_funnel: z
    .object({
      mois: date, agence: z.string(), canal: z.string(), leads: nombre, rdv_planifies: nombre, rdv_tenus: nombre, devis: nombre,
      signatures: nombre, signatures_nettes: nombre, poses: nombre, encaissements: nombre, montant_devis: nombreOuNul,
      ca_signe: nombreOuNul, delai_lead_rdv_median: nombreOuNul, sans_rdv_48h: nombre, taux_rdv: nombreOuNul,
      taux_devis: nombreOuNul, taux_signature: nombreOuNul, taux_conversion: nombreOuNul, cohorte_mature: z.boolean(),
    })
    .passthrough(),
  mart_ventes_produit: z
    .object({
      mois: date, agence: z.string(), produit: z.string(), ventes: nombre, signatures_brutes: nombre, annulees_60j: nombre,
      ca_signe: nombreOuNul, marge_brute: nombreOuNul, taux_marge: nombreOuNul, panier_moyen: nombreOuNul,
      prix_catalogue_moyen: nombreOuNul, taux_remise: nombreOuNul, taux_annulation: nombreOuNul,
      signatures_a_distance: nombre, taux_annulation_a_distance: nombreOuNul, taux_annulation_sur_place: nombreOuNul,
    })
    .passthrough(),
  mart_ecarts: z
    .object({
      mois: date, agence: z.string(), comparaison: z.enum(["objectif", "n1"]), comparaison_disponible: z.boolean(),
      motif: z.string().nullable(), ventes: nombre, ventes_comparaison: nombre, ca_realise: nombre, ca_comparaison: nombre,
      ecart_total: nombre, effet_volume: nombre, effet_mix: nombre, effet_prix: nombre, effet_remise: nombre, residuel: nombre,
      taux_remise: nombreOuNul, taux_remise_comparaison: nombreOuNul,
    })
    .passthrough(),
  mart_couts_acquisition: z
    .object({
      mois: date, agence: z.string(), canal: z.string(), leads: nombre, rdv_tenus: nombre, ventes: nombre, ca_signe: nombre,
      cout: nombre, delai_lead_rdv_median: nombreOuNul, cout_par_lead: nombreOuNul, cout_par_vente: nombreOuNul,
      taux_rdv: nombreOuNul, taux_conversion: nombreOuNul, cout_par_vente_median_mois: nombreOuNul, a_revoir: z.boolean().nullable(),
    })
    .passthrough(),
  mart_delais: z
    .object({
      mois: date, agence: z.string(), departement: z.string(), couvert_a_distance: z.boolean().nullable(), poses: nombre,
      poses_dans_les_delais: nombre, taux_poses_dans_les_delais: nombreOuNul, delai_signature_pose_median: nombreOuNul,
      delai_pose_encaissement_median: nombreOuNul, delai_lead_rdv_median: nombreOuNul, delai_devis_signature_median: nombreOuNul,
    })
    .passthrough(),
  mart_pose: z
    .object({
      semaine: date, agence: z.string(), techniciens_actifs: nombre, capacite_jt_semaine: nombre, poses: nombre, jt_poses: nombre,
      ca_pose: nombre, productivite_pose: nombreOuNul, poses_planifiees: nombre, jt_planifies: nombre, charge_planifiee_pct: nombreOuNul,
      carnet_jt: nombreOuNul, dossiers_a_poser: nombreOuNul, poses_en_retard: nombreOuNul, carnet_jours_ouvres: nombreOuNul,
    })
    .passthrough(),
  mart_encaissement: z
    .object({
      mois: date, agence: z.string(), encaisse: nombre, encaissements: nombre, delai_pose_encaissement_median: nombreOuNul,
      en_attente_encaissement: nombreOuNul, retards_encaissement: nombreOuNul, aides_en_attente: nombreOuNul,
    })
    .passthrough(),
  mart_forecast: z
    .object({
      agence: z.string(), annee: nombre, realise_a_date: nombre, objectif_annuel: nombre, pipe_pondere: nombre, devis_en_cours: nombre,
      montant_devis_en_cours: nombre, run_rate_3m: nombre, sigma_mensuel: nombre, mois_restants: nombre,
      atterrissage_central: nombreOuNul, atterrissage_bas: nombreOuNul, atterrissage_haut: nombreOuNul,
      probabilite_atteinte: nombreOuNul, ecart_atterrissage_pct: nombreOuNul,
    })
    .passthrough(),
  mart_qualite: z
    .object({
      jour: date, controle: z.string(), ordre: nombre, libelle: z.string(), regle: z.string(), bloquant: z.boolean(),
      statut: z.enum(["ok", "alerte", "ko"]), nb_lignes: nombre, echantillon: z.unknown(), score_jour: nombre, tendance: nombreOuNul,
    })
    .passthrough(),
  mart_marche_departement: z
    .object({
      departement: z.string(), nom: z.string(), region: z.string(), perimetre: z.boolean(), agences_simulees: z.string().nullable(),
      rp: nombreOuNul, maisons: nombreOuNul, proprietaires: nombreOuNul, fioul: nombreOuNul, gaz_citerne: nombreOuNul,
      gaz_ville: nombreOuNul, electricite: nombreOuNul, maisons_fg: nombreOuNul, maisons_diag: nombreOuNul,
      solaire_nb: nombreOuNul, solaire_kw: nombreOuNul, rge_pac: nombreOuNul, rge_pv: nombreOuNul, rge_cet: nombreOuNul,
      part_fioul_citerne: nombreOuNul, part_maisons_fg: nombreOuNul, solaire_pour_1000_maisons: nombreOuNul,
      rge_pour_10000_maisons: nombreOuNul, c_volume: nombreOuNul, c_intensite_fioul: nombreOuNul, c_intensite_fg: nombreOuNul,
      c_frein: nombreOuNul, c_saturation: nombreOuNul, indice: nombreOuNul, date_reference: z.unknown(),
    })
    .passthrough(),
  mart_marche_commune: z
    .object({
      code_insee: z.string(), nom: z.string().nullable(), departement: z.string(), latitude: nombreOuNul, longitude: nombreOuNul,
      rp: nombreOuNul, maisons: nombreOuNul, proprietaires: nombreOuNul, fioul: nombreOuNul, gaz_citerne: nombreOuNul,
      maisons_fg: nombreOuNul, maisons_diag: nombreOuNul, solaire_nb: nombreOuNul, rge_pac: nombreOuNul, rge_pv: nombreOuNul,
      part_fioul_citerne: nombreOuNul, part_maisons_fg: nombreOuNul, solaire_pour_1000_maisons: nombreOuNul,
      rge_pour_10000_maisons: nombreOuNul, indice: nombreOuNul,
    })
    .passthrough(),
  mart_automatisation: z
    .object({
      id: nombre, workflow: z.string(), debute_le: z.string(), fini_le: z.string().nullable(), statut: z.string(),
      message: z.string().nullable(), lignes: nombreOuNul, duree_s: nombreOuNul, rang: nombre,
    })
    .passthrough(),
  mart_alertes: z
    .object({
      code: z.string(), agence: z.string(), nom_bassin: z.string(), gravite: z.string(), valeur: nombreOuNul, texte: z.string(),
      calcule_le: date,
    })
    .passthrough(),
  mart_plans_action: z
    .object({
      id: nombre, agence: z.string().nullable(), nom_bassin: z.string().nullable(), levier: z.string(), proprietaire_code: z.string(),
      gain_attendu: nombre, statut: z.string(), echeance: date, avancement: nombre, indicateur_code: z.string(),
    })
    .passthrough(),
  mart_revue_hebdo: z
    .object({
      semaine: date, faits: z.unknown(), texte: z.string().nullable(), modele: z.string().nullable(), cout: nombreOuNul,
      publie_le: z.string().nullable(), libelle: z.string(),
    })
    .passthrough(),
} as const;

export type NomVue = keyof typeof VUES;
export type Ligne<N extends NomVue> = z.infer<(typeof VUES)[N]>;
