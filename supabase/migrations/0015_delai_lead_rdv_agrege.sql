-- 0015 : mart_couts_acquisition portait un délai lead vers RDV médian seulement au grain agence × canal
-- (null pour RESEAU et TOUS, une médiane ne s'additionne pas). La médiane est maintenant calculée pour
-- chaque niveau d'agrégation directement sur les dossiers.

create or replace view buta.mart_couts_acquisition as
with j as materialized (select buta.journee_publiee() as j),
cohortes as (
  select date_trunc('month', date_lead)::date as mois, agence, canal,
    count(*) as leads,
    count(date_rdv) as rdv_tenus,
    count(date_signature) filter (where date_annulation is null) as ventes,
    sum(montant_ht) filter (where date_annulation is null) as ca_signe
  from buta.dossier_a_date group by 1, 2, 3
),
delais as (
  select date_trunc('month', date_lead)::date as mois, coalesce(agence, 'RESEAU') as agence, coalesce(canal, 'TOUS') as canal,
    percentile_cont(0.5) within group (order by date_rdv - date_lead) as delai_lead_rdv_median
  from buta.dossier_a_date
  where date_rdv is not null
  group by grouping sets ((date_trunc('month', date_lead)::date, agence, canal), (date_trunc('month', date_lead)::date, agence), (date_trunc('month', date_lead)::date, canal), (date_trunc('month', date_lead)::date))
),
couts as (
  select mois, agence, canal, sum(montant) as cout from buta.fait_cout_canal, j where mois <= j.j group by 1, 2, 3
),
base as (
  select coalesce(c.mois, k.mois) as mois, coalesce(c.agence, k.agence) as agence, coalesce(c.canal, k.canal) as canal,
    coalesce(k.leads, 0) as leads, coalesce(k.rdv_tenus, 0) as rdv_tenus, coalesce(k.ventes, 0) as ventes,
    coalesce(k.ca_signe, 0) as ca_signe, coalesce(c.cout, 0) as cout
  from couts c full join cohortes k on k.mois = c.mois and k.agence = c.agence and k.canal = c.canal
),
agrege as (
  select mois, coalesce(agence, 'RESEAU') as agence, coalesce(canal, 'TOUS') as canal,
    sum(leads) as leads, sum(rdv_tenus) as rdv_tenus, sum(ventes) as ventes, sum(ca_signe) as ca_signe, sum(cout) as cout
  from base group by grouping sets ((mois, agence, canal), (mois, agence), (mois, canal), (mois))
),
avec_ratios as (
  select a.*, d.delai_lead_rdv_median,
    case when a.leads > 0 then round(a.cout / a.leads, 0) end as cout_par_lead,
    case when a.ventes > 0 then round(a.cout / a.ventes, 0) end as cout_par_vente,
    case when a.leads > 0 then round(100.0 * a.rdv_tenus / a.leads, 1) end as taux_rdv,
    case when a.leads > 0 then round(100.0 * a.ventes / a.leads, 1) end as taux_conversion
  from agrege a
  left join delais d on d.mois = a.mois and d.agence = a.agence and d.canal = a.canal
)
select a.mois, a.agence, a.canal, a.leads, a.rdv_tenus, a.ventes, a.ca_signe, a.cout, a.delai_lead_rdv_median,
  a.cout_par_lead, a.cout_par_vente, a.taux_rdv, a.taux_conversion,
  m.mediane as cout_par_vente_median_mois,
  a.cout_par_vente > 1.3 * m.mediane as a_revoir
from avec_ratios a
left join (
  select mois, agence, (percentile_cont(0.5) within group (order by cout_par_vente))::numeric as mediane
  from avec_ratios where canal <> 'TOUS' and cout_par_vente > 0 group by 1, 2
) m on m.mois = a.mois and m.agence = a.agence;
comment on view buta.mart_couts_acquisition is 'Coûts d''acquisition par mois de création du lead, agence et canal (avec RESEAU et TOUS) : coût du canal, leads, RDV tenus, ventes de la cohorte, CA signé, coût par lead (CPL), coût par vente (CPV), taux de RDV, conversion, délai lead vers RDV (médiane calculée à chaque niveau d''agrégation), et pastille à revoir quand le CPV dépasse 1,3 fois la médiane des canaux du mois. Commissions commerciales exclues (voir mart_kpi_mensuel). Données simulées.';
comment on column buta.mart_couts_acquisition.cout_par_lead is 'CPL : coût du canal / leads du canal, en euros.';
comment on column buta.mart_couts_acquisition.cout_par_vente is 'CPV : coût du canal / ventes de la cohorte issue du canal, en euros.';
comment on column buta.mart_couts_acquisition.delai_lead_rdv_median is 'D_LEAD_RDV : médiane en jours du délai entre le lead et le RDV tenu, calculée sur les dossiers du niveau (agence × canal, agence, canal, réseau).';
