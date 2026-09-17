-- Les sept histoires (DONNEES.md §3.4), une requête par histoire, chacune renvoie une ligne
-- (test, ok, valeurs mesurees). Tolerance : plus ou moins 20 % de l'effet cible (VERIFICATION.md §2),
-- sauf mention. Executees par `npm run test:sql` sur la base chargee.

-- H1 Marensin : RDV vers devis en retrait de 10 points de mars à juin 2026 (vs novembre 2025 a février 2026).
with avant as (
  select sum(devis)::numeric / nullif(sum(rdv_tenus), 0) as taux from buta.mart_funnel
  where agence = 'MAR' and canal = 'TOUS' and mois between date '2025-11-01' and date '2026-02-01'),
pendant as (
  select sum(devis)::numeric / nullif(sum(rdv_tenus), 0) as taux from buta.mart_funnel
  where agence = 'MAR' and canal = 'TOUS' and mois between date '2026-03-01' and date '2026-06-01')
select 'H1 Marensin : taux RDV vers devis' as test,
  100 * (pendant.taux - avant.taux) between -12 and -8 as ok,
  round(100 * avant.taux, 1) as taux_avant, round(100 * pendant.taux, 1) as taux_pendant,
  round(100 * (pendant.taux - avant.taux), 1) as ecart_points, '-10 pts (-12 a -8)' as attendu
from avant, pendant;

-- H2 Bordeaux Métropole : coût par vente des leads achetés +40 a +45 % vs premier trimestre 2026
-- (avril à juillet 2026, cohortes quasi complètes au 16 septembre), calcule depuis la vue.
-- Le ratio de leads dépasse 2 par la saisonnalite (printemps photovoltaique) : borne large.
with t1 as (
  select sum(cout) / nullif(sum(ventes), 0) as cpv from buta.mart_couts_acquisition
  where agence = 'BDX' and canal = 'leads_achetes' and mois between date '2026-01-01' and date '2026-03-01'),
apres as (
  select sum(cout) / nullif(sum(ventes), 0) as cpv, sum(leads) / 4.0 as leads from buta.mart_couts_acquisition
  where agence = 'BDX' and canal = 'leads_achetes' and mois between date '2026-04-01' and date '2026-07-01'),
leads_t1 as (
  select sum(leads) / 3.0 as leads from buta.mart_couts_acquisition
  where agence = 'BDX' and canal = 'leads_achetes' and mois between date '2026-01-01' and date '2026-03-01')
select 'H2 Bordeaux Métropole : coût par vente des leads achetés' as test,
  100 * (apres.cpv - t1.cpv) / t1.cpv between 34 and 51 and apres.leads / leads_t1.leads between 1.6 and 2.8 as ok,
  round(t1.cpv, 0) as cpv_t1, round(apres.cpv, 0) as cpv_apres,
  round(100 * (apres.cpv - t1.cpv) / t1.cpv, 1) as hausse_pct,
  round(apres.leads / leads_t1.leads, 2) as ratio_leads_mensuels, '+40 a +45 % (34 à 51), leads x2 (1,6 à 2,8)' as attendu
from t1, apres, leads_t1;

-- H3 Saintonge : remise de 4 % à 9 % (+5 pts), signature +4 pts, marge en retrait, à partir d'avril 2026.
with avant as (
  select sum(remises_num) / nullif(sum(cat_num), 0) as remise, sum(marge) / nullif(sum(ca), 0) as marge from (
    select taux_remise * prix_catalogue_moyen * ventes as remises_num, prix_catalogue_moyen * ventes as cat_num, marge_brute as marge, ca_signe as ca
    from buta.mart_ventes_produit where agence = 'SAI' and produit = 'TOUS' and mois between date '2025-10-01' and date '2026-03-01') x),
apres as (
  select sum(remises_num) / nullif(sum(cat_num), 0) as remise, sum(marge) / nullif(sum(ca), 0) as marge from (
    select taux_remise * prix_catalogue_moyen * ventes as remises_num, prix_catalogue_moyen * ventes as cat_num, marge_brute as marge, ca_signe as ca
    from buta.mart_ventes_produit where agence = 'SAI' and produit = 'TOUS' and mois between date '2026-04-01' and date '2026-08-01') x),
