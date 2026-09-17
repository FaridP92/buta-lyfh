-- 0008 : poses en retard jugees a 60 jours avec agence sur place et 90 jours a distance
-- (delai normal de 75 jours, H5) ; alerte cout par vente calculee sur les trois dernieres cohortes
-- mures (creees depuis plus de 90 jours) et non sur le dernier mois, dont les ventes ne sont pas encore la ;
-- au moins huit ventes dans chaque fenetre, sinon le cout par vente d'un petit canal n'est que du bruit.

create or replace view buta.mart_pose as
with j as (select buta.journee_publiee() as j),
semaines as (
  select distinct date_trunc('week', jour)::date as semaine from buta.dim_date, j
  where jour between date '2025-01-01' and j.j + 84
),
grille as (select s.semaine, a.code as agence, a.poses_par_technicien_semaine from semaines s cross join buta.dim_agence a),
techs as (
  select g.semaine, g.agence,
    (select count(*) from buta.dim_technicien t where t.agence = g.agence and t.entree <= g.semaine + 6 and (t.sortie is null or t.sortie >= g.semaine)) as techniciens_actifs
  from grille g
),
realisees as (
  select date_trunc('week', date_pose)::date as semaine, d.agence, count(*) as poses, sum(p.duree_pose_jt) as jt_poses, sum(d.montant_ht) as ca_pose
  from buta.dossier_a_date d join buta.dim_produit p on p.code = d.produit
  where d.date_pose is not null group by 1, 2
),
planifiees as (
  select date_trunc('week', d.date_pose)::date as semaine, d.agence, count(*) as poses_planifiees, sum(p.duree_pose_jt) as jt_planifies
  from buta.fait_dossier d join buta.dim_produit p on p.code = d.produit cross join j
  where d.publie and d.date_pose is not null and d.date_pose > j.j and (d.date_annulation is null or d.date_annulation > j.j)
  group by 1, 2
),
carnet as (
  select g.semaine, g.agence,
    (select coalesce(sum(p.duree_pose_jt), 0) from buta.fait_dossier d join buta.dim_produit p on p.code = d.produit
      where d.publie and d.agence = g.agence and d.date_signature <= g.semaine + 6
        and (d.date_pose is null or d.date_pose > g.semaine + 6)
        and (d.date_annulation is null or d.date_annulation > g.semaine + 6)) as carnet_jt,
    (select count(*) from buta.fait_dossier d
      where d.publie and d.agence = g.agence and d.date_signature <= g.semaine + 6
        and (d.date_pose is null or d.date_pose > g.semaine + 6)
        and (d.date_annulation is null or d.date_annulation > g.semaine + 6)) as dossiers_a_poser,
    (select count(*) from buta.fait_dossier d
      where d.publie and d.agence = g.agence
        and d.date_signature <= g.semaine + 6 - case when d.departement in ('16', '17', '33', '40', '59') then 60 else 90 end
        and (d.date_pose is null or d.date_pose > g.semaine + 6)
        and (d.date_annulation is null or d.date_annulation > g.semaine + 6)) as poses_en_retard
  from grille g cross join j where g.semaine <= j.j
),
base as (
  select g.semaine, g.agence, t.techniciens_actifs,
    t.techniciens_actifs * g.poses_par_technicien_semaine as capacite_jt_semaine,
    coalesce(r.poses, 0) as poses, coalesce(r.jt_poses, 0) as jt_poses, coalesce(r.ca_pose, 0) as ca_pose,
    coalesce(pl.poses_planifiees, 0) as poses_planifiees, coalesce(pl.jt_planifies, 0) as jt_planifies,
    c.carnet_jt, c.dossiers_a_poser, c.poses_en_retard
  from grille g
  join techs t on t.semaine = g.semaine and t.agence = g.agence
  left join realisees r on r.semaine = g.semaine and r.agence = g.agence
  left join planifiees pl on pl.semaine = g.semaine and pl.agence = g.agence
  left join carnet c on c.semaine = g.semaine and c.agence = g.agence
)
select semaine, coalesce(agence, 'RESEAU') as agence,
  sum(techniciens_actifs) as techniciens_actifs, sum(capacite_jt_semaine) as capacite_jt_semaine,
  sum(poses) as poses, sum(jt_poses) as jt_poses, sum(ca_pose) as ca_pose,
  case when sum(capacite_jt_semaine) > 0 then round(100.0 * sum(jt_poses) / sum(capacite_jt_semaine), 1) end as productivite_pose,
  sum(poses_planifiees) as poses_planifiees, sum(jt_planifies) as jt_planifies,
  case when sum(capacite_jt_semaine) > 0 then round(100.0 * sum(jt_planifies) / sum(capacite_jt_semaine), 1) end as charge_planifiee_pct,
  sum(carnet_jt) as carnet_jt, sum(dossiers_a_poser) as dossiers_a_poser, sum(poses_en_retard) as poses_en_retard,
  case when sum(techniciens_actifs) > 0 then round(sum(carnet_jt) / (sum(techniciens_actifs) * 0.8), 1) end as carnet_jours_ouvres
