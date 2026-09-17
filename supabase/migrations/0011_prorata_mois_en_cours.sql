-- 0011 : prorata du mois en cours. Le mois de la journée publiée n'est pas complet : comparer son
-- réalisé à un objectif de mois entier est faux. mart_kpi_mensuel expose jours_publies, jours_mois et
-- prorata (1 pour un mois complet) ; mart_ecarts applique ce prorata à la comparaison (objectif ou N-1)
-- du mois en cours et l'expose.

create or replace function buta.prorata_mois(p_mois date)
returns numeric
language sql
stable
set search_path = buta, public
as $$
  select case
    when date_trunc('month', buta.journee_publiee())::date = p_mois
      then round(extract(day from buta.journee_publiee())::numeric / extract(day from (p_mois + interval '1 month - 1 day'))::numeric, 4)
    when p_mois > buta.journee_publiee() then 0
    else 1 end;
$$;
comment on function buta.prorata_mois(date) is 'Part du mois déjà publiée : jours publiés / jours du mois pour le mois en cours, 1 pour un mois complet, 0 pour un mois futur.';

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
  extract(day from (a.mois + interval '1 month - 1 day')::date)::int as jours_mois
from agrege a cross join j;
comment on view buta.mart_kpi_mensuel is 'Indicateurs mensuels d''événement par agence (et RESEAU) : leads, ventes signées hors annulées à date, CA signé HT net de remise, CA posé, encaissé, marge brute, taux de marge, panier moyen, taux de remise, taux d''annulation à 60 jours, coûts d''acquisition et charges (au prorata des jours publiés pour le mois en cours), commissions, marge après acquisition, résultat d''agence, poids de l''acquisition, effectifs actifs, productivité commerciale, objectif du mois entier, prorata (jours publiés / jours du mois, 1 pour un mois complet) et écart à l''objectif proratisé. Données d''activité simulées.';
comment on column buta.mart_kpi_mensuel.prorata is 'Part du mois publiée : jours publiés / jours du mois ; 1 pour un mois complet. À appliquer à l''objectif et à N-1 avant de comparer le mois en cours.';
comment on column buta.mart_kpi_mensuel.ecart_objectif_pct is 'Écart du CA signé à l''objectif proratisé des jours publiés, en pourcentage.';
comment on column buta.mart_kpi_mensuel.mois is 'Premier jour du mois de l''événement (signature, pose, encaissement selon la mesure).';
comment on column buta.mart_kpi_mensuel.agence is 'Code agence simulée, ou RESEAU pour le total.';
comment on column buta.mart_kpi_mensuel.ventes is 'VENTES : signatures du mois hors annulées à date.';
comment on column buta.mart_kpi_mensuel.ca_signe is 'CA_SIGNE : somme des montants HT nets de remise des ventes signées, en euros.';
comment on column buta.mart_kpi_mensuel.ca_pose is 'CA_POSE : montants HT des poses du mois, en euros.';
comment on column buta.mart_kpi_mensuel.encaisse is 'ENCAISSE : encaissements du mois, en euros.';
comment on column buta.mart_kpi_mensuel.marge_brute is 'MARGE : CA signé moins coût matériel moins coût de pose, en euros.';
comment on column buta.mart_kpi_mensuel.taux_marge is 'TX_MARGE : marge brute / CA signé, en pourcentage.';
comment on column buta.mart_kpi_mensuel.panier_moyen is 'PANIER : CA signé / ventes, en euros.';
comment on column buta.mart_kpi_mensuel.taux_remise is 'REMISE : somme des remises / somme des prix catalogue, en pourcentage.';
comment on column buta.mart_kpi_mensuel.taux_annulation is 'TX_ANNUL : annulés dans les 60 jours / signatures du mois, en pourcentage (cohorte de signature).';
comment on column buta.mart_kpi_mensuel.marge_apres_acquisition is 'MARGE_ACQ : marge brute moins coûts d''acquisition moins commissions, en euros.';
comment on column buta.mart_kpi_mensuel.resultat is 'RESULTAT : marge après acquisition moins charges d''agence, en euros.';
comment on column buta.mart_kpi_mensuel.taux_cac is 'TX_CAC : (coûts d''acquisition + commissions) / CA signé, en pourcentage.';
comment on column buta.mart_kpi_mensuel.productivite_commerciale is 'PROD_COM : ventes / commerciaux actifs.';
comment on column buta.mart_kpi_mensuel.delai_pose_median is 'D_SIGN_POSE : médiane en jours du délai signature vers pose des poses du mois.';