sign_avant as (
  select sum(signatures)::numeric / nullif(sum(devis), 0) as taux from buta.mart_funnel
  where agence = 'SAI' and canal = 'TOUS' and mois between date '2025-10-01' and date '2026-03-01'),
sign_apres as (
  select sum(signatures)::numeric / nullif(sum(devis), 0) as taux from buta.mart_funnel
  where agence = 'SAI' and canal = 'TOUS' and mois between date '2026-04-01' and date '2026-06-01')
select 'H3 Saintonge : remise, signature, marge' as test,
  (apres.remise - avant.remise) between 4 and 6
  and 100 * (sign_apres.taux - sign_avant.taux) between 3.2 and 4.8
  and 100 * (apres.marge - avant.marge) between -5 and -2.4 as ok,
  round(avant.remise, 2) as remise_avant_pct, round(apres.remise, 2) as remise_apres_pct,
  round(100 * (sign_apres.taux - sign_avant.taux), 1) as signature_ecart_pts,
  round(100 * (apres.marge - avant.marge), 1) as marge_ecart_pts,
  'remise +5 pts (4 à 6), signature +4 pts (3,2 à 4,8), marge -3 a -4 pts (-5 a -2,4)' as attendu
from avant, apres, sign_avant, sign_apres;

-- H4 Nord : anomalies d'intégration (statut absent, libellé produit hors référentiel, doublons)
-- presentes en juin 2026, décroissantes jusqu'en septembre, absentes ailleurs.
with anomalies as (
  select date_trunc('week', date_lead)::date as semaine, agence,
    count(*) filter (where statut is null) as sans_statut,
    count(*) filter (where produit_libelle_source is not null and produit_libelle_source not in (select libelle from buta.dim_produit)) as libelles
  from buta.fait_dossier where publie group by 1, 2),
nord_debut as (select sum(sans_statut + libelles) as n from anomalies where agence = 'NOR' and semaine between date '2026-06-01' and date '2026-06-21'),
nord_fin as (select sum(sans_statut + libelles) as n from anomalies where agence = 'NOR' and semaine between date '2026-08-24' and date '2026-09-14'),
ailleurs as (select coalesce(sum(sans_statut + libelles), 0) as n from anomalies where agence <> 'NOR' or semaine < date '2026-06-01'),
doublons as (select count(*) as n from buta.fait_dossier a join buta.fait_dossier b
  on b.empreinte_contact = a.empreinte_contact and b.produit = a.produit and b.id > a.id and abs(b.date_lead - a.date_lead) <= 30
  where a.publie and b.publie and a.agence = 'NOR')
select 'H4 Nord : anomalies d''intégration décroissantes' as test,
  nord_debut.n >= 10 and nord_fin.n::numeric / nullif(nord_debut.n, 0) < 0.35 and ailleurs.n = 0 and doublons.n >= 10 as ok,
  nord_debut.n as anomalies_3_premieres_semaines, nord_fin.n as anomalies_3_dernieres_semaines, ailleurs.n as anomalies_ailleurs,
  doublons.n as doublons_nord, 'debut >= 10, fin < 35 % du debut, 0 ailleurs, doublons >= 10' as attendu
from nord_debut, nord_fin, ailleurs, doublons;

-- H5 Départements couverts à distance : délai signature vers pose 75 j contre 45 j (ratio 1,67),
-- annulation 14 % contre 8 % (+6 pts).
with delais as (
  select
    percentile_cont(0.5) within group (order by date_pose - date_signature) filter (where departement not in ('16', '17', '33', '40', '59')) as distance,
    percentile_cont(0.5) within group (order by date_pose - date_signature) filter (where departement in ('16', '17', '33', '40', '59')) as sur_place
  from buta.fait_dossier where publie and date_pose is not null and agence <> 'ARC'),
