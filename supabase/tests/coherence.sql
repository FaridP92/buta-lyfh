-- Coherence du jeu simule et des vues (VERIFICATION.md §2). Chaque requete renvoie (test, ok, ...).

-- Funnel monotone par cohorte de creation et par agence (controle 12, sur le jeu complet publie).
select 'funnel monotone par cohorte' as test, count(*) = 0 as ok, count(*) as cohortes_en_defaut from (
  select agence, date_trunc('month', date_lead) as mois,
    count(*) as leads, count(date_rdv) as rdv, count(date_devis) as devis, count(date_signature) as signatures, count(date_pose) as poses
  from buta.fait_dossier where publie group by 1, 2) t
where not (leads >= rdv and rdv >= devis and devis >= signatures and signatures >= poses);

-- Totaux : les vues et la table racontent la meme chose (ventes et CA signe du reseau, mois complets).
with table_brute as (
  select count(*) as ventes, sum(montant_ht) as ca from buta.dossier_a_date
  where date_signature is not null and date_annulation is null and date_signature < date_trunc('month', buta.journee_publiee())),
vue as (
  select sum(ventes) as ventes, sum(ca_signe) as ca from buta.mart_kpi_mensuel
  where agence = 'RESEAU' and mois < date_trunc('month', buta.journee_publiee())),
vue_produit as (
  select sum(ventes) as ventes, sum(ca_signe) as ca from buta.mart_ventes_produit
  where agence = 'RESEAU' and produit = 'TOUS' and mois < date_trunc('month', buta.journee_publiee()))
select 'totaux ventes et CA : table = mart_kpi_mensuel = mart_ventes_produit' as test,
  table_brute.ventes = vue.ventes and table_brute.ventes = vue_produit.ventes and table_brute.ca = vue.ca and table_brute.ca = vue_produit.ca as ok,
  table_brute.ventes as ventes_table, vue.ventes as ventes_kpi, vue_produit.ventes as ventes_produit,
  table_brute.ca as ca_table, vue.ca as ca_kpi, vue_produit.ca as ca_produit
from table_brute, vue, vue_produit;

-- Somme des agences = RESEAU dans mart_kpi_mensuel.
select 'somme des agences = RESEAU (mart_kpi_mensuel)' as test, count(*) = 0 as ok, count(*) as mois_en_defaut from (
  select mois, sum(ca_signe) filter (where agence <> 'RESEAU') as somme, max(ca_signe) filter (where agence = 'RESEAU') as reseau
  from buta.mart_kpi_mensuel group by mois) t where somme <> reseau;

-- Decomposition de l'ecart : residuel sous 3 % de l'ecart total (quand l'ecart est significatif).
select 'residuel de la decomposition d''ecart < 3 %' as test,
  count(*) filter (where abs(residuel) > 0.03 * abs(ecart_total)) = 0 as ok,
  count(*) as lignes, count(*) filter (where abs(residuel) > 0.03 * abs(ecart_total)) as lignes_en_defaut,
  max(abs(residuel)) as residuel_max_eur
from buta.mart_ecarts where comparaison_disponible and abs(ecart_total) > 1000;

-- Les effets de la decomposition se somment a l'ecart total (au residuel pres).
select 'somme des effets = ecart total' as test,
  count(*) filter (where abs(ecart_total - (effet_volume + effet_mix + effet_prix + effet_remise + residuel)) > 2) = 0 as ok,
  count(*) as lignes
from buta.mart_ecarts;

-- Poids de l'acquisition (avec commissions) entre 12 et 22 % du CA au niveau reseau, mois complets.
select 'poids de l''acquisition 12 a 22 %' as test,
  100 * sum(couts_acquisition + commissions) / sum(ca_signe) between 12 and 22 as ok,
  round(100 * sum(couts_acquisition + commissions) / sum(ca_signe), 1) as poids_pct
from buta.mart_kpi_mensuel where agence = 'RESEAU' and mois < date_trunc('month', buta.journee_publiee());

-- Aucune date posterieure a la journee publiee dans les vues d'evenement.
select 'aucun evenement futur dans dossier_a_date' as test, count(*) = 0 as ok, count(*) as lignes from buta.dossier_a_date
where date_rdv > journee or date_devis > journee or date_signature > journee or date_pose > journee or date_encaissement > journee;

-- Les douze controles : seuls KO ou alertes attendus, ceux de l'agence Nord (H4) : C03 (statut), C05 (doublons), C09 (libelles).
with r as (select buta.executer_controles(buta.journee_publiee()) as synthese),
detail as (
  select e->>'controle' as controle, e->>'statut' as statut, (e->>'nb_lignes')::int as nb
  from r, jsonb_array_elements(r.synthese->'controles') e)
select 'douze controles : seuls C03, C05, C09 en defaut (Nord)' as test,
  bool_and(statut = 'ok' or controle in ('C03', 'C05', 'C09')) as ok,
  string_agg(controle || '=' || statut || '(' || nb || ')', ' ' order by controle) as detail
from detail;

-- Les anomalies des controles en defaut sont toutes dans l'agence Nord.
select 'anomalies des controles C03, C05, C09 : agence Nord seulement' as test,
  count(*) filter (where agence <> 'NOR') = 0 as ok, count(*) as anomalies, count(*) filter (where agence = 'NOR') as dont_nord
from (
  select agence from buta.fait_dossier where publie and statut is null
  union all
  select agence from buta.fait_dossier where publie and produit_libelle_source is not null and produit_libelle_source not in (select libelle from buta.dim_produit)
  union all
  select a.agence from buta.fait_dossier a join buta.fait_dossier b on b.empreinte_contact = a.empreinte_contact and b.produit = a.produit and b.id > a.id and abs(b.date_lead - a.date_lead) <= 30 where a.publie and b.publie) t;
