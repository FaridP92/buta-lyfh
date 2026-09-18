-- 0012 : remises. Deux colonnes additives ajoutées à mart_kpi_mensuel (remises et prix catalogue total,
-- en euros) pour recomposer un taux de remise sur plusieurs mois côté client sans moyenner des taux ;
-- et une vue mart_remises (grain mois, trimestre, année × agence) qui porte, sur les devis du mois,
-- la distribution des taux de remise (centiles), le taux de signature des mêmes devis et la marge
-- avant remise : c'est le jeu de la régression ELAST_REMISE (src/lib/remise.ts).

create or replace view buta.mart_kpi_mensuel as
with j as materialized (select buta.journee_publiee() as j),
grille as (
  select m.mois, a.code as agence
  from (select distinct mois from buta.dim_date, j where mois <= date_trunc('month', j.j)::date) m
  cross join buta.dim_agence a
),
ventes as (
  select date_trunc('month', date_signature)::date as mois, agence,
    count(*) as ventes,
    sum(montant_ht) as ca_signe,
    sum(montant_ht - cout_materiel - cout_pose) as marge_brute,
    sum(commission) as commissions,
    sum(prix_catalogue * taux_remise) as remises,
    sum(prix_catalogue) as prix_catalogue_total
  from buta.dossier_a_date
  where date_signature is not null and date_annulation is null
  group by 1, 2
),
annulations as (
  select date_trunc('month', date_signature)::date as mois, agence,
    count(*) as signatures_brutes,
    count(*) filter (where date_annulation_finale is not null and date_annulation_finale - date_signature <= 60
      and date_annulation_finale <= journee) as annulees_60j,
    bool_and((date_trunc('month', date_signature) + interval '1 month')::date + 60 <= journee) as cohorte_mature
  from buta.dossier_a_date
  where date_signature is not null
  group by 1, 2
),
poses as (
  select date_trunc('month', date_pose)::date as mois, agence,
    count(*) as poses, sum(montant_ht) as ca_pose,
    percentile_cont(0.5) within group (order by date_pose - date_signature) as delai_pose_median
  from buta.dossier_a_date where date_pose is not null group by 1, 2
),
encaissements as (
  select date_trunc('month', date_encaissement)::date as mois, agence, sum(montant_ht) as encaisse
  from buta.dossier_a_date where date_encaissement is not null group by 1, 2
),
leads as (
  select date_trunc('month', date_lead)::date as mois, agence, count(*) as leads
  from buta.dossier_a_date group by 1, 2
),
couts as (
  select mois, agence, sum(montant) as couts_acquisition from buta.fait_cout_canal group by 1, 2
),
charges as (
  select mois, agence, salaires_commerciaux + salaires_techniciens + structure + vehicules as charges
  from buta.charge_agence
),
effectifs as (
  select g.mois, g.agence,
    (select count(*) from buta.dim_commercial c where c.agence = g.agence
       and c.entree <= (g.mois + interval '1 month - 1 day')::date and (c.sortie is null or c.sortie >= g.mois)) as commerciaux_actifs,
    (select count(*) from buta.dim_technicien t where t.agence = g.agence
       and t.entree <= (g.mois + interval '1 month - 1 day')::date and (t.sortie is null or t.sortie >= g.mois)) as techniciens_actifs
  from grille g
),
objectifs as (
  select mois, agence, sum(ventes) as objectif_ventes,
    sum(ventes * prix_catalogue_cible * (1 - taux_remise_cible)) as objectif_ca
  from buta.objectif group by 1, 2
),
base as (
  select g.mois, g.agence,
    coalesce(v.ventes, 0) as ventes, coalesce(v.ca_signe, 0) as ca_signe, coalesce(v.marge_brute, 0) as marge_brute,
    coalesce(v.commissions, 0) as commissions, coalesce(v.remises, 0) as remises, coalesce(v.prix_catalogue_total, 0) as prix_catalogue_total,
    coalesce(an.signatures_brutes, 0) as signatures_brutes, coalesce(an.annulees_60j, 0) as annulees_60j, coalesce(an.cohorte_mature, false) as cohorte_annulation_mature,
    coalesce(p.poses, 0) as poses, coalesce(p.ca_pose, 0) as ca_pose, p.delai_pose_median,
    coalesce(e.encaisse, 0) as encaisse, coalesce(l.leads, 0) as leads,
    coalesce(c.couts_acquisition, 0) * buta.prorata_mois(g.mois) as couts_acquisition,
    coalesce(ch.charges, 0) * buta.prorata_mois(g.mois) as charges,
    ef.commerciaux_actifs, ef.techniciens_actifs,
    coalesce(o.objectif_ventes, 0) as objectif_ventes, coalesce(o.objectif_ca, 0) as objectif_ca
  from grille g
  left join ventes v on v.mois = g.mois and v.agence = g.agence
  left join annulations an on an.mois = g.mois and an.agence = g.agence
  left join poses p on p.mois = g.mois and p.agence = g.agence
  left join encaissements e on e.mois = g.mois and e.agence = g.agence
  left join leads l on l.mois = g.mois and l.agence = g.agence
  left join couts c on c.mois = g.mois and c.agence = g.agence
  left join charges ch on ch.mois = g.mois and ch.agence = g.agence
  left join effectifs ef on ef.mois = g.mois and ef.agence = g.agence
  left join objectifs o on o.mois = g.mois and o.agence = g.agence
),
agrege as (
  select mois, coalesce(agence, 'RESEAU') as agence,
    sum(ventes) as ventes, sum(ca_signe) as ca_signe, sum(marge_brute) as marge_brute, sum(commissions) as commissions,
    sum(remises) as remises, sum(prix_catalogue_total) as prix_catalogue_total,
    sum(signatures_brutes) as signatures_brutes, sum(annulees_60j) as annulees_60j, bool_and(cohorte_annulation_mature) as cohorte_annulation_mature,
    sum(poses) as poses, sum(ca_pose) as ca_pose,
    case when grouping(agence) = 0 then max(delai_pose_median) end as delai_pose_median,
    sum(encaisse) as encaisse, sum(leads) as leads, sum(couts_acquisition) as couts_acquisition, sum(charges) as charges,
    sum(commerciaux_actifs) as commerciaux_actifs, sum(techniciens_actifs) as techniciens_actifs,
    sum(objectif_ventes) as objectif_ventes, sum(objectif_ca) as objectif_ca
  from base
  group by grouping sets ((mois, agence), (mois))
)
select a.mois, a.agence, a.leads, a.ventes, a.ca_signe, a.ca_pose, a.encaisse, a.poses, a.marge_brute,
  case when a.ca_signe > 0 then round(100.0 * a.marge_brute / a.ca_signe, 1) end as taux_marge,
  case when a.ventes > 0 then round(a.ca_signe / a.ventes, 0) end as panier_moyen,
  case when a.prix_catalogue_total > 0 then round(100.0 * a.remises / a.prix_catalogue_total, 1) end as taux_remise,
  a.signatures_brutes, a.annulees_60j, a.cohorte_annulation_mature,
  case when a.signatures_brutes > 0 then round(100.0 * a.annulees_60j / a.signatures_brutes, 1) end as taux_annulation,
  a.delai_pose_median,
  round(a.couts_acquisition, 0) as couts_acquisition, a.commissions,
  round(a.marge_brute - a.couts_acquisition - a.commissions, 0) as marge_apres_acquisition,
  round(a.charges, 0) as charges,
  round(a.marge_brute - a.couts_acquisition - a.commissions - a.charges, 0) as resultat,
  case when a.ca_signe > 0 then round(100.0 * (a.couts_acquisition + a.commissions) / a.ca_signe, 1) end as taux_cac,
  a.commerciaux_actifs, a.techniciens_actifs,
  case when a.commerciaux_actifs > 0 then round(a.ventes::numeric / a.commerciaux_actifs, 2) end as productivite_commerciale,
  a.objectif_ventes, a.objectif_ca,
  case when a.objectif_ca * buta.prorata_mois(a.mois) > 0 then round(100.0 * (a.ca_signe - a.objectif_ca * buta.prorata_mois(a.mois)) / (a.objectif_ca * buta.prorata_mois(a.mois)), 1) end as ecart_objectif_pct,
  buta.prorata_mois(a.mois) as prorata,
  extract(day from least(j.j, (a.mois + interval '1 month - 1 day')::date))::int as jours_publies,
  extract(day from (a.mois + interval '1 month - 1 day')::date)::int as jours_mois,
  round(a.remises, 0) as remises,
  round(a.prix_catalogue_total, 0) as prix_catalogue_total