from base
group by grouping sets ((semaine, agence), (semaine));
comment on view buta.mart_pose is 'Pose par semaine et agence (avec RESEAU) : techniciens actifs, capacité en jours-technicien, poses réalisées et jours-technicien posés, productivité de pose (PROD_TECH), poses planifiées et charge planifiée après la journée publiée, carnet de pose en jours-technicien et en jours ouvrés (CARNET = charge restante / (techniciens x 0,8)), dossiers à poser, poses en retard (signées depuis plus de 60 jours avec agence sur place, 90 jours à distance, non posées). Données simulées.';
comment on column buta.mart_pose.carnet_jours_ouvres is 'CARNET : ventes signées non posées x durée de pose du produit / (techniciens actifs x 0,8), en jours ouvrés.';

create or replace view buta.mart_alertes as
with j as (select buta.journee_publiee() as j, date_trunc('month', buta.journee_publiee())::date as mois_courant),
cohortes_mures as (
  select mois from (select distinct mois from buta.mart_couts_acquisition) m, j
  where (m.mois + interval '1 month')::date + 90 <= j.j and m.mois >= date '2026-04-01'
  order by mois desc limit 3
),
cpv as (
  select c.agence,
    sum(c.cout) filter (where c.mois in (select mois from cohortes_mures)) / nullif(sum(c.ventes) filter (where c.mois in (select mois from cohortes_mures)), 0) as cpv_recent,
    sum(c.cout) filter (where c.mois between date '2026-01-01' and date '2026-03-01') / nullif(sum(c.ventes) filter (where c.mois between date '2026-01-01' and date '2026-03-01'), 0) as cpv_t1,
    max(c.mois) filter (where c.mois in (select mois from cohortes_mures)) as derniere_cohorte,
    sum(c.ventes) filter (where c.mois in (select mois from cohortes_mures)) as ventes_recentes,
    sum(c.ventes) filter (where c.mois between date '2026-01-01' and date '2026-03-01') as ventes_t1
  from buta.mart_couts_acquisition c
  where c.canal = 'leads_achetes' and c.agence <> 'RESEAU'
  group by c.agence
),
qualifier as (
  select agence, count(*) as nb from buta.dossier_a_date
  where statut is null or (produit_libelle_source is not null and produit_libelle_source not in (select libelle from buta.dim_produit))
  group by agence
),
derniere_semaine as (select max(semaine) as semaine from buta.mart_pose p, j where p.semaine <= j.j),
carnet as (
  select p.agence, p.carnet_jours_ouvres, p.poses_en_retard,
    (select percentile_cont(0.5) within group (order by p2.carnet_jours_ouvres) from buta.mart_pose p2, derniere_semaine d
      where p2.agence = p.agence and p2.semaine between d.semaine - 84 and d.semaine - 7)::numeric as carnet_median_12s
  from buta.mart_pose p, derniere_semaine d
  where p.agence <> 'RESEAU' and p.semaine = d.semaine
),
alertes as (
  select 'CPV_LEADS_ACHETES' as code, agence, 'alerte' as gravite,
    round(100.0 * (cpv_recent - cpv_t1) / cpv_t1, 0) as valeur,
    'cout par vente des leads achetes +' || round(100.0 * (cpv_recent - cpv_t1) / cpv_t1, 0) || ' % vs T1 (cohortes jusqu''a ' || to_char(derniere_cohorte, 'MM/YYYY') || ')' as texte
  from cpv where cpv_t1 > 0 and cpv_recent > 1.3 * cpv_t1 and ventes_recentes >= 8 and ventes_t1 >= 8
  union all
  select 'DOSSIERS_A_QUALIFIER', agence, 'attention', nb, nb || ' dossiers a qualifier, referentiel en cours d''alignement' from qualifier where nb > 0
  union all
  select 'CARNET_POSE', agence, 'alerte', carnet_jours_ouvres,
    'carnet de pose a ' || round(carnet_jours_ouvres, 0) || ' jours ouvres (+' || round(100.0 * (carnet_jours_ouvres - carnet_median_12s) / carnet_median_12s, 0) || ' % sur douze semaines)'
  from carnet where carnet_median_12s > 0 and carnet_jours_ouvres >= 5 and carnet_jours_ouvres > 1.3 * carnet_median_12s
  union all
  select 'POSES_EN_RETARD', agence, 'attention', poses_en_retard, poses_en_retard || ' poses en retard' from carnet where poses_en_retard >= 10
)
select a.code, a.agence, ag.nom_bassin, a.gravite, a.valeur, ag.nom_bassin || ' : ' || a.texte as texte, j.j as calcule_le
from alertes a join buta.dim_agence ag on ag.code = a.agence cross join j;
comment on view buta.mart_alertes is 'Alertes du matin calculées par règles à la journée publiée : coût par vente des leads achetés sur les trois dernières cohortes mûres au-delà de +30 % vs le premier trimestre, dossiers à qualifier (statut ou libellé produit hors référentiel), carnet de pose au-delà de 1,3 fois la médiane des douze dernières semaines de l''agence, poses en retard (60 jours sur place, 90 à distance). Texte assemblé en SQL, valeur numérique fournie. Données simulées.';
