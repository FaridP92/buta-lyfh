-- 0007 : alerte carnet de pose relative a l'agence (au-dela de 1,3 fois sa mediane des douze
-- dernieres semaines, et au moins 5 jours ouvres) plutot qu'un seuil absolu : a la volumetrie du
-- reseau simule (52 techniciens pour 1 800 poses par an), un carnet de 40 jours ouvres n'existe pas.

create or replace view buta.mart_alertes as
with j as (select buta.journee_publiee() as j, date_trunc('month', buta.journee_publiee())::date as mois_courant),
cpv as (
  select agence, cout_par_vente,
    (select percentile_cont(0.5) within group (order by c2.cout_par_vente) from buta.mart_couts_acquisition c2
      where c2.agence = c1.agence and c2.canal = 'leads_achetes' and c2.mois between date '2026-01-01' and date '2026-03-01')::numeric as cpv_t1
  from buta.mart_couts_acquisition c1, j
  where canal = 'leads_achetes' and mois = (select mois_courant - interval '1 month' from j)::date and agence <> 'RESEAU'
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
    round(100.0 * (cout_par_vente - cpv_t1) / cpv_t1, 0) as valeur,
    'cout par vente des leads achetes ' || case when cout_par_vente >= cpv_t1 then '+' else '' end || round(100.0 * (cout_par_vente - cpv_t1) / cpv_t1, 0) || ' % vs T1' as texte
  from cpv where cpv_t1 > 0 and cout_par_vente > 1.3 * cpv_t1
  union all
  select 'DOSSIERS_A_QUALIFIER', agence, 'attention', nb, nb || ' dossiers a qualifier, referentiel en cours d''alignement' from qualifier where nb > 0
  union all
  select 'CARNET_POSE', agence, 'alerte', carnet_jours_ouvres,
    'carnet de pose a ' || round(carnet_jours_ouvres, 0) || ' jours ouvres (+' || round(100.0 * (carnet_jours_ouvres - carnet_median_12s) / carnet_median_12s, 0) || ' % sur douze semaines)'
  from carnet where carnet_median_12s > 0 and carnet_jours_ouvres >= 5 and carnet_jours_ouvres > 1.3 * carnet_median_12s
  union all
  select 'POSES_EN_RETARD', agence, 'attention', poses_en_retard, poses_en_retard || ' poses en retard de plus de 60 jours' from carnet where poses_en_retard >= 10
)
select a.code, a.agence, ag.nom_bassin, a.gravite, a.valeur, ag.nom_bassin || ' : ' || a.texte as texte, j.j as calcule_le
from alertes a join buta.dim_agence ag on ag.code = a.agence cross join j;
comment on view buta.mart_alertes is 'Alertes du matin calculées par règles à la journée publiée : coût par vente des leads achetés au-delà de +30 % vs le premier trimestre, dossiers à qualifier (statut ou libellé produit hors référentiel), carnet de pose au-delà de 1,3 fois la médiane des douze dernières semaines de l''agence, poses en retard. Texte assemblé en SQL, valeur numérique fournie. Données simulées.';
