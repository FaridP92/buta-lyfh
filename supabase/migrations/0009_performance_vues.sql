-- 0009 : performance des vues sous le statement_timeout de 8 s du role anon (PostgREST).
-- 1. buta.journee_publiee() etait evaluee par ligne (le set search_path de 0005 empeche l'inlining
--    et le planificateur aplatit la sous-requete) : la journee est calculee une fois par CTE materialized.
-- 2. Le carnet de mart_pose faisait trois sous-requetes correlees par cellule semaine x agence :
--    jointure ensembliste dossiers signes x semaines en attente.
-- 3. mart_alertes lit mart_pose en un seul balayage (derniere semaine et mediane douze semaines).
-- Mesure avant : mart_kpi_mensuel 2,3 s, mart_pose 4,8 s, mart_alertes au-dela de 8 s.

create or replace view buta.dossier_a_date as
with j as materialized (select buta.journee_publiee() as j)
select
  d.id, d.agence, d.commercial, d.canal, d.produit, d.produit_libelle_source, d.departement, d.empreinte_contact,
  d.date_lead,
  case when d.date_rdv_planifie <= j.j then d.date_rdv_planifie end as date_rdv_planifie,
  case when d.date_rdv <= j.j then d.date_rdv end as date_rdv,
  case when d.date_devis <= j.j then d.date_devis end as date_devis,
  case when d.date_devis <= j.j then d.montant_devis end as montant_devis,
  case when d.date_signature <= j.j then d.date_signature end as date_signature,
  case when d.date_pose <= j.j then d.date_pose end as date_pose,
  case when d.date_encaissement <= j.j then d.date_encaissement end as date_encaissement,
  case when d.date_annulation <= j.j then d.date_annulation end as date_annulation,
  d.date_pose as date_pose_prevue,
  d.date_annulation as date_annulation_finale,
  d.motif_annulation, d.statut, d.prix_catalogue, d.taux_remise,
  case when d.date_signature <= j.j then d.montant_ht end as montant_ht,
  d.cout_materiel, d.cout_pose, d.commission, d.aide_montant,
  case when d.aide_versee_le <= j.j then d.aide_versee_le end as aide_versee_le,
  d.technicien, j.j as journee
from buta.fait_dossier d
cross join j
where d.publie;
comment on view buta.dossier_a_date is 'Interne : dossiers publiés vus à la journée publiée. Non exposé.';

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
    coalesce(c.couts_acquisition, 0) as couts_acquisition, coalesce(ch.charges, 0) as charges,
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
select mois, agence, leads, ventes, ca_signe, ca_pose, encaisse, poses, marge_brute,
  case when ca_signe > 0 then round(100.0 * marge_brute / ca_signe, 1) end as taux_marge,
  case when ventes > 0 then round(ca_signe / ventes, 0) end as panier_moyen,
  case when prix_catalogue_total > 0 then round(100.0 * remises / prix_catalogue_total, 1) end as taux_remise,
  signatures_brutes, annulees_60j, cohorte_annulation_mature,
  case when signatures_brutes > 0 then round(100.0 * annulees_60j / signatures_brutes, 1) end as taux_annulation,
  delai_pose_median,
  couts_acquisition, commissions,
  marge_brute - couts_acquisition - commissions as marge_apres_acquisition,
  charges,
  marge_brute - couts_acquisition - commissions - charges as resultat,
  case when ca_signe > 0 then round(100.0 * (couts_acquisition + commissions) / ca_signe, 1) end as taux_cac,
  commerciaux_actifs, techniciens_actifs,
  case when commerciaux_actifs > 0 then round(ventes::numeric / commerciaux_actifs, 2) end as productivite_commerciale,
  objectif_ventes, objectif_ca,
  case when objectif_ca > 0 then round(100.0 * (ca_signe - objectif_ca) / objectif_ca, 1) end as ecart_objectif_pct
