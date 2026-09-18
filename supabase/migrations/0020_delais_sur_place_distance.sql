-- 0020 : mart_delais gagne deux pseudo-départements SUR_PLACE et A_DISTANCE (lot 4b, écran Pose et encaissement).
-- La courbe « délai de pose sur place contre à distance » (H5) a besoin d'une médiane exacte par mois et par
-- type de couverture, calculée sur les dossiers, pas d'une médiane de médianes départementales.
-- Mêmes colonnes qu'avant (create or replace), lignes ajoutées : departement in ('SUR_PLACE', 'A_DISTANCE')
-- par mois et agence (et RESEAU).

create or replace view buta.mart_delais as
with poses as (
  select date_trunc('month', date_pose)::date as mois, agence, departement,
    count(*) as poses,
    count(*) filter (where date_pose - date_signature <= 60) as poses_dans_les_delais,
    percentile_cont(0.5) within group (order by date_pose - date_signature) as delai_signature_pose_median,
    percentile_cont(0.5) within group (order by date_encaissement - date_pose) filter (where date_encaissement is not null) as delai_pose_encaissement_median,
    percentile_cont(0.5) within group (order by date_rdv - date_lead) filter (where date_rdv is not null) as delai_lead_rdv_median,
    percentile_cont(0.5) within group (order by date_signature - date_devis) filter (where date_devis is not null) as delai_devis_signature_median
  from buta.dossier_a_date where date_pose is not null group by 1, 2, 3
),
par_couverture as (
  select date_trunc('month', date_pose)::date as mois, agence,
    case when departement in ('16', '17', '33', '40', '59') then 'SUR_PLACE' else 'A_DISTANCE' end as couverture,
    count(*) as poses,
    count(*) filter (where date_pose - date_signature <= 60) as poses_dans_les_delais,
    percentile_cont(0.5) within group (order by date_pose - date_signature) as delai_signature_pose_median,
    percentile_cont(0.5) within group (order by date_encaissement - date_pose) filter (where date_encaissement is not null) as delai_pose_encaissement_median,
    percentile_cont(0.5) within group (order by date_rdv - date_lead) filter (where date_rdv is not null) as delai_lead_rdv_median,
    percentile_cont(0.5) within group (order by date_signature - date_devis) filter (where date_devis is not null) as delai_devis_signature_median
  from buta.dossier_a_date where date_pose is not null
  group by grouping sets ((1, 2, 3), (1, 3))
)
select mois, coalesce(agence, 'RESEAU') as agence, coalesce(departement, 'TOUS') as departement,
  departement not in ('16', '17', '33', '40', '59') as couvert_a_distance,
  sum(poses) as poses, sum(poses_dans_les_delais) as poses_dans_les_delais,
  case when sum(poses) > 0 then round(100.0 * sum(poses_dans_les_delais) / sum(poses), 1) end as taux_poses_dans_les_delais,
  case when grouping(agence, departement) = 0 then max(delai_signature_pose_median) else percentile_cont(0.5) within group (order by delai_signature_pose_median) end as delai_signature_pose_median,
  case when grouping(agence, departement) = 0 then max(delai_pose_encaissement_median) else percentile_cont(0.5) within group (order by delai_pose_encaissement_median) end as delai_pose_encaissement_median,
  case when grouping(agence, departement) = 0 then max(delai_lead_rdv_median) else percentile_cont(0.5) within group (order by delai_lead_rdv_median) end as delai_lead_rdv_median,
  case when grouping(agence, departement) = 0 then max(delai_devis_signature_median) else percentile_cont(0.5) within group (order by delai_devis_signature_median) end as delai_devis_signature_median
from poses
group by grouping sets ((mois, agence, departement), (mois, agence), (mois, departement), (mois))
union all
select mois, coalesce(agence, 'RESEAU') as agence, couverture as departement,
  couverture = 'A_DISTANCE' as couvert_a_distance,
  poses, poses_dans_les_delais,
  case when poses > 0 then round(100.0 * poses_dans_les_delais / poses, 1) end as taux_poses_dans_les_delais,
  delai_signature_pose_median, delai_pose_encaissement_median, delai_lead_rdv_median, delai_devis_signature_median
from par_couverture;
comment on view buta.mart_delais is 'Délais par mois de pose, agence et département (avec RESEAU et TOUS, plus SUR_PLACE et A_DISTANCE calculés sur les dossiers) : médianes en jours signature vers pose (D_SIGN_POSE), pose vers encaissement (D_ENCAISSE), lead vers RDV, devis vers signature ; part des poses à moins de 60 jours (POSE_DELAI) ; couvert_a_distance vrai pour les départements sans agence. Données simulées.';