from agrege a cross join j;
comment on column buta.mart_kpi_mensuel.remises is 'Somme des remises accordées sur les ventes du mois (prix catalogue × taux de remise), en euros ; additive.';
comment on column buta.mart_kpi_mensuel.prix_catalogue_total is 'Somme des prix catalogue des ventes du mois, en euros ; dénominateur de REMISE, additif.';

-- ---------------------------------------------------------------------------
-- mart_remises : distribution des remises et taux de signature des devis, par période et agence
-- ---------------------------------------------------------------------------
create or replace view buta.mart_remises as
with j as materialized (select buta.journee_publiee() as j),
devis as (
  select d.agence, d.date_devis, d.taux_remise, d.prix_catalogue,
    d.date_signature is not null as signe,
    case when d.date_signature is not null then d.prix_catalogue - d.cout_materiel - d.cout_pose end as marge_catalogue
  from buta.dossier_a_date d
  where d.date_devis is not null
),
grains as (
  select 'mois' as grain, date_trunc('month', date_devis)::date as periode, agence, taux_remise, prix_catalogue, signe, marge_catalogue from devis
  union all
  select 'trimestre', date_trunc('quarter', date_devis)::date, agence, taux_remise, prix_catalogue, signe, marge_catalogue from devis
  union all
  select 'annee', date_trunc('year', date_devis)::date, agence, taux_remise, prix_catalogue, signe, marge_catalogue from devis
),
agrege as (
  select grain, periode, coalesce(agence, 'RESEAU') as agence,
    count(*) as devis,
    count(*) filter (where signe) as signatures,
    round(100.0 * avg(taux_remise), 2) as remise_moyenne,
    round(100.0 * percentile_cont(0.10) within group (order by taux_remise)::numeric, 2) as remise_p10,
    round(100.0 * percentile_cont(0.25) within group (order by taux_remise)::numeric, 2) as remise_q1,
    round(100.0 * percentile_cont(0.50) within group (order by taux_remise)::numeric, 2) as remise_mediane,
    round(100.0 * percentile_cont(0.75) within group (order by taux_remise)::numeric, 2) as remise_q3,
    round(100.0 * percentile_cont(0.90) within group (order by taux_remise)::numeric, 2) as remise_p90,
    round(100.0 * sum(marge_catalogue) filter (where signe) / nullif(sum(prix_catalogue) filter (where signe), 0), 2) as marge_avant_remise,
    round(avg(prix_catalogue), 0) as prix_catalogue_moyen
  from grains
  group by grouping sets ((grain, periode, agence), (grain, periode))
)
select a.grain, a.periode, a.agence, a.devis, a.signatures,
  case when a.devis > 0 then round(100.0 * a.signatures / a.devis, 2) end as taux_signature,
  a.remise_moyenne, a.remise_p10, a.remise_q1, a.remise_mediane, a.remise_q3, a.remise_p90,
  a.marge_avant_remise, a.prix_catalogue_moyen,
  (case a.grain
     when 'mois' then (a.periode + interval '1 month')::date
     when 'trimestre' then (a.periode + interval '3 months')::date
     else (a.periode + interval '1 year')::date
   end) - 1 + 45 <= j.j as periode_complete
from agrege a cross join j;
comment on view buta.mart_remises is 'REMISE et ELAST_REMISE : sur les devis émis dans la période (mois, trimestre ou année, par agence et RESEAU), nombre de devis, signatures obtenues à date, taux de signature des devis, taux de remise moyen et centiles 10, 25, 50, 75, 90 (en pourcentage), marge avant remise des dossiers signés (en pourcentage du prix catalogue), prix catalogue moyen ; periode_complete : vrai quand la période est close depuis au moins 45 jours (toutes les signatures des devis sont connues). Données simulées.';
comment on column buta.mart_remises.grain is 'mois, trimestre ou annee ; periode est le premier jour de la période.';
comment on column buta.mart_remises.taux_signature is 'Signatures à date / devis émis dans la période, en pourcentage (cohorte de devis, pas de lead).';
comment on column buta.mart_remises.marge_avant_remise is '(prix catalogue - coût matériel - coût de pose) / prix catalogue des dossiers signés, en pourcentage : la marge que la remise vient réduire.';
comment on column buta.mart_remises.periode_complete is 'Vrai quand la fin de période précède la journée publiée d''au moins 45 jours : le taux de signature n''est plus tronqué.';

grant select on buta.mart_remises to anon, authenticated, analyste_ro;
