-- 0010 : accents français dans les textes assemblés en SQL (alertes, mention de la revue).

create or replace view buta.mart_alertes as
with j as materialized (select buta.journee_publiee() as j, date_trunc('month', buta.journee_publiee())::date as mois_courant),
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
fenetre_pose as (
  select p.agence, p.semaine, p.carnet_jours_ouvres, p.poses_en_retard,
    max(p.semaine) over () as derniere
  from buta.mart_pose p, j
  where p.agence <> 'RESEAU' and p.semaine <= j.j and p.semaine >= j.j - 98
),
carnet as (
  select agence,
    max(carnet_jours_ouvres) filter (where semaine = derniere) as carnet_jours_ouvres,
    max(poses_en_retard) filter (where semaine = derniere) as poses_en_retard,
    (percentile_cont(0.5) within group (order by carnet_jours_ouvres) filter (where semaine between derniere - 84 and derniere - 7))::numeric as carnet_median_12s
  from fenetre_pose
  group by agence
),
alertes as (
  select 'CPV_LEADS_ACHETES' as code, agence, 'alerte' as gravite,
    round(100.0 * (cpv_recent - cpv_t1) / cpv_t1, 0) as valeur,
    'coût par vente des leads achetés +' || round(100.0 * (cpv_recent - cpv_t1) / cpv_t1, 0) || ' % vs T1 (cohortes jusqu''à ' || to_char(derniere_cohorte, 'MM/YYYY') || ')' as texte
  from cpv where cpv_t1 > 0 and cpv_recent > 1.3 * cpv_t1 and ventes_recentes >= 8 and ventes_t1 >= 8
  union all
  select 'DOSSIERS_A_QUALIFIER', agence, 'attention', nb, nb || ' dossiers à qualifier, référentiel en cours d''alignement' from qualifier where nb > 0
  union all
  select 'CARNET_POSE', agence, 'alerte', carnet_jours_ouvres,
    'carnet de pose à ' || round(carnet_jours_ouvres, 0) || ' jours ouvrés (+' || round(100.0 * (carnet_jours_ouvres - carnet_median_12s) / carnet_median_12s, 0) || ' % sur douze semaines)'
  from carnet where carnet_median_12s > 0 and carnet_jours_ouvres >= 5 and carnet_jours_ouvres > 1.3 * carnet_median_12s
  union all
  select 'POSES_EN_RETARD', agence, 'attention', poses_en_retard, poses_en_retard || ' poses en retard' from carnet where poses_en_retard >= 10
)
select a.code, a.agence, ag.nom_bassin, a.gravite, a.valeur, ag.nom_bassin || ' : ' || a.texte as texte, j.j as calcule_le
from alertes a join buta.dim_agence ag on ag.code = a.agence cross join j;
comment on view buta.mart_alertes is 'Alertes du matin calculées par règles à la journée publiée : coût par vente des leads achetés sur les trois dernières cohortes mûres au-delà de +30 % vs le premier trimestre, dossiers à qualifier (statut ou libellé produit hors référentiel), carnet de pose au-delà de 1,3 fois la médiane des douze dernières semaines de l''agence, poses en retard (60 jours sur place, 90 à distance). Texte assemblé en SQL, valeur numérique fournie. Données simulées.';

create or replace function buta.faits_revue_hebdo(p_semaine date)
returns jsonb
language sql
stable
security definer
set search_path = buta, public
as $$
  with s as (select date_trunc('week', p_semaine)::date as debut, date_trunc('week', p_semaine)::date + 6 as fin),
  d as (select * from buta.dossier_a_date),
  reseau as (
    select
      count(*) filter (where date_lead between s.debut and s.fin) as leads,
      count(*) filter (where date_rdv between s.debut and s.fin) as rdv_tenus,
      count(*) filter (where date_signature between s.debut and s.fin and date_annulation is null) as signatures,
      coalesce(sum(montant_ht) filter (where date_signature between s.debut and s.fin and date_annulation is null), 0) as ca_signe,
      count(*) filter (where date_pose between s.debut and s.fin) as poses,
      coalesce(sum(montant_ht) filter (where date_encaissement between s.debut and s.fin), 0) as encaisse,
      count(*) filter (where date_lead between s.debut - 7 and s.fin - 7) as leads_semaine_precedente,
      count(*) filter (where date_signature between s.debut - 7 and s.fin - 7 and date_annulation is null) as signatures_semaine_precedente,
      coalesce(sum(montant_ht) filter (where date_signature between s.debut - 7 and s.fin - 7 and date_annulation is null), 0) as ca_signe_semaine_precedente
    from d, s
  ),
  agences as (
    select d.agence, a.nom_bassin,
      count(*) filter (where date_lead between s.debut and s.fin) as leads,
      count(*) filter (where date_signature between s.debut and s.fin and date_annulation is null) as signatures,
      coalesce(sum(montant_ht) filter (where date_signature between s.debut and s.fin and date_annulation is null), 0) as ca_signe,
      count(*) filter (where date_pose between s.debut and s.fin) as poses
    from d join buta.dim_agence a on a.code = d.agence, s
    group by d.agence, a.nom_bassin
  )
  select jsonb_build_object(
    'semaine', (select debut from s),
    'reseau', (select to_jsonb(r) from reseau r),
    'agences', (select jsonb_agg(to_jsonb(a) order by a.agence) from agences a),
    'ecarts_mois', (select coalesce(jsonb_agg(to_jsonb(e) order by e.agence), '[]'::jsonb) from buta.mart_ecarts e, s
      where e.mois = date_trunc('month', s.debut)::date and e.comparaison = 'objectif'),
    'alertes', (select coalesce(jsonb_agg(to_jsonb(al)), '[]'::jsonb) from buta.mart_alertes al),
    'mention', 'données d''activité simulées');
$$;
