-- 0003 : les seize vues mart_ (DONNEES.md §4.5, INDICATEURS.md), seules sources des chiffres affiches.
-- Chaque vue ne lit que les dossiers publies et ne renvoie que des agregats. Les vues sont creees
-- sans security_invoker (droits du proprietaire postgres) : c'est voulu, l'advisor
-- security_definer_view est assume. Tout evenement posterieur a la journee publiee est ignore
-- (buta.journee_publiee()), pour que le "realise" ne contienne jamais le futur simule.

create or replace function buta.journee_publiee()
returns date
language sql
stable
as $$
  select coalesce(
    (select date_reference from buta.source_fraicheur where source = 'journee_simulee'),
    current_date - 1);
$$;
comment on function buta.journee_publiee() is 'Dernière journée simulée publiée (source_fraicheur.journee_simulee) ; à défaut, la veille.';

-- Fonction de repartition normale standard (approximation d'Abramowitz et Stegun, erreur < 1e-7),
-- pour la probabilite d'atteinte de l'objectif.
create or replace function buta.phi(z double precision)
returns double precision
language sql
immutable
as $$
  select case
    when z is null then null
    when z < -8 then 0.0
    when z > 8 then 1.0
    else (
      with c as (select abs(z) as x, 1.0 / (1.0 + 0.2316419 * abs(z)) as t)
      select case when z >= 0 then 1.0 - p else p end
      from (
        select (1.0 / sqrt(2 * pi())) * exp(-x * x / 2.0) *
          (0.319381530 * t - 0.356563782 * power(t, 2) + 1.781477937 * power(t, 3)
           - 1.821255978 * power(t, 4) + 1.330274429 * power(t, 5)) as p
        from c) s)
  end;
$$;

-- Dossiers publies, vus a la journee publiee : les dates posterieures sont masquees.
create or replace view buta.dossier_a_date as
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
cross join (select buta.journee_publiee() as j) j
where d.publie;
comment on view buta.dossier_a_date is 'Interne : dossiers publiés vus à la journée publiée. Non exposé.';

-- ---------------------------------------------------------------------------
-- mart_kpi_mensuel : mois x agence (+ RESEAU), mesures d'evenement
-- ---------------------------------------------------------------------------
create or replace view buta.mart_kpi_mensuel as
with j as (select buta.journee_publiee() as j),
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

-- ---------------------------------------------------------------------------
-- mart_funnel : cohortes (mois de creation x agence x canal, + totaux), materialisee
-- ---------------------------------------------------------------------------
create materialized view buta.mart_funnel as
with j as (select buta.journee_publiee() as j),
cohortes as (
  select date_trunc('month', date_lead)::date as mois, agence, canal,
    count(*) as leads,
    count(date_rdv_planifie) as rdv_planifies,
    count(date_rdv) as rdv_tenus,
    count(date_devis) as devis,
    count(date_signature) as signatures,
    count(date_signature) filter (where date_annulation_finale is null or date_annulation_finale - date_signature > 90 or date_annulation_finale > journee) as signatures_nettes,
    count(date_pose) as poses,
    count(date_encaissement) as encaissements,
    sum(montant_devis) as montant_devis,
    sum(montant_ht) filter (where date_annulation is null) as ca_signe,
    percentile_cont(0.5) within group (order by date_rdv - date_lead) as delai_lead_rdv_median,
    count(*) filter (where date_rdv_planifie is null and date_lead <= journee - 2) as sans_rdv_48h
  from buta.dossier_a_date
  group by 1, 2, 3
),
agrege as (
  select mois, coalesce(agence, 'RESEAU') as agence, coalesce(canal, 'TOUS') as canal,
    sum(leads) as leads, sum(rdv_planifies) as rdv_planifies, sum(rdv_tenus) as rdv_tenus, sum(devis) as devis,
    sum(signatures) as signatures, sum(signatures_nettes) as signatures_nettes, sum(poses) as poses,
    sum(encaissements) as encaissements, sum(montant_devis) as montant_devis, sum(ca_signe) as ca_signe,
    case when grouping(agence, canal) = 0 then max(delai_lead_rdv_median) end as delai_lead_rdv_median,
    sum(sans_rdv_48h) as sans_rdv_48h
  from cohortes
  group by grouping sets ((mois, agence, canal), (mois, agence), (mois, canal), (mois))
)
select a.mois, a.agence, a.canal, a.leads, a.rdv_planifies, a.rdv_tenus, a.devis, a.signatures, a.signatures_nettes,
  a.poses, a.encaissements, a.montant_devis, a.ca_signe, a.delai_lead_rdv_median, a.sans_rdv_48h,
  case when a.leads > 0 then round(100.0 * a.rdv_tenus / a.leads, 1) end as taux_rdv,
  case when a.rdv_tenus > 0 then round(100.0 * a.devis / a.rdv_tenus, 1) end as taux_devis,
  case when a.devis > 0 then round(100.0 * a.signatures / a.devis, 1) end as taux_signature,
  case when a.leads > 0 then round(100.0 * a.signatures_nettes / a.leads, 1) end as taux_conversion,
  (a.mois + interval '1 month')::date + 90 <= j.j as cohorte_mature
from agrege a cross join j;
comment on materialized view buta.mart_funnel is 'Funnel par cohorte de création du lead (mois x agence x canal, avec RESEAU et TOUS) : leads, RDV planifiés, RDV tenus, devis, signatures, signatures nettes d''annulation à 90 jours, poses, encaissements, taux entre étapes, conversion lead vers vente, délai lead vers RDV, leads sans RDV à 48 h. cohorte_mature : vrai quand la cohorte a plus de 90 jours. Données simulées.';
comment on column buta.mart_funnel.taux_rdv is 'TX_RDV : RDV tenus / leads, en pourcentage.';
comment on column buta.mart_funnel.taux_devis is 'TX_DEVIS : devis / RDV tenus, en pourcentage.';
comment on column buta.mart_funnel.taux_signature is 'TX_SIGN : signatures / devis, en pourcentage.';
comment on column buta.mart_funnel.taux_conversion is 'TX_CONV : signatures nettes à 90 jours / leads, en pourcentage.';
comment on column buta.mart_funnel.delai_lead_rdv_median is 'D_LEAD_RDV : médiane en jours entre le lead et le RDV tenu.';
comment on column buta.mart_funnel.sans_rdv_48h is 'ATTENTE48 : leads créés depuis plus de 48 heures sans RDV planifié, à date.';
create unique index mart_funnel_cle on buta.mart_funnel (mois, agence, canal);

-- ---------------------------------------------------------------------------
-- mart_ventes_produit : mois de signature x agence x produit (+ totaux), materialisee
-- ---------------------------------------------------------------------------
create materialized view buta.mart_ventes_produit as
with ventes as (
  select date_trunc('month', date_signature)::date as mois, agence, produit,
    count(*) filter (where date_annulation is null) as ventes,
    count(*) as signatures_brutes,
    count(*) filter (where date_annulation_finale is not null and date_annulation_finale - date_signature <= 60 and date_annulation_finale <= journee) as annulees_60j,
    sum(montant_ht) filter (where date_annulation is null) as ca_signe,
    sum(prix_catalogue) filter (where date_annulation is null) as prix_catalogue_total,
    sum(prix_catalogue * taux_remise) filter (where date_annulation is null) as remises,
    sum(montant_ht - cout_materiel - cout_pose) filter (where date_annulation is null) as marge_brute,
    count(*) filter (where date_annulation_finale is not null and date_annulation_finale <= journee and departement not in ('16', '17', '33', '40', '59')) as annulees_a_distance,
    count(*) filter (where departement not in ('16', '17', '33', '40', '59')) as signatures_a_distance
  from buta.dossier_a_date
  where date_signature is not null
  group by 1, 2, 3
)
select mois, coalesce(agence, 'RESEAU') as agence, coalesce(produit, 'TOUS') as produit,
  sum(ventes) as ventes, sum(signatures_brutes) as signatures_brutes, sum(annulees_60j) as annulees_60j,
  sum(ca_signe) as ca_signe, sum(marge_brute) as marge_brute,
  case when sum(ca_signe) > 0 then round(100.0 * sum(marge_brute) / sum(ca_signe), 1) end as taux_marge,
  case when sum(ventes) > 0 then round(sum(ca_signe) / sum(ventes), 0) end as panier_moyen,
  case when sum(ventes) > 0 then round(sum(prix_catalogue_total) / sum(ventes), 0) end as prix_catalogue_moyen,
  case when sum(prix_catalogue_total) > 0 then round(100.0 * sum(remises) / sum(prix_catalogue_total), 2) end as taux_remise,
  case when sum(signatures_brutes) > 0 then round(100.0 * sum(annulees_60j) / sum(signatures_brutes), 1) end as taux_annulation,
  sum(signatures_a_distance) as signatures_a_distance,
  case when sum(signatures_a_distance) > 0 then round(100.0 * sum(annulees_a_distance) / sum(signatures_a_distance), 1) end as taux_annulation_a_distance,
  case when sum(signatures_brutes) - sum(signatures_a_distance) > 0
    then round(100.0 * (sum(annulees_60j) - sum(annulees_a_distance)) / (sum(signatures_brutes) - sum(signatures_a_distance)), 1) end as taux_annulation_sur_place
from ventes
group by grouping sets ((mois, agence, produit), (mois, agence), (mois, produit), (mois));
comment on materialized view buta.mart_ventes_produit is 'Ventes par mois de signature, agence et produit (avec RESEAU et TOUS) : ventes hors annulées, CA signé HT, marge brute, taux de marge, panier, prix catalogue moyen, taux de remise, taux d''annulation à 60 jours, et taux d''annulation des départements couverts à distance contre ceux avec agence. Données simulées.';
comment on column buta.mart_ventes_produit.taux_annulation_a_distance is 'Taux d''annulation des signatures des départements sans agence (79, 85, 24, 47, 32, 64), en pourcentage.';
create unique index mart_ventes_produit_cle on buta.mart_ventes_produit (mois, agence, produit);

-- ---------------------------------------------------------------------------
-- mart_ecarts : decomposition de l'ecart de CA (mois x agence + RESEAU x comparaison)
-- ---------------------------------------------------------------------------
create or replace view buta.mart_ecarts as
with j as (select buta.journee_publiee() as j),
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

-- ---------------------------------------------------------------------------
-- mart_couts_acquisition : mois de creation x agence x canal (+ totaux)
-- ---------------------------------------------------------------------------
create or replace view buta.mart_couts_acquisition as
with j as (select buta.journee_publiee() as j),
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

-- ---------------------------------------------------------------------------
-- mart_delais : mois de pose x agence x departement (+ totaux)
-- ---------------------------------------------------------------------------
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
group by grouping sets ((mois, agence, departement), (mois, agence), (mois, departement), (mois));
comment on view buta.mart_delais is 'Délais par mois de pose, agence et département (avec RESEAU et TOUS) : médianes en jours signature vers pose (D_SIGN_POSE), pose vers encaissement (D_ENCAISSE), lead vers RDV, devis vers signature ; part des poses à moins de 60 jours (POSE_DELAI) ; couvert_a_distance vrai pour les départements sans agence. Données simulées.';

-- ---------------------------------------------------------------------------
-- mart_pose : semaine x agence (+ RESEAU) : charge, capacite, carnet
-- ---------------------------------------------------------------------------
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
      where d.publie and d.agence = g.agence and d.date_signature <= g.semaine + 6 - 60
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
comment on view buta.mart_pose is 'Pose par semaine et agence (avec RESEAU) : techniciens actifs, capacité en jours-technicien, poses réalisées et jours-technicien posés, productivité de pose (PROD_TECH), poses planifiées et charge planifiée après la journée publiée, carnet de pose en jours-technicien et en jours ouvrés (CARNET = charge restante / (techniciens x 0,8)), dossiers à poser, poses en retard (signées depuis plus de 60 jours). Données simulées.';
comment on column buta.mart_pose.carnet_jours_ouvres is 'CARNET : ventes signées non posées x durée de pose du produit / (techniciens actifs x 0,8), en jours ouvrés.';

-- ---------------------------------------------------------------------------
-- mart_encaissement : mois x agence (+ RESEAU)
-- ---------------------------------------------------------------------------
create or replace view buta.mart_encaissement as
with j as (select buta.journee_publiee() as j),
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

-- ---------------------------------------------------------------------------
-- mart_forecast : annee x agence (+ RESEAU), materialisee
-- ---------------------------------------------------------------------------
create materialized view buta.mart_forecast as
with j as (select buta.journee_publiee() as j, date_trunc('month', buta.journee_publiee())::date as mois_courant),
mensuel as (
  select date_trunc('month', date_signature)::date as mois, coalesce(agence, 'RESEAU') as agence, sum(montant_ht) as ca
  from buta.dossier_a_date where date_signature is not null and date_annulation is null
  group by grouping sets ((date_trunc('month', date_signature)::date, agence), (date_trunc('month', date_signature)::date))
),
agences as (select code as agence from buta.dim_agence union all select 'RESEAU'),
annees as (select 2025 as annee union all select 2026),
realise as (
  select a.agence, an.annee, coalesce(sum(m.ca), 0) as realise_a_date,
    coalesce(sum(m.ca) filter (where m.mois < (select mois_courant from j)), 0) as realise_mois_complets
  from agences a cross join annees an
  left join mensuel m on m.agence = a.agence and extract(year from m.mois) = an.annee
  group by 1, 2
),
objectif as (
  select coalesce(agence, 'RESEAU') as agence, extract(year from mois)::int as annee,
    sum(ventes * prix_catalogue_cible * (1 - taux_remise_cible)) as objectif_annuel
  from buta.objectif group by grouping sets ((agence, extract(year from mois)::int), (extract(year from mois)::int))
),
run_rate as (
  select a.agence,
    coalesce((select avg(m.ca) from mensuel m where m.agence = a.agence and m.mois >= (select mois_courant - interval '3 months' from j) and m.mois < (select mois_courant from j)), 0) as run_rate_3m,
    coalesce((select stddev_samp(m.ca) from mensuel m where m.agence = a.agence and m.mois >= (select mois_courant - interval '12 months' from j) and m.mois < (select mois_courant from j)), 0) as sigma_mensuel
  from agences a
),
saisonnalite as (
  select agence, extract(month from mois)::int as mois_num, ca / nullif(avg(ca) over (partition by agence), 0) as coefficient
  from mensuel where extract(year from mois) = 2025
),
tranches as (
  select coalesce(agence, 'RESEAU') as agence,
    count(*) filter (where date_signature is not null and date_signature - date_devis <= 30) as s0_30,
    count(*) filter (where date_signature is null or date_signature - date_devis > 0) as ouverts_0,
    count(*) filter (where date_signature is not null and date_signature - date_devis between 31 and 60) as s31_60,
    count(*) filter (where date_signature is null or date_signature - date_devis > 30) as ouverts_30,
    count(*) filter (where date_signature is not null and date_signature - date_devis between 61 and 90) as s61_90,
    count(*) filter (where date_signature is null or date_signature - date_devis > 60) as ouverts_60,
    count(*) filter (where date_signature is not null) as signes,
    count(*) filter (where date_signature is not null and date_annulation_finale is not null and date_annulation_finale - date_signature <= 180 and date_annulation_finale <= journee) as annules_6m
  from buta.dossier_a_date
  where date_devis is not null and date_devis between journee - 455 and journee - 90
  group by grouping sets ((agence), ())
),
pipe as (
  select coalesce(d.agence, 'RESEAU') as agence,
    sum(d.montant_devis * case
      when d.journee - d.date_devis <= 30 then coalesce(t.s0_30::numeric / nullif(t.ouverts_0, 0), 0)
      when d.journee - d.date_devis <= 60 then coalesce(t.s31_60::numeric / nullif(t.ouverts_30, 0), 0)
      else coalesce(t.s61_90::numeric / nullif(t.ouverts_60, 0), 0) end
      * (1 - coalesce(t.annules_6m::numeric / nullif(t.signes, 0), 0))) as pipe_pondere,
    count(*) as devis_en_cours, sum(d.montant_devis) as montant_devis_en_cours
  from buta.dossier_a_date d
  join tranches t on t.agence = coalesce(d.agence, 'RESEAU')
  where d.date_devis is not null and d.date_signature is null and d.journee - d.date_devis <= 90
  group by grouping sets ((d.agence), ())
),
calcul as (
  select r.agence, r.annee, r.realise_a_date, coalesce(o.objectif_annuel, 0) as objectif_annuel,
    case when r.annee = extract(year from (select j from j)) then coalesce(p.pipe_pondere, 0) else 0 end as pipe_pondere,
    coalesce(p.devis_en_cours, 0) as devis_en_cours, coalesce(p.montant_devis_en_cours, 0) as montant_devis_en_cours,
    rr.run_rate_3m, rr.sigma_mensuel,
    case when r.annee = extract(year from (select j from j))
      then 12 - extract(month from (select j from j))::int else 0 end as mois_restants,
    case when r.annee = extract(year from (select j from j)) then (
      select coalesce(sum(rr.run_rate_3m * coalesce(s.coefficient, 1)), 0)
      from generate_series(extract(month from (select j from j))::int + 1, 12) as m(mois_num)
      left join saisonnalite s on s.agence = r.agence and s.mois_num = m.mois_num
      ) else 0 end as projection_run_rate
  from realise r
  left join objectif o on o.agence = r.agence and o.annee = r.annee
  left join pipe p on p.agence = r.agence
  left join run_rate rr on rr.agence = r.agence
)
select agence, annee, round(realise_a_date, 0) as realise_a_date, round(objectif_annuel, 0) as objectif_annuel,
  round(pipe_pondere, 0) as pipe_pondere, devis_en_cours, round(montant_devis_en_cours, 0) as montant_devis_en_cours,
  round(run_rate_3m, 0) as run_rate_3m, round(sigma_mensuel, 0) as sigma_mensuel, mois_restants,
  round(realise_a_date + pipe_pondere + projection_run_rate * greatest(mois_restants - 1.5, 0) / nullif(mois_restants, 0), 0) as atterrissage_central,
  round(realise_a_date + pipe_pondere + projection_run_rate * greatest(mois_restants - 1.5, 0) / nullif(mois_restants, 0) - sigma_mensuel * sqrt(mois_restants::numeric), 0) as atterrissage_bas,
  round(realise_a_date + pipe_pondere + projection_run_rate * greatest(mois_restants - 1.5, 0) / nullif(mois_restants, 0) + sigma_mensuel * sqrt(mois_restants::numeric), 0) as atterrissage_haut,
  case when objectif_annuel > 0 and mois_restants > 0 and sigma_mensuel > 0 then
    round(100 * buta.phi(((realise_a_date + pipe_pondere + projection_run_rate * greatest(mois_restants - 1.5, 0) / nullif(mois_restants, 0)) - objectif_annuel) / (sigma_mensuel * sqrt(mois_restants::numeric))) / 5) * 5
    when objectif_annuel > 0 and mois_restants = 0 then case when realise_a_date >= objectif_annuel then 100 else 0 end end as probabilite_atteinte,
  case when objectif_annuel > 0 then round(100.0 * (realise_a_date + pipe_pondere + projection_run_rate * greatest(mois_restants - 1.5, 0) / nullif(mois_restants, 0) - objectif_annuel) / objectif_annuel, 1) end as ecart_atterrissage_pct
from calcul;
comment on materialized view buta.mart_forecast is 'ATTERR : atterrissage annuel du CA signé par agence (et RESEAU) : réalisé à date, objectif annuel, pipe pondéré (PIPE_POND : devis en cours de moins de 90 jours x taux de signature observé par tranche d''âge sur 12 mois x (1 - taux d''annulation à 6 mois)), run-rate 3 mois saisonnalisé au-delà des 45 jours couverts par le pipe, bornes basse et haute à un écart-type mensuel x racine des mois restants (intervalle à 68 %), probabilité d''atteinte (P_ATTEINTE, loi normale sur le run-rate, arrondie à 5 points). Données simulées.';
comment on column buta.mart_forecast.probabilite_atteinte is 'P_ATTEINTE : probabilité que l''atterrissage dépasse l''objectif, en pourcentage arrondi à 5 points.';
create unique index mart_forecast_cle on buta.mart_forecast (agence, annee);

-- ---------------------------------------------------------------------------
-- mart_qualite : jour x controle, avec le score du jour
-- ---------------------------------------------------------------------------
create or replace view buta.mart_qualite as
with resultats as (
  select r.jour, r.controle, c.ordre, c.libelle, c.regle, c.bloquant, r.statut, r.nb_lignes, r.echantillon,
    case when c.bloquant then 3 else 1 end as poids
  from buta.controle_resultat r join buta.controle c on c.code = r.controle
),
scores as (
  select jour, round(100.0 * sum(poids) filter (where statut = 'ok') / sum(poids), 0) as score
  from resultats group by jour
)
select r.jour, r.controle, r.ordre, r.libelle, r.regle, r.bloquant, r.statut, r.nb_lignes, r.echantillon, s.score as score_jour,
  r.nb_lignes - lag(r.nb_lignes) over (partition by r.controle order by r.jour) as tendance
from resultats r join scores s on s.jour = r.jour;
comment on view buta.mart_qualite is 'QUALITE : résultat quotidien des douze contrôles (statut ok, alerte, ko ; lignes concernées ; échantillon) et score du jour = 100 x somme pondérée des contrôles ok / somme des poids (3 pour un contrôle bloquant, 1 sinon). tendance : variation du nombre de lignes par rapport au jour précédent.';

-- ---------------------------------------------------------------------------
-- mart_marche_departement / mart_marche_commune (marche reel)
-- ---------------------------------------------------------------------------
create or replace view buta.mart_marche_departement as
select m.code as departement, d.nom, d.region,
  m.code in ('16', '17', '79', '85', '24', '33', '47', '32', '40', '64', '59') as perimetre,
  (select string_agg(t.agence, ', ' order by t.part desc) from buta.dim_agence_territoire t where t.departement = m.code) as agences_simulees,
  m.rp, m.maisons, m.proprietaires, m.fioul, m.gaz_citerne, m.gaz_ville, m.electricite,
  m.maisons_fg, m.maisons_diag, m.maisons_fioul_dpe, m.maisons_gpl_dpe, m.solaire_nb, m.solaire_kw, m.solaire_nb_36,
  m.rge_pac, m.rge_pv, m.rge_cet,
  case when m.rp > 0 then round(100.0 * (m.fioul + m.gaz_citerne) / m.rp, 1) end as part_fioul_citerne,
  case when m.maisons_diag > 0 then round(100.0 * m.maisons_fg / m.maisons_diag, 1) end as part_maisons_fg,
  case when m.maisons > 0 then round(1000.0 * m.solaire_nb / m.maisons, 1) end as solaire_pour_1000_maisons,
  case when m.maisons > 0 then round(10000.0 * (m.rge_pac + m.rge_pv) / m.maisons, 1) end as rge_pour_10000_maisons,
  m.c_volume, m.c_intensite_fioul, m.c_intensite_fg, m.c_frein, m.c_saturation, m.indice, m.date_reference
from buta.marche_departement m join buta.dim_departement d on d.code = m.code;
comment on view buta.mart_marche_departement is 'Marché réel par département (Insee Logement 2022, ADEME DPE, RTE, ADEME RGE, Licence Ouverte 2.0) : résidences principales, maisons, propriétaires, chauffage fioul, gaz citerne, gaz de ville, électricité, maisons F ou G, solaire, RGE, parts et ratios pour 1 000 et 10 000 maisons, composantes en rang centile et indice de potentiel (INDICE). perimetre : les onze départements du réseau simulé. Ce n''est pas une recommandation d''implantation.';

create or replace view buta.mart_marche_commune as
with c as (
  select m.*, d.nom, d.latitude, d.longitude,
    case when m.rp > 0 then (m.fioul + m.gaz_citerne)::numeric / m.rp end as intensite_fioul,
    case when m.maisons_diag > 0 then m.maisons_fg::numeric / m.maisons_diag end as intensite_fg,
    case when m.maisons > 0 then 10000.0 * (m.rge_pac + m.rge_pv) / m.maisons end as frein,
    case when m.maisons > 0 then 1000.0 * m.solaire_nb / m.maisons end as saturation
  from buta.marche_commune m left join buta.dim_commune d on d.code_insee = m.code_insee
),
r as (
  select *,
    (100.0 * percent_rank() over (order by proprietaires))::numeric as c_volume,
    (100.0 * percent_rank() over (order by intensite_fioul))::numeric as c_intensite_fioul,
    (100.0 * percent_rank() over (order by intensite_fg))::numeric as c_intensite_fg,
    (100.0 * percent_rank() over (order by frein))::numeric as c_frein,
    (100.0 * percent_rank() over (order by saturation))::numeric as c_saturation
  from c
)
select code_insee, nom, departement, latitude, longitude, rp, maisons, proprietaires, fioul, gaz_citerne, gaz_ville, electricite,
  maisons_fg, maisons_diag, maisons_fioul_dpe, maisons_gpl_dpe, solaire_nb, solaire_kw, solaire_nb_36, rge_pac, rge_pv, rge_cet,
  round(100 * intensite_fioul, 1) as part_fioul_citerne, round(100 * intensite_fg, 1) as part_maisons_fg,
  round(saturation, 1) as solaire_pour_1000_maisons, round(frein, 1) as rge_pour_10000_maisons,
  round(c_volume, 0) as c_volume, round(c_intensite_fioul, 0) as c_intensite_fioul, round(c_intensite_fg, 0) as c_intensite_fg,
  round(c_frein, 0) as c_frein, round(c_saturation, 0) as c_saturation,
  round((0.4 * c_volume + 0.3 * coalesce(c_intensite_fioul, 0) + 0.3 * coalesce(c_intensite_fg, 0)) * (1 - 0.3 * coalesce(c_frein, 0) / 100) * (1 - 0.3 * coalesce(c_saturation, 0) / 100), 1) as indice,
  date_reference
from r;
comment on view buta.mart_marche_commune is 'Marché réel à la commune pour les onze départements du périmètre (mêmes sources que mart_marche_departement) avec le centre géographique, les parts, les ratios et un indice de potentiel calculé en rang centile parmi ces communes. Ce n''est pas une recommandation d''implantation.';

-- ---------------------------------------------------------------------------
-- mart_automatisation, mart_alertes, mart_plans_action, mart_revue_hebdo
-- ---------------------------------------------------------------------------
create or replace view buta.mart_automatisation as
select id, workflow, debute_le, fini_le, statut, message, lignes,
  round(extract(epoch from (fini_le - debute_le))::numeric, 1) as duree_s,
  row_number() over (partition by workflow order by debute_le desc) as rang
from buta.automatisation_run;
comment on view buta.mart_automatisation is 'Journal des exécutions n8n : workflow, début, fin, durée en secondes, statut, message, lignes traitées, rang (1 = dernière exécution du workflow).';

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
carnet as (
  select agence, carnet_jours_ouvres, poses_en_retard from buta.mart_pose p, j
  where agence <> 'RESEAU' and semaine = (select max(semaine) from buta.mart_pose p2, j where p2.semaine <= j.j)
),
alertes as (
  select 'CPV_LEADS_ACHETES' as code, agence, 'alerte' as gravite,
    round(100.0 * (cout_par_vente - cpv_t1) / cpv_t1, 0) as valeur,
    'cout par vente des leads achetes ' || case when cout_par_vente >= cpv_t1 then '+' else '' end || round(100.0 * (cout_par_vente - cpv_t1) / cpv_t1, 0) || ' % vs T1' as texte
  from cpv where cpv_t1 > 0 and cout_par_vente > 1.3 * cpv_t1
  union all
  select 'DOSSIERS_A_QUALIFIER', agence, 'attention', nb, nb || ' dossiers a qualifier, referentiel en cours d''alignement' from qualifier where nb > 0
  union all
  select 'CARNET_POSE', agence, 'alerte', carnet_jours_ouvres, 'carnet de pose a ' || round(carnet_jours_ouvres, 0) || ' jours ouvres' from carnet where carnet_jours_ouvres > 40
  union all
  select 'POSES_EN_RETARD', agence, 'attention', poses_en_retard, poses_en_retard || ' poses en retard de plus de 60 jours' from carnet where poses_en_retard >= 10
)
select a.code, a.agence, ag.nom_bassin, a.gravite, a.valeur, ag.nom_bassin || ' : ' || a.texte as texte, j.j as calcule_le
from alertes a join buta.dim_agence ag on ag.code = a.agence cross join j;
comment on view buta.mart_alertes is 'Alertes du matin calculées par règles à la journée publiée : coût par vente des leads achetés au-delà de +30 % vs le premier trimestre, dossiers à qualifier (statut ou libellé produit hors référentiel), carnet de pose au-delà de 40 jours ouvrés, poses en retard. Texte assemblé en SQL, valeur numérique fournie. Données simulées.';

create or replace view buta.mart_plans_action as
select p.id, p.agence, a.nom_bassin, p.levier, p.proprietaire_code, p.gain_attendu, p.statut, p.echeance, p.avancement, p.indicateur_code
from buta.plan_action p left join buta.dim_agence a on a.code = p.agence;
comment on view buta.mart_plans_action is 'Plans d''action simulés : levier, agence, propriétaire (code), gain attendu en euros, statut, échéance, avancement en pourcentage, indicateur suivi.';

create or replace view buta.mart_revue_hebdo as
select semaine, faits, texte, modele, cout, publie_le, 'S' || lpad(extract(week from semaine)::text, 2, '0') || ' ' || extract(isoyear from semaine) as libelle
from buta.revue_hebdo;
comment on view buta.mart_revue_hebdo is 'Revues hebdomadaires : semaine (lundi), faits calculés en SQL, texte rédigé, modèle, coût en euros, date de publication.';

-- ---------------------------------------------------------------------------
-- Rafraichissement des vues materialisees, grants
-- ---------------------------------------------------------------------------
create or replace function buta.rafraichir_marts()
returns text
language plpgsql
security definer
set search_path = buta, public
as $$
begin
  refresh materialized view buta.mart_funnel;
  refresh materialized view buta.mart_ventes_produit;
  refresh materialized view buta.mart_forecast;
  return 'mart_funnel, mart_ventes_produit, mart_forecast rafraichies a ' || now()::text;
end;
$$;
comment on function buta.rafraichir_marts() is 'Rafraîchit les trois vues matérialisées (appelée en fin de WF1).';

grant select on buta.mart_kpi_mensuel, buta.mart_funnel, buta.mart_ventes_produit, buta.mart_ecarts,
  buta.mart_couts_acquisition, buta.mart_delais, buta.mart_pose, buta.mart_encaissement, buta.mart_forecast,
  buta.mart_qualite, buta.mart_marche_departement, buta.mart_marche_commune, buta.mart_automatisation,
  buta.mart_alertes, buta.mart_plans_action, buta.mart_revue_hebdo
to anon, authenticated, analyste_ro;