create or replace view buta.mart_ecarts as
with j as materialized (select buta.journee_publiee() as j),
realise as (
  select date_trunc('month', date_signature)::date as mois, agence, produit,
    count(*)::numeric as ventes, avg(prix_catalogue) as cat, avg(taux_remise) as tx, sum(montant_ht) as ca
  from buta.dossier_a_date
  where date_signature is not null and date_annulation is null
  group by 1, 2, 3
),
realise_agrege as (
  select mois, coalesce(agence, 'RESEAU') as agence, produit,
    sum(ventes) as ventes, sum(ventes * cat) / nullif(sum(ventes), 0) as cat,
    sum(ventes * cat * tx) / nullif(sum(ventes * cat), 0) as tx, sum(ca) as ca
  from realise group by grouping sets ((mois, agence, produit), (mois, produit))
),
objectif_agrege as (
  select mois, coalesce(agence, 'RESEAU') as agence, produit,
    sum(ventes) as ventes, sum(ventes * prix_catalogue_cible) / nullif(sum(ventes), 0) as cat,
    sum(ventes * prix_catalogue_cible * taux_remise_cible) / nullif(sum(ventes * prix_catalogue_cible), 0) as tx
  from buta.objectif group by grouping sets ((mois, agence, produit), (mois, produit))
),
-- La comparaison est proratisée pour le mois en cours (volumes seulement : prix et remises restent des moyennes).
comparaisons as (
  select 'objectif' as comparaison, mois, agence, produit, ventes * buta.prorata_mois(mois) as ventes, cat, tx from objectif_agrege
  union all
  select 'n1', (mois + interval '1 year')::date, agence, produit, ventes * buta.prorata_mois((mois + interval '1 year')::date), cat, tx from realise_agrege
),
cles as (
  select r.mois, r.agence, c.comparaison, r.produit
  from realise_agrege r cross join (values ('objectif'), ('n1')) as c(comparaison)
  union
  select c.mois, c.agence, c.comparaison, c.produit from comparaisons c
),
paires as (
  select k.mois, k.agence, k.comparaison, k.produit,
    coalesce(r.ventes, 0) as v1, coalesce(c.ventes, 0) as v0,
    coalesce(r.cat, c.cat) as cat1, coalesce(c.cat, r.cat) as cat0,
    coalesce(r.tx, 0) as tx1_p
  from cles k
  cross join j
  left join realise_agrege r on r.mois = k.mois and r.agence = k.agence and r.produit = k.produit
  left join comparaisons c on c.mois = k.mois and c.agence = k.agence and c.comparaison = k.comparaison and c.produit = k.produit
  where k.mois <= date_trunc('month', j.j)::date and k.mois >= date '2025-01-01'
),
totaux as (
  select mois, agence, comparaison,
    sum(v1) as v1, sum(v0) as v0,
    sum(v1 * cat1 * tx1_p) / nullif(sum(v1 * cat1), 0) as tx1
  from paires group by 1, 2, 3
),
tx0 as (
  select c.mois, c.agence, c.comparaison, c.tx as tx0
  from (select comparaison, mois, agence, sum(ventes * cat * tx) / nullif(sum(ventes * cat), 0) as tx
        from comparaisons group by 1, 2, 3) c
),
calcul as (
  select p.mois, p.agence, p.comparaison, t.v1, t.v0, t.tx1, coalesce(x.tx0, t.tx1) as tx0,
    sum(case when t.v0 > 0 then p.v0 / t.v0 else 0 end * p.cat0 * (1 - coalesce(x.tx0, t.tx1))) as pn0,
    sum(case when t.v1 > 0 then p.v1 / t.v1 else 0 end * p.cat1 * (1 - t.tx1)) as pn1,
    t.v1 * sum((case when t.v1 > 0 then p.v1 / t.v1 else 0 end - case when t.v0 > 0 then p.v0 / t.v0 else 0 end) * p.cat0 * (1 - coalesce(x.tx0, t.tx1))) as effet_mix,
    t.v1 * sum(case when t.v1 > 0 then p.v1 / t.v1 else 0 end * (p.cat1 - p.cat0) * (1 - coalesce(x.tx0, t.tx1))) as effet_prix,
    t.v1 * sum(case when t.v1 > 0 then p.v1 / t.v1 else 0 end * p.cat1) * (coalesce(x.tx0, t.tx1) - t.tx1) as effet_remise
  from paires p
  join totaux t on t.mois = p.mois and t.agence = p.agence and t.comparaison = p.comparaison
  left join tx0 x on x.mois = p.mois and x.agence = p.agence and x.comparaison = p.comparaison
  group by p.mois, p.agence, p.comparaison, t.v1, t.v0, t.tx1, x.tx0
)
select mois, agence, comparaison,
  v0 > 0 as comparaison_disponible,
  case when v0 = 0 and comparaison = 'n1' and mois < date '2026-01-01' then 'n. d., pas d''historique 2024'
       when v0 = 0 then 'n. d., pas de comparaison pour ce mois' end as motif,
  round(v1, 0) as ventes, round(v0, 1) as ventes_comparaison,
  round(v1 * pn1, 0) as ca_realise, round(v0 * pn0, 0) as ca_comparaison,
  round(v1 * pn1 - v0 * pn0, 0) as ecart_total,
  round((v1 - v0) * pn0, 0) as effet_volume,
  round(effet_mix, 0) as effet_mix,
  round(effet_prix, 0) as effet_prix,
  round(effet_remise, 0) as effet_remise,
  round((v1 * pn1 - v0 * pn0) - ((v1 - v0) * pn0 + effet_mix + effet_prix + effet_remise), 0) as residuel,
  round(100 * tx1, 2) as taux_remise, round(100 * tx0, 2) as taux_remise_comparaison,
  buta.prorata_mois(mois) as prorata