annul as (
  select
    count(*) filter (where date_annulation is not null and departement not in ('16', '17', '33', '40', '59'))::numeric / nullif(count(*) filter (where departement not in ('16', '17', '33', '40', '59')), 0) as distance,
    count(*) filter (where date_annulation is not null and departement in ('16', '17', '33', '40', '59'))::numeric / nullif(count(*) filter (where departement in ('16', '17', '33', '40', '59')), 0) as sur_place
  from buta.fait_dossier where publie and date_signature is not null and date_signature <= buta.journee_publiee() - 60)
select 'H5 couverts à distance : délai de pose et annulation' as test,
  delais.distance / delais.sur_place between 1.33 and 2.0 and 100 * (annul.distance - annul.sur_place) between 4.8 and 7.2 as ok,
  delais.distance as delai_distance_j, delais.sur_place as delai_sur_place_j,
  round(100 * annul.distance, 1) as annulation_distance_pct, round(100 * annul.sur_place, 1) as annulation_sur_place_pct,
  'ratio délai 1,67 (1,33 à 2,0), annulation +6 pts (4,8 à 7,2)' as attendu
from delais, annul;

-- H6 Saisonnalite (2025) : photovoltaique au printemps, PAC et poele à l'automne, août creux partout.
with leads as (
  select extract(month from date_lead)::int as mois, p.profil_saison, count(*) as n
  from buta.fait_dossier d join buta.dim_produit p on p.code = d.produit
  where d.publie and date_lead between date '2025-01-01' and date '2025-12-31' group by 1, 2),
pv as (
  select avg(n) filter (where mois between 3 and 6) / avg(n) filter (where mois in (1, 2, 9, 10, 11, 12)) as ratio
  from leads where profil_saison = 'photovoltaique'),
chauffage as (
  select avg(n) filter (where mois between 9 and 12) / avg(n) filter (where mois between 1 and 4) as ratio
  from leads where profil_saison = 'chauffage'),
aout as (
  select sum(n) filter (where mois = 8) / (sum(n) filter (where mois <> 8) / 11.0) as ratio from leads)
select 'H6 saisonnalite' as test,
  pv.ratio between 1.2 and 1.5 and chauffage.ratio between 1.2 and 1.75 and aout.ratio < 0.85 as ok,
  round(pv.ratio, 2) as pv_printemps_vs_reste, round(chauffage.ratio, 2) as chauffage_automne_vs_hiver_printemps, round(aout.ratio, 2) as aout_vs_moyenne,
  'PV 1,2 à 1,5 ; chauffage 1,2 à 1,75 ; août < 0,85' as attendu
from pv, chauffage, aout;

-- H7 Bassin d'Arcachon : capacite de pose réduite de mi-avril a août 2026 : retards de pose +22 j
-- (signatures de mai a août vs référence janvier 2025 à mi-avril 2026, délai réel non censure), carnet
-- de pose au moins x1,25 (a ces volumes, le stock signe non pose croit comme le délai : +22 j sur 45).
with delais as (
  select
    percentile_cont(0.5) within group (order by date_pose - date_signature) filter (where date_signature between date '2026-05-01' and date '2026-08-31') as pendant,
    percentile_cont(0.5) within group (order by date_pose - date_signature) filter (where date_signature between date '2025-01-01' and date '2026-04-14') as avant
  from buta.fait_dossier where publie and agence = 'ARC' and date_pose is not null),
carnet as (
  select
    max(carnet_jours_ouvres) filter (where semaine between date '2026-06-01' and date '2026-09-14') as pic,
    avg(carnet_jours_ouvres) filter (where semaine between date '2026-01-01' and date '2026-03-31') as base
  from buta.mart_pose where agence = 'ARC')
select 'H7 Bassin d''Arcachon : retards de pose et carnet' as test,
  (delais.pendant - delais.avant) between 17.6 and 26.4 and carnet.pic / nullif(carnet.base, 0) >= 1.25 as ok,
  delais.avant as delai_avant_j, delais.pendant as delai_pendant_j, round((delais.pendant - delais.avant)::numeric, 1) as ecart_j,
  round(carnet.base, 1) as carnet_base_jo, round(carnet.pic, 1) as carnet_pic_jo, round(carnet.pic / nullif(carnet.base, 0), 2) as ratio_carnet,
  '+22 j (17,6 à 26,4), carnet x1,25 au moins' as attendu
from delais, carnet;