from agrege;
comment on view buta.mart_kpi_mensuel is 'Indicateurs mensuels d''événement par agence (et RESEAU) : leads, ventes signées hors annulées à date, CA signé HT net de remise, CA posé, encaissé, marge brute, taux de marge, panier moyen, taux de remise, taux d''annulation à 60 jours, coûts d''acquisition, commissions, marge après acquisition, charges, résultat d''agence, poids de l''acquisition, effectifs actifs, productivité commerciale, objectif. Données d''activité simulées.';
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
comparaisons as (
  select 'objectif' as comparaison, mois, agence, produit, ventes, cat, tx from objectif_agrege
  union all
  select 'n1', (mois + interval '1 year')::date, agence, produit, ventes, cat, tx from realise_agrege
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
  round(100 * tx1, 2) as taux_remise, round(100 * tx0, 2) as taux_remise_comparaison
from calcul
where v1 > 0 or v0 > 0;
comment on view buta.mart_ecarts is 'ECART_CA : décomposition de l''écart de chiffre d''affaires signé du mois (agence ou RESEAU) contre l''objectif ou N-1, en euros : effet volume, effet mix, effet prix, effet remise, résiduel (nul par construction avec un taux de remise moyen pondéré). N-1 n''existe pas pour 2025. Données simulées.';
comment on column buta.mart_ecarts.effet_volume is '(V1 - V0) x prix net moyen de la comparaison, en euros.';
comment on column buta.mart_ecarts.effet_mix is 'V1 x somme sur les produits de (part1 - part0) x prix catalogue de la comparaison x (1 - taux de remise de la comparaison), en euros.';
comment on column buta.mart_ecarts.effet_prix is 'V1 x somme de part1 x (prix catalogue réalisé - prix catalogue de la comparaison) x (1 - taux de remise de la comparaison), en euros.';
comment on column buta.mart_ecarts.effet_remise is 'V1 x prix catalogue moyen réalisé x (taux de remise de la comparaison - taux de remise réalisé), en euros.';

create or replace view buta.mart_couts_acquisition as
with j as materialized (select buta.journee_publiee() as j),
cohortes as (
  select date_trunc('month', date_lead)::date as mois, agence, canal,
    count(*) as leads,
    count(date_rdv) as rdv_tenus,
    count(date_signature) filter (where date_annulation is null) as ventes,
    sum(montant_ht) filter (where date_annulation is null) as ca_signe,
    percentile_cont(0.5) within group (order by date_rdv - date_lead) as delai_lead_rdv_median
  from buta.dossier_a_date group by 1, 2, 3
),
couts as (
  select mois, agence, canal, sum(montant) as cout from buta.fait_cout_canal, j where mois <= j.j group by 1, 2, 3
),
base as (
  select coalesce(c.mois, k.mois) as mois, coalesce(c.agence, k.agence) as agence, coalesce(c.canal, k.canal) as canal,
    coalesce(k.leads, 0) as leads, coalesce(k.rdv_tenus, 0) as rdv_tenus, coalesce(k.ventes, 0) as ventes,
    coalesce(k.ca_signe, 0) as ca_signe, coalesce(c.cout, 0) as cout, k.delai_lead_rdv_median
  from couts c full join cohortes k on k.mois = c.mois and k.agence = c.agence and k.canal = c.canal
),
agrege as (
  select mois, coalesce(agence, 'RESEAU') as agence, coalesce(canal, 'TOUS') as canal,
    sum(leads) as leads, sum(rdv_tenus) as rdv_tenus, sum(ventes) as ventes, sum(ca_signe) as ca_signe, sum(cout) as cout,
    case when grouping(agence, canal) = 0 then max(delai_lead_rdv_median) end as delai_lead_rdv_median
  from base group by grouping sets ((mois, agence, canal), (mois, agence), (mois, canal), (mois))
),
avec_ratios as (
  select *, case when leads > 0 then round(cout / leads, 0) end as cout_par_lead,
    case when ventes > 0 then round(cout / ventes, 0) end as cout_par_vente,
    case when leads > 0 then round(100.0 * rdv_tenus / leads, 1) end as taux_rdv,
    case when leads > 0 then round(100.0 * ventes / leads, 1) end as taux_conversion
  from agrege
)
select a.*,
  m.mediane as cout_par_vente_median_mois,
  a.cout_par_vente > 1.3 * m.mediane as a_revoir
from avec_ratios a
left join (
  select mois, agence, (percentile_cont(0.5) within group (order by cout_par_vente))::numeric as mediane
  from avec_ratios where canal <> 'TOUS' and cout_par_vente > 0 group by 1, 2
) m on m.mois = a.mois and m.agence = a.agence;
comment on view buta.mart_couts_acquisition is 'Coûts d''acquisition par mois de création du lead, agence et canal (avec RESEAU et TOUS) : coût du canal, leads, RDV tenus, ventes de la cohorte, CA signé, coût par lead (CPL), coût par vente (CPV), taux de RDV, conversion, délai lead vers RDV, et pastille à revoir quand le CPV dépasse 1,3 fois la médiane des canaux du mois. Commissions commerciales exclues (voir mart_kpi_mensuel). Données simulées.';
comment on column buta.mart_couts_acquisition.cout_par_lead is 'CPL : coût du canal / leads du canal, en euros.';
comment on column buta.mart_couts_acquisition.cout_par_vente is 'CPV : coût du canal / ventes de la cohorte issue du canal, en euros.';

create or replace view buta.mart_encaissement as
with j as materialized (select buta.journee_publiee() as j),
grille as (
  select m.mois, a.code as agence from (select distinct mois from buta.dim_date, j where mois <= date_trunc('month', j.j)::date) m cross join buta.dim_agence a
),
enc as (
  select date_trunc('month', date_encaissement)::date as mois, agence, sum(montant_ht) as encaisse, count(*) as encaissements,
    percentile_cont(0.5) within group (order by date_encaissement - date_pose) as delai_pose_encaissement_median
  from buta.dossier_a_date where date_encaissement is not null group by 1, 2
),
attente as (
  select agence,
    sum(montant_ht) filter (where date_pose is not null and date_encaissement is null) as en_attente_encaissement,
    count(*) filter (where date_pose is not null and date_encaissement is null and date_pose <= journee - 30) as retards_encaissement,
    sum(aide_montant) filter (where date_pose is not null and aide_montant > 0 and aide_versee_le is null) as aides_en_attente
  from buta.dossier_a_date group by 1
),
base as (
  select g.mois, g.agence, coalesce(e.encaisse, 0) as encaisse, coalesce(e.encaissements, 0) as encaissements, e.delai_pose_encaissement_median,
    case when g.mois = (select date_trunc('month', j) from j) then coalesce(a.en_attente_encaissement, 0) end as en_attente_encaissement,
    case when g.mois = (select date_trunc('month', j) from j) then coalesce(a.retards_encaissement, 0) end as retards_encaissement,
    case when g.mois = (select date_trunc('month', j) from j) then coalesce(a.aides_en_attente, 0) end as aides_en_attente
  from grille g left join enc e on e.mois = g.mois and e.agence = g.agence left join attente a on a.agence = g.agence
)
select mois, coalesce(agence, 'RESEAU') as agence, sum(encaisse) as encaisse, sum(encaissements) as encaissements,
  case when grouping(agence) = 0 then max(delai_pose_encaissement_median) else percentile_cont(0.5) within group (order by delai_pose_encaissement_median) end as delai_pose_encaissement_median,
  sum(en_attente_encaissement) as en_attente_encaissement, sum(retards_encaissement) as retards_encaissement, sum(aides_en_attente) as aides_en_attente
from base group by grouping sets ((mois, agence), (mois));
comment on view buta.mart_encaissement is 'Encaissement par mois et agence (avec RESEAU) : encaissé (ENCAISSE), nombre d''encaissements, délai médian pose vers encaissement (D_ENCAISSE) ; sur le mois courant : montant posé en attente d''encaissement, retards (posés depuis plus de 30 jours), aides simulées en attente (AIDES_ATT, mandat financier). Données simulées.';

create or replace view buta.mart_pose as
with j as materialized (select buta.journee_publiee() as j),
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
  select s.semaine, d.agence,
    sum(p.duree_pose_jt) as carnet_jt,
    count(*) as dossiers_a_poser,
    count(*) filter (where d.date_signature <= s.semaine + 6 - case when d.departement in ('16', '17', '33', '40', '59') then 60 else 90 end) as poses_en_retard
  from semaines s
  cross join j
  join buta.fait_dossier d on d.publie and d.date_signature is not null and d.date_signature <= s.semaine + 6
    and (d.date_pose is null or d.date_pose > s.semaine + 6)
    and (d.date_annulation is null or d.date_annulation > s.semaine + 6)
  join buta.dim_produit p on p.code = d.produit
  where s.semaine <= j.j
  group by 1, 2
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
