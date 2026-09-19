-- 0031 : catalogue de l'analyste complété (IA.md §2) après la première évaluation réelle (21/24, 18 septembre au soir).
-- Trois échecs, trois causes : round() refuse une colonne double precision (médianes de délais, probabilité) ;
-- « le jour » dans mart_qualite n'est pas la journée publiée (les contrôles tournent le matin suivant) ;
-- rge_pac n'avait pas de commentaire, le modèle a cru que le nombre d'installateurs RGE n'existait pas.
-- Le catalogue transmis au modèle est généré depuis les commentaires SQL : chaque colonne des vues mart_ en reçoit un.

-- 1. round(double precision, integer) : PostgreSQL ne l'a que pour numeric. La surcharge rend naturel
--    « round(delai_signature_pose_median, 1) » ; les vues existantes ne sont pas concernées (fonctions liées à la création).
create or replace function buta.round(valeur double precision, decimales integer)
returns numeric
language sql
immutable
parallel safe
as $$ select pg_catalog.round(valeur::numeric, decimales) $$;
comment on function buta.round(double precision, integer) is 'Arrondi d''un double precision à n décimales (surcharge absente de PostgreSQL), pour les requêtes de l''analyste sur les médianes de délais et la probabilité d''atteinte.';

-- 2. Commentaires de colonnes (le catalogue de l'analyste les lit ; seules les colonnes encore muettes sont documentées ici).

-- mart_alertes
comment on column buta.mart_alertes.code is 'Règle déclenchée : CPV_LEADS_ACHETES, DOSSIERS_A_QUALIFIER, CARNET_POSE ou POSES_EN_RETARD.';
comment on column buta.mart_alertes.agence is 'Code de l''agence simulée concernée (jamais RESEAU : une alerte est toujours locale).';
comment on column buta.mart_alertes.nom_bassin is 'Nom du bassin de l''agence.';
comment on column buta.mart_alertes.gravite is 'alerte (à traiter) ou attention (à surveiller).';
comment on column buta.mart_alertes.valeur is 'Nombre qui fonde l''alerte : écart du coût par vente en pourcentage vs T1, dossiers à qualifier, jours ouvrés de carnet, poses en retard.';
comment on column buta.mart_alertes.texte is 'Phrase de l''alerte assemblée en SQL, bassin en tête.';
comment on column buta.mart_alertes.calcule_le is 'Journée publiée à laquelle l''alerte est calculée.';

-- mart_automatisation
comment on column buta.mart_automatisation.workflow is 'Code du workflow n8n (WF0 erreurs, WF1 journée simulée, WF2 contrôles qualité, WF3 revue hebdomadaire, WF5 santé).';
comment on column buta.mart_automatisation.debute_le is 'Début de l''exécution (horodatage avec fuseau).';
comment on column buta.mart_automatisation.fini_le is 'Fin de l''exécution ; null tant qu''elle court.';
comment on column buta.mart_automatisation.statut is 'Statut de l''exécution écrit par le workflow (succès ou erreur, tel qu''il l''a inscrit).';
comment on column buta.mart_automatisation.message is 'Message libre du workflow (résumé ou erreur).';
comment on column buta.mart_automatisation.lignes is 'Lignes traitées par l''exécution.';
comment on column buta.mart_automatisation.duree_s is 'Durée en secondes (fin moins début).';
comment on column buta.mart_automatisation.rang is '1 pour la dernière exécution du workflow, 2 pour la précédente, etc.';

-- mart_couts_acquisition
comment on column buta.mart_couts_acquisition.mois is 'Premier jour du mois de création du lead (cohorte), pas du mois de signature.';
comment on column buta.mart_couts_acquisition.agence is 'Code agence simulée, ou RESEAU pour le total.';
comment on column buta.mart_couts_acquisition.canal is 'Code du canal d''acquisition, ou TOUS pour le total de l''agence.';
comment on column buta.mart_couts_acquisition.leads is 'Leads créés dans le mois par ce canal.';
comment on column buta.mart_couts_acquisition.rdv_tenus is 'RDV tenus à date par ces leads.';
comment on column buta.mart_couts_acquisition.ventes is 'Signatures non annulées à date issues de ces leads.';
comment on column buta.mart_couts_acquisition.ca_signe is 'CA signé HT de ces ventes, en euros.';
comment on column buta.mart_couts_acquisition.taux_rdv is 'RDV tenus / leads, en pourcentage.';
comment on column buta.mart_couts_acquisition.taux_conversion is 'Ventes / leads de la cohorte, en pourcentage ; incomplet tant que la cohorte a moins de 90 jours.';
comment on column buta.mart_couts_acquisition.cout_par_vente_median_mois is 'Médiane du coût par vente des canaux détaillés de l''agence sur le mois, en euros.';
comment on column buta.mart_couts_acquisition.a_revoir is 'Vrai quand le coût par vente du canal dépasse 1,3 fois la médiane du mois.';

-- mart_delais
comment on column buta.mart_delais.mois is 'Premier jour du mois de pose.';
comment on column buta.mart_delais.agence is 'Code agence simulée, ou RESEAU pour le total.';
comment on column buta.mart_delais.departement is 'Code du département du dossier, TOUS pour le total, SUR_PLACE (16, 17, 33, 40, 59) ou A_DISTANCE (les autres) pour la comparaison par couverture.';
comment on column buta.mart_delais.couvert_a_distance is 'Vrai pour un département sans agence (couvert à distance).';
comment on column buta.mart_delais.poses is 'Poses réalisées dans le mois.';
comment on column buta.mart_delais.poses_dans_les_delais is 'Poses réalisées 60 jours au plus après la signature.';
comment on column buta.mart_delais.taux_poses_dans_les_delais is 'POSE_DELAI : poses dans les délais / poses, en pourcentage.';
comment on column buta.mart_delais.delai_signature_pose_median is 'D_SIGN_POSE : médiane en jours entre la signature et la pose (double precision : round(x::numeric, 1) pour arrondir).';
comment on column buta.mart_delais.delai_pose_encaissement_median is 'D_ENCAISSE : médiane en jours entre la pose et l''encaissement (double precision).';
comment on column buta.mart_delais.delai_lead_rdv_median is 'D_LEAD_RDV : médiane en jours entre le lead et le RDV tenu (double precision).';
comment on column buta.mart_delais.delai_devis_signature_median is 'Médiane en jours entre le devis et la signature (double precision).';

-- mart_ecarts
comment on column buta.mart_ecarts.mois is 'Premier jour du mois de signature.';
comment on column buta.mart_ecarts.agence is 'Code agence simulée, ou RESEAU pour le total.';
comment on column buta.mart_ecarts.comparaison is 'objectif (objectif du mois) ou n1 (même mois de l''année précédente) : une ligne par comparaison.';
comment on column buta.mart_ecarts.comparaison_disponible is 'Faux quand la comparaison n''existe pas (pas d''historique 2024 pour N-1 en 2025) : les effets sont alors null.';
comment on column buta.mart_ecarts.motif is 'Raison de l''indisponibilité de la comparaison, sinon null.';
comment on column buta.mart_ecarts.ventes is 'Ventes du mois (signatures non annulées).';
comment on column buta.mart_ecarts.ventes_comparaison is 'Ventes de la comparaison, au prorata des jours publiés pour le mois en cours.';
comment on column buta.mart_ecarts.ca_comparaison is 'CA de la comparaison en euros (objectif proratisé ou N-1 proratisé).';
comment on column buta.mart_ecarts.ecart_total is 'ECART_CA : CA réalisé moins CA de comparaison, en euros = volume + mix + prix + remise + résiduel.';
comment on column buta.mart_ecarts.residuel is 'Reste de la décomposition, nul par construction (vérifié).';
comment on column buta.mart_ecarts.taux_remise is 'Taux de remise réalisé du mois, en pourcentage.';
comment on column buta.mart_ecarts.taux_remise_comparaison is 'Taux de remise de la comparaison (cible de l''objectif ou N-1), en pourcentage.';

-- mart_encaissement
comment on column buta.mart_encaissement.mois is 'Premier jour du mois d''encaissement.';
comment on column buta.mart_encaissement.agence is 'Code agence simulée, ou RESEAU pour le total.';
comment on column buta.mart_encaissement.encaisse is 'ENCAISSE : montant HT encaissé dans le mois, en euros.';
comment on column buta.mart_encaissement.encaissements is 'Nombre de dossiers encaissés dans le mois.';
comment on column buta.mart_encaissement.delai_pose_encaissement_median is 'D_ENCAISSE : médiane en jours entre la pose et l''encaissement des dossiers encaissés dans le mois (double precision).';
comment on column buta.mart_encaissement.en_attente_encaissement is 'Mois courant seulement : montant HT posé et non encaissé à date, en euros ; null les autres mois.';
comment on column buta.mart_encaissement.retards_encaissement is 'Mois courant seulement : dossiers posés depuis plus de 30 jours et non encaissés.';
comment on column buta.mart_encaissement.aides_en_attente is 'AIDES_ATT, mois courant seulement : montant des aides simulées (mandat financier) non encore versées, en euros.';

-- mart_forecast
comment on column buta.mart_forecast.agence is 'Code agence simulée, ou RESEAU pour le total.';
comment on column buta.mart_forecast.annee is 'Année de l''atterrissage (2025 close, 2026 en cours).';
comment on column buta.mart_forecast.realise_a_date is 'CA signé HT de l''année à la journée publiée, en euros.';
comment on column buta.mart_forecast.objectif_annuel is 'Somme des objectifs mensuels de CA signé de l''année, en euros.';
comment on column buta.mart_forecast.pipe_pondere is 'PIPE_POND : devis en cours de moins de 90 jours x taux de signature observé selon leur ancienneté x (1 - annulation à six mois), en euros.';
comment on column buta.mart_forecast.devis_en_cours is 'Devis de moins de 90 jours sans signature à la journée publiée.';
comment on column buta.mart_forecast.montant_devis_en_cours is 'Montant de ces devis, en euros.';
comment on column buta.mart_forecast.run_rate_3m is 'CA signé mensuel moyen des trois derniers mois complets, en euros.';
comment on column buta.mart_forecast.sigma_mensuel is 'Écart-type du CA signé mensuel sur les douze derniers mois complets, en euros.';
comment on column buta.mart_forecast.mois_restants is 'Mois de l''année après celui de la journée publiée ; 0 pour une année close.';
comment on column buta.mart_forecast.atterrissage_central is 'ATTERR : réalisé à date + pipe pondéré + run-rate saisonnalisé au-delà des 45 jours couverts par le pipe, en euros.';
comment on column buta.mart_forecast.atterrissage_bas is 'Atterrissage central moins sigma mensuel x racine des mois restants, en euros.';
comment on column buta.mart_forecast.atterrissage_haut is 'Atterrissage central plus sigma mensuel x racine des mois restants, en euros.';
comment on column buta.mart_forecast.ecart_atterrissage_pct is '(atterrissage central - objectif annuel) / objectif annuel, en pourcentage.';
comment on column buta.mart_forecast.taux_signature_0_30 is 'Part des devis signés dans les 30 jours, en pourcentage, observée sur les devis de 90 à 455 jours.';
comment on column buta.mart_forecast.taux_signature_31_60 is 'Part des devis encore ouverts à 30 jours signés entre 31 et 60 jours, en pourcentage.';
comment on column buta.mart_forecast.taux_signature_61_90 is 'Part des devis encore ouverts à 60 jours signés entre 61 et 90 jours, en pourcentage.';
comment on column buta.mart_forecast.taux_annulation_6m is 'Part des signatures annulées dans les six mois, en pourcentage.';

-- mart_fraicheur
comment on column buta.mart_fraicheur.source is 'journee_simulee (activité simulée), insee_logement_2022, ademe_rge, ademe_dpe, rte_registre, contours_geo.';
comment on column buta.mart_fraicheur.date_reference is 'Date de référence des données : journée publiée pour journee_simulee, millésime ou date d''extraction pour une source de marché.';
comment on column buta.mart_fraicheur.disponible_jusqu_au is 'journee_simulee seulement : dernière journée déjà publiée d''avance dans la base.';
comment on column buta.mart_fraicheur.ingere_le is 'Horodatage de la dernière intégration de la source.';
comment on column buta.mart_fraicheur.prochaine is 'Prochaine mise à jour attendue.';

-- mart_funnel
comment on column buta.mart_funnel.mois is 'Premier jour du mois de création du lead (cohorte) : les étapes suivantes peuvent tomber dans les mois d''après.';
comment on column buta.mart_funnel.agence is 'Code agence simulée, ou RESEAU pour le total.';
comment on column buta.mart_funnel.canal is 'Code du canal d''acquisition, ou TOUS pour le total.';
comment on column buta.mart_funnel.leads is 'Leads créés dans le mois.';
comment on column buta.mart_funnel.rdv_planifies is 'Leads avec un RDV planifié à date.';
comment on column buta.mart_funnel.rdv_tenus is 'Leads avec un RDV tenu à date.';
comment on column buta.mart_funnel.devis is 'Leads avec un devis émis à date.';
comment on column buta.mart_funnel.signatures is 'Leads signés à date, annulations comprises.';
comment on column buta.mart_funnel.signatures_nettes is 'Signatures non annulées dans les 90 jours.';
comment on column buta.mart_funnel.poses is 'Leads posés à date.';
comment on column buta.mart_funnel.encaissements is 'Leads encaissés à date.';
comment on column buta.mart_funnel.montant_devis is 'Somme des montants des devis émis, en euros.';
comment on column buta.mart_funnel.ca_signe is 'CA signé HT non annulé de la cohorte, en euros.';
comment on column buta.mart_funnel.cohorte_mature is 'Vrai quand la fin du mois a plus de 90 jours : la conversion de la cohorte est stabilisée, sinon elle est encore incomplète.';

-- mart_ia_usage
comment on column buta.mart_ia_usage.jour is 'Jour de la consommation.';
comment on column buta.mart_ia_usage.fonction is 'analyste ou expliquer-ecart.';
comment on column buta.mart_ia_usage.appels is 'Appels du jour.';
comment on column buta.mart_ia_usage.tokens_entree is 'Jetons d''entrée consommés.';
comment on column buta.mart_ia_usage.tokens_sortie is 'Jetons de sortie consommés.';
comment on column buta.mart_ia_usage.cout_eur is 'Coût estimé du jour, en euros.';

-- mart_kpi_mensuel (colonnes restées muettes)
comment on column buta.mart_kpi_mensuel.leads is 'Leads créés dans le mois.';
comment on column buta.mart_kpi_mensuel.poses is 'Poses réalisées dans le mois.';
comment on column buta.mart_kpi_mensuel.signatures_brutes is 'Signatures du mois, annulées comprises.';
comment on column buta.mart_kpi_mensuel.annulees_60j is 'Signatures du mois annulées dans les 60 jours.';
comment on column buta.mart_kpi_mensuel.cohorte_annulation_mature is 'Vrai quand toutes les signatures du mois ont 60 jours : taux_annulation comparable, sinon tronqué.';
comment on column buta.mart_kpi_mensuel.couts_acquisition is 'Coûts des canaux d''acquisition du mois, en euros, au prorata des jours publiés pour le mois en cours.';
comment on column buta.mart_kpi_mensuel.commissions is 'Commissions commerciales des ventes du mois, en euros.';
comment on column buta.mart_kpi_mensuel.charges is 'Charges fixes d''agence du mois (salaires commerciaux, structure, véhicules), en euros, au prorata pour le mois en cours.';
comment on column buta.mart_kpi_mensuel.commerciaux_actifs is 'Commerciaux actifs dans le mois (codes, jamais de nom).';
comment on column buta.mart_kpi_mensuel.techniciens_actifs is 'Techniciens de pose actifs dans le mois.';
comment on column buta.mart_kpi_mensuel.objectif_ventes is 'Objectif de ventes du mois.';
comment on column buta.mart_kpi_mensuel.objectif_ca is 'Objectif de CA signé du mois complet, en euros ; multiplier par prorata pour comparer le mois en cours.';
comment on column buta.mart_kpi_mensuel.jours_publies is 'Jours du mois publiés à la journée publiée.';
comment on column buta.mart_kpi_mensuel.jours_mois is 'Jours du mois.';

-- mart_marche_commune et mart_marche_departement (mêmes colonnes de marché)
comment on column buta.mart_marche_commune.code_insee is 'Code Insee de la commune.';
comment on column buta.mart_marche_commune.nom is 'Nom de la commune.';
comment on column buta.mart_marche_commune.departement is 'Code du département.';
comment on column buta.mart_marche_commune.latitude is 'Latitude du centre de la commune.';
comment on column buta.mart_marche_commune.longitude is 'Longitude du centre de la commune.';
comment on column buta.mart_marche_departement.departement is 'Code du département (deux caractères, 2A et 2B pour la Corse).';
comment on column buta.mart_marche_departement.nom is 'Nom du département.';
comment on column buta.mart_marche_departement.region is 'Région du département.';
comment on column buta.mart_marche_departement.perimetre is 'Vrai pour les onze départements du réseau simulé (16, 17, 79, 85, 24, 33, 47, 32, 40, 64, 59).';
comment on column buta.mart_marche_departement.agences_simulees is 'Codes des agences simulées qui couvrent le département, la principale en tête ; null hors périmètre.';

do $$
declare
  vue text;
begin
  foreach vue in array array['mart_marche_departement', 'mart_marche_commune'] loop
    execute format('comment on column buta.%I.rp is %L', vue, 'Résidences principales (Insee, Logement 2022).');
    execute format('comment on column buta.%I.maisons is %L', vue, 'Résidences principales en maison (Insee 2022).');
    execute format('comment on column buta.%I.proprietaires is %L', vue, 'Résidences principales occupées par leur propriétaire (Insee 2022).');
    execute format('comment on column buta.%I.fioul is %L', vue, 'Résidences principales chauffées au fioul, maisons et appartements (Insee 2022).');
    execute format('comment on column buta.%I.gaz_citerne is %L', vue, 'Résidences principales chauffées au gaz en citerne ou en bouteille (Insee 2022).');
    execute format('comment on column buta.%I.gaz_ville is %L', vue, 'Résidences principales chauffées au gaz de ville (Insee 2022).');
    execute format('comment on column buta.%I.electricite is %L', vue, 'Résidences principales chauffées à l''électricité (Insee 2022).');
    execute format('comment on column buta.%I.maisons_fg is %L', vue, 'Maisons en étiquette DPE F ou G (ADEME, DPE logements existants).');
    execute format('comment on column buta.%I.maisons_diag is %L', vue, 'Maisons avec un DPE (dénominateur de part_maisons_fg).');
    execute format('comment on column buta.%I.maisons_fioul_dpe is %L', vue, 'Maisons dont le DPE indique un chauffage au fioul (ADEME).');
    execute format('comment on column buta.%I.maisons_gpl_dpe is %L', vue, 'Maisons dont le DPE indique un chauffage au GPL, propane ou butane (ADEME).');
    execute format('comment on column buta.%I.solaire_nb is %L', vue, 'Installations solaires photovoltaïques raccordées (RTE, registre des installations).');
    execute format('comment on column buta.%I.solaire_kw is %L', vue, 'Puissance solaire raccordée, en kW (RTE).');
    execute format('comment on column buta.%I.solaire_nb_36 is %L', vue, 'Installations solaires de 36 kW ou moins (résidentiel et petit tertiaire, RTE).');
    execute format('comment on column buta.%I.rge_pac is %L', vue, 'Nombre d''installateurs qualifiés RGE pompe à chaleur (ADEME, liste des entreprises RGE) : la concurrence installée.');
    execute format('comment on column buta.%I.rge_pv is %L', vue, 'Nombre d''installateurs qualifiés RGE photovoltaïque (ADEME).');
    execute format('comment on column buta.%I.rge_cet is %L', vue, 'Nombre d''installateurs qualifiés RGE chauffe-eau thermodynamique (ADEME).');
    execute format('comment on column buta.%I.part_fioul_citerne is %L', vue, '(fioul + gaz citerne) / résidences principales, en pourcentage : le parc à convertir.');
    execute format('comment on column buta.%I.part_maisons_fg is %L', vue, 'Maisons F ou G / maisons diagnostiquées, en pourcentage.');
    execute format('comment on column buta.%I.solaire_pour_1000_maisons is %L', vue, 'Installations solaires pour 1 000 maisons : saturation du solaire.');
    execute format('comment on column buta.%I.rge_pour_10000_maisons is %L', vue, 'Installateurs RGE (pompe à chaleur + photovoltaïque) pour 10 000 maisons : frein concurrentiel.');
    execute format('comment on column buta.%I.c_volume is %L', vue, 'Composante volume de l''indice : rang centile (0 à 100) des propriétaires occupants.');
    execute format('comment on column buta.%I.c_intensite_fioul is %L', vue, 'Composante fioul et citerne : rang centile de part_fioul_citerne.');
    execute format('comment on column buta.%I.c_intensite_fg is %L', vue, 'Composante passoires : rang centile de part_maisons_fg.');
    execute format('comment on column buta.%I.c_frein is %L', vue, 'Composante frein : rang centile de rge_pour_10000_maisons (plus il est haut, plus la concurrence est dense).');
    execute format('comment on column buta.%I.c_saturation is %L', vue, 'Composante saturation : rang centile de solaire_pour_1000_maisons.');
    execute format('comment on column buta.%I.indice is %L', vue, 'INDICE de potentiel = (0,4 x volume + 0,3 x fioul + 0,3 x F ou G) x (1 - 0,3 x frein / 100) x (1 - 0,3 x saturation / 100), de 0 à 100 ; un classement, pas une recommandation.');
    execute format('comment on column buta.%I.date_reference is %L', vue, 'Dates de référence de chaque source (JSON : insee, dpe, rte, rge).');
  end loop;
end $$;

-- mart_objectif_mensuel
comment on column buta.mart_objectif_mensuel.mois is 'Premier jour du mois.';
comment on column buta.mart_objectif_mensuel.agence is 'Code agence simulée, ou RESEAU pour le total.';
comment on column buta.mart_objectif_mensuel.objectif_ventes is 'Objectif de ventes du mois.';
comment on column buta.mart_objectif_mensuel.objectif_ca is 'Objectif de CA signé HT du mois, en euros.';

-- mart_plans_action
comment on column buta.mart_plans_action.id is 'Identifiant du plan.';
comment on column buta.mart_plans_action.agence is 'Code agence simulée, ou RESEAU pour un plan réseau.';
comment on column buta.mart_plans_action.nom_bassin is 'Nom du bassin de l''agence ; null pour le réseau.';
comment on column buta.mart_plans_action.levier is 'Action décidée, en une phrase.';
comment on column buta.mart_plans_action.proprietaire_code is 'Code du propriétaire du plan (jamais de nom).';
comment on column buta.mart_plans_action.gain_attendu is 'Gain de marge attendu en euros, déclaré ; 0 quand le gain n''est pas chiffrable.';
comment on column buta.mart_plans_action.statut is 'planifié, en cours ou terminé.';
comment on column buta.mart_plans_action.echeance is 'Date d''échéance du plan.';
comment on column buta.mart_plans_action.avancement is 'Avancement déclaré, en pourcentage.';
comment on column buta.mart_plans_action.indicateur_code is 'Code de l''indicateur suivi (CPV, CARNET, QUALITE, TX_MARGE, ATTENTE48, D_SIGN_POSE, etc.).';

-- mart_pose
comment on column buta.mart_pose.semaine is 'Lundi de la semaine ; la vue contient aussi les semaines à venir (poses planifiées) : la dernière semaine réalisée est la dernière semaine inférieure ou égale à la journée publiée.';
comment on column buta.mart_pose.agence is 'Code agence simulée, ou RESEAU pour le total.';
comment on column buta.mart_pose.techniciens_actifs is 'Techniciens de pose actifs dans la semaine.';
comment on column buta.mart_pose.capacite_jt_semaine is 'Capacité de pose de la semaine, en jours-technicien.';
comment on column buta.mart_pose.poses is 'Poses réalisées dans la semaine.';
comment on column buta.mart_pose.jt_poses is 'Jours-technicien consommés par les poses réalisées.';
comment on column buta.mart_pose.ca_pose is 'CA_POSE : montant HT des poses de la semaine, en euros.';
comment on column buta.mart_pose.productivite_pose is 'PROD_TECH : jours-technicien posés / capacité, en pourcentage.';
comment on column buta.mart_pose.poses_planifiees is 'Poses planifiées dans la semaine (après la journée publiée).';
comment on column buta.mart_pose.jt_planifies is 'Jours-technicien planifiés.';
comment on column buta.mart_pose.charge_planifiee_pct is 'Jours-technicien planifiés / capacité, en pourcentage ; au-delà de 100, la semaine est en surcharge.';
comment on column buta.mart_pose.carnet_jt is 'Carnet de pose en fin de semaine : jours-technicien des ventes signées non posées.';
comment on column buta.mart_pose.dossiers_a_poser is 'Ventes signées non posées en fin de semaine.';
comment on column buta.mart_pose.poses_en_retard is 'Ventes non posées signées depuis plus de 60 jours (sur place) ou 90 jours (à distance).';

-- mart_qualite
comment on column buta.mart_qualite.jour is 'Journée contrôlée ; les contrôles tournent le matin suivant, donc le dernier jour disponible peut précéder la journée publiée : filtrer sur (select max(jour) from mart_qualite) pour « le jour ».';
comment on column buta.mart_qualite.controle is 'Code du contrôle, C01 à C12.';
comment on column buta.mart_qualite.ordre is 'Ordre d''affichage du contrôle.';
comment on column buta.mart_qualite.libelle is 'Libellé du contrôle.';
comment on column buta.mart_qualite.regle is 'Règle vérifiée, en une phrase.';
comment on column buta.mart_qualite.bloquant is 'Vrai pour un contrôle bloquant (poids 3 dans le score), faux sinon (poids 1).';
comment on column buta.mart_qualite.statut is 'ok, alerte ou ko : un contrôle bloquant en échec est ko, un contrôle non bloquant en échec est alerte.';
comment on column buta.mart_qualite.nb_lignes is 'Lignes concernées par le contrôle ce jour-là.';
comment on column buta.mart_qualite.echantillon is 'Échantillon des lignes concernées (JSON).';
comment on column buta.mart_qualite.score_jour is 'QUALITE : score du jour, 100 x poids des contrôles ok / poids total, identique sur les douze lignes du jour.';
comment on column buta.mart_qualite.tendance is 'Variation du nombre de lignes par rapport au jour précédent.';

-- mart_reconciliation_libelles
comment on column buta.mart_reconciliation_libelles.agence is 'Code de l''agence simulée.';
comment on column buta.mart_reconciliation_libelles.libelle_source is 'Libellé produit reçu du système source.';
comment on column buta.mart_reconciliation_libelles.produit_code is 'Code du produit résolu dans le référentiel.';
comment on column buta.mart_reconciliation_libelles.libelle_referentiel is 'Libellé du référentiel.';
comment on column buta.mart_reconciliation_libelles.dossiers is 'Dossiers publiés portant ce libellé source.';
comment on column buta.mart_reconciliation_libelles.premier_lead is 'Date du premier lead concerné.';
comment on column buta.mart_reconciliation_libelles.dernier_lead is 'Date du dernier lead concerné.';

-- mart_remises (colonnes restées muettes)
comment on column buta.mart_remises.periode is 'Premier jour de la période (mois, trimestre ou année selon grain).';
comment on column buta.mart_remises.agence is 'Code agence simulée, ou RESEAU pour le total.';
comment on column buta.mart_remises.devis is 'Devis émis dans la période.';
comment on column buta.mart_remises.signatures is 'Signatures obtenues à date sur ces devis.';
comment on column buta.mart_remises.remise_moyenne is 'REMISE : taux de remise moyen des devis, en pourcentage.';
comment on column buta.mart_remises.remise_p10 is 'Dixième centile du taux de remise, en pourcentage.';
comment on column buta.mart_remises.remise_q1 is 'Premier quartile du taux de remise, en pourcentage.';
comment on column buta.mart_remises.remise_mediane is 'Médiane du taux de remise, en pourcentage.';
comment on column buta.mart_remises.remise_q3 is 'Troisième quartile du taux de remise, en pourcentage.';
comment on column buta.mart_remises.remise_p90 is 'Quatre-vingt-dixième centile du taux de remise, en pourcentage.';
comment on column buta.mart_remises.prix_catalogue_moyen is 'Prix catalogue moyen des devis, en euros.';

-- mart_revue_hebdo
comment on column buta.mart_revue_hebdo.semaine is 'Lundi de la semaine revue.';
comment on column buta.mart_revue_hebdo.faits is 'Faits de la semaine calculés en SQL (JSON) : la matière de la revue.';
comment on column buta.mart_revue_hebdo.texte is 'Texte de la revue (faits, lecture, décisions proposées).';
comment on column buta.mart_revue_hebdo.modele is 'Modèle qui a rédigé, ou « règles » quand la revue est écrite par règles.';
comment on column buta.mart_revue_hebdo.cout is 'Coût de la rédaction, en euros.';
comment on column buta.mart_revue_hebdo.publie_le is 'Horodatage de publication.';
comment on column buta.mart_revue_hebdo.libelle is 'Libellé de la semaine (S38 2026).';

-- mart_ventes_produit (colonnes restées muettes)
comment on column buta.mart_ventes_produit.mois is 'Premier jour du mois de signature.';
comment on column buta.mart_ventes_produit.agence is 'Code agence simulée, ou RESEAU pour le total.';
comment on column buta.mart_ventes_produit.produit is 'Code produit, ou TOUS pour le total.';
comment on column buta.mart_ventes_produit.ventes is 'VENTES : signatures du mois hors annulées à date.';
comment on column buta.mart_ventes_produit.signatures_brutes is 'Signatures du mois, annulées comprises.';
comment on column buta.mart_ventes_produit.annulees_60j is 'Signatures du mois annulées dans les 60 jours.';
comment on column buta.mart_ventes_produit.ca_signe is 'CA_SIGNE : montants HT nets de remise des ventes, en euros.';
comment on column buta.mart_ventes_produit.marge_brute is 'MARGE : CA signé moins coût matériel moins coût de pose, en euros.';
comment on column buta.mart_ventes_produit.taux_marge is 'TX_MARGE : marge brute / CA signé, en pourcentage.';
comment on column buta.mart_ventes_produit.panier_moyen is 'PANIER : CA signé / ventes, en euros.';
comment on column buta.mart_ventes_produit.prix_catalogue_moyen is 'Prix catalogue moyen des ventes, en euros.';
comment on column buta.mart_ventes_produit.taux_remise is 'REMISE : remises / prix catalogue, en pourcentage.';
comment on column buta.mart_ventes_produit.taux_annulation is 'TX_ANNUL : annulées dans les 60 jours / signatures brutes, en pourcentage.';
comment on column buta.mart_ventes_produit.signatures_a_distance is 'Signatures des départements sans agence.';
comment on column buta.mart_ventes_produit.taux_annulation_sur_place is 'Taux d''annulation des signatures des départements avec agence (16, 17, 33, 40, 59), en pourcentage.';