from calcul
where v1 > 0 or v0 > 0;
comment on view buta.mart_ecarts is 'ECART_CA : décomposition de l''écart de chiffre d''affaires signé du mois (agence ou RESEAU) contre l''objectif ou N-1, en euros : effet volume, effet mix, effet prix, effet remise, résiduel (nul par construction avec un taux de remise moyen pondéré). Pour le mois en cours, les volumes de la comparaison sont proratisés des jours publiés (colonne prorata). N-1 n''existe pas pour 2025. Données simulées.';
comment on column buta.mart_ecarts.prorata is 'Part du mois publiée appliquée aux volumes de la comparaison ; 1 pour un mois complet.';
comment on column buta.mart_ecarts.effet_volume is '(V1 - V0) x prix net moyen de la comparaison, en euros.';
comment on column buta.mart_ecarts.effet_mix is 'V1 x somme sur les produits de (part1 - part0) x prix catalogue de la comparaison x (1 - taux de remise de la comparaison), en euros.';
comment on column buta.mart_ecarts.effet_prix is 'V1 x somme de part1 x (prix catalogue réalisé - prix catalogue de la comparaison) x (1 - taux de remise de la comparaison), en euros.';
comment on column buta.mart_ecarts.effet_remise is 'V1 x prix catalogue moyen réalisé x (taux de remise de la comparaison - taux de remise réalisé), en euros.';
grant execute on function buta.prorata_mois(date) to anon, authenticated, analyste_ro;
