-- 0027 : corrections issues de la relecture à trois lentilles du 18 septembre (lot 5, lentille « faits »).
-- 1. mart_couts_acquisition : les coûts du mois en cours sont ramenés au prorata des jours publiés, comme dans
--    mart_kpi_mensuel (INDICATEURS.md, conventions). Sans cela, le coût par lead du mois en cours divisait un mois
--    entier de coûts par dix-sept jours de leads (129 € affichés pour un prix du lead de 65 à 72 €).
-- 2. mart_ecarts : le CA réalisé est la somme exacte des montants signés (la même que mart_kpi_mensuel) et non sa
--    reconstruction depuis le prix net moyen ; l'effet remise est mesuré dossier par dossier contre le taux de la
--    comparaison, ce qui rend la décomposition exacte et le résiduel nul par construction.
-- 3. charge_agence : la masse salariale technique était comptée deux fois, dans le coût de pose de chaque dossier
--    (taux_pose × prix catalogue, déduit de la marge brute) et en charge fixe d'agence. Elle reste portée par le coût
--    de pose ; la charge fixe technique passe à zéro, les véhicules restent. Le réseau, structurellement déficitaire
--    tous les mois, retrouve un résultat autour de l'équilibre avec des agences gagnantes et perdantes (DONNEES.md §3.3).
-- 4. mart_fraicheur : la prochaine journée simulée est le lendemain de l'intégration, pas la journée publiée + 1.
-- 5. plan_action : le renfort de pose du Bassin d'Arcachon portait 380 k€ de CA posé à risque dans une colonne de
--    gains de marge ; il porte 80 k€ de marge (CA posé rattrapé × taux de marge, moins la sous-traitance). Le plan
--    référentiel Nord affichait 85 % d'avancement déclaré avec 83 lignes encore hors référentiel : 40 %.

-- 1. Coûts d'acquisition au prorata du mois en cours.
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
  -- Prorata des jours publiés pour le mois en cours (1 pour un mois complet), comme mart_kpi_mensuel.
  select mois, agence, canal, sum(montant * buta.prorata_mois(mois)) as cout from buta.fait_cout_canal, j where mois <= j.j group by 1, 2, 3
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
comment on view buta.mart_couts_acquisition is 'Coûts d''acquisition par mois de création du lead, agence et canal (avec RESEAU et TOUS) : coût du canal (au prorata des jours publiés pour le mois en cours), leads, RDV tenus, ventes de la cohorte, CA signé, coût par lead (CPL), coût par vente (CPV), taux de RDV, conversion, délai lead vers RDV (médiane calculée à chaque niveau d''agrégation), et pastille à revoir quand le CPV dépasse 1,3 fois la médiane des canaux du mois. Commissions commerciales exclues (voir mart_kpi_mensuel). Données simulées.';
comment on column buta.mart_couts_acquisition.cout is 'Coût du canal sur le mois, en euros ; pour le mois en cours, multiplié par le prorata des jours publiés (comme les leads, bornés à la journée publiée).';

-- 2. Décomposition de l'écart : CA réalisé exact, effet remise dossier par dossier, résiduel nul.
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
-- CA signé exact du mois (agence ou RESEAU) : la même somme que mart_kpi_mensuel.ca_signe.
ca_exact as (
  select mois, agence, sum(ca) as ca from realise_agrege group by 1, 2
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
    coalesce(e.ca, 0) as ca1,
    sum(case when t.v0 > 0 then p.v0 / t.v0 else 0 end * p.cat0 * (1 - coalesce(x.tx0, t.tx1))) as pn0,
    t.v1 * sum((case when t.v1 > 0 then p.v1 / t.v1 else 0 end - case when t.v0 > 0 then p.v0 / t.v0 else 0 end) * p.cat0 * (1 - coalesce(x.tx0, t.tx1))) as effet_mix,
    t.v1 * sum(case when t.v1 > 0 then p.v1 / t.v1 else 0 end * (p.cat1 - p.cat0) * (1 - coalesce(x.tx0, t.tx1))) as effet_prix,
    -- Effet remise exact : CA signé moins ce que les mêmes dossiers auraient rapporté au taux de remise de la comparaison.
    coalesce(e.ca, 0) - t.v1 * sum(case when t.v1 > 0 then p.v1 / t.v1 else 0 end * p.cat1) * (1 - coalesce(x.tx0, t.tx1)) as effet_remise
  from paires p
  join totaux t on t.mois = p.mois and t.agence = p.agence and t.comparaison = p.comparaison
  left join tx0 x on x.mois = p.mois and x.agence = p.agence and x.comparaison = p.comparaison
  left join ca_exact e on e.mois = p.mois and e.agence = p.agence
  group by p.mois, p.agence, p.comparaison, t.v1, t.v0, t.tx1, x.tx0, e.ca
)
select mois, agence, comparaison,
  v0 > 0 as comparaison_disponible,
  case when v0 = 0 and comparaison = 'n1' and mois < date '2026-01-01' then 'n. d., pas d''historique 2024'
       when v0 = 0 then 'n. d., pas de comparaison pour ce mois' end as motif,
  round(v1, 0) as ventes, round(v0, 1) as ventes_comparaison,
  round(ca1, 0) as ca_realise, round(v0 * pn0, 0) as ca_comparaison,
  round(ca1 - v0 * pn0, 0) as ecart_total,
  round((v1 - v0) * pn0, 0) as effet_volume,
  round(effet_mix, 0) as effet_mix,
  round(effet_prix, 0) as effet_prix,
  round(effet_remise, 0) as effet_remise,
  round((ca1 - v0 * pn0) - ((v1 - v0) * pn0 + effet_mix + effet_prix + effet_remise), 0) as residuel,
  round(100 * tx1, 2) as taux_remise, round(100 * tx0, 2) as taux_remise_comparaison,
  buta.prorata_mois(mois) as prorata
from calcul
where v1 > 0 or v0 > 0;
comment on view buta.mart_ecarts is 'ECART_CA : décomposition de l''écart de chiffre d''affaires signé du mois (agence ou RESEAU) contre l''objectif ou N-1, en euros : effet volume, effet mix, effet prix, effet remise (mesuré dossier par dossier contre le taux de remise de la comparaison), résiduel nul par construction (arrondis seulement). Le CA réalisé est la somme exacte des montants signés, la même que mart_kpi_mensuel. Pour le mois en cours, les volumes de la comparaison sont proratisés des jours publiés (colonne prorata). N-1 n''existe pas pour 2025. Données simulées.';
comment on column buta.mart_ecarts.prorata is 'Part du mois publiée appliquée aux volumes de la comparaison ; 1 pour un mois complet.';
comment on column buta.mart_ecarts.effet_volume is '(V1 - V0) x prix net moyen de la comparaison, en euros.';
comment on column buta.mart_ecarts.effet_mix is 'V1 x somme sur les produits de (part1 - part0) x prix catalogue de la comparaison x (1 - taux de remise de la comparaison), en euros.';
comment on column buta.mart_ecarts.effet_prix is 'V1 x somme de part1 x (prix catalogue réalisé - prix catalogue de la comparaison) x (1 - taux de remise de la comparaison), en euros.';
comment on column buta.mart_ecarts.effet_remise is 'CA signé moins la somme des prix catalogue des dossiers signés x (1 - taux de remise de la comparaison) : effet des remises réellement accordées, en euros.';
comment on column buta.mart_ecarts.ca_realise is 'CA signé HT du mois, somme exacte des montants nets de remise des dossiers signés non annulés (identique à mart_kpi_mensuel.ca_signe).';

-- 3. Masse salariale technique portée par le coût de pose de chaque dossier : plus de charge fixe technique.
update buta.charge_agence set salaires_techniciens = 0;
comment on column buta.charge_agence.salaires_techniciens is 'Zéro depuis le 18 septembre 2026 : la masse salariale technique est portée par cout_pose de chaque dossier (taux_pose x prix catalogue), déjà déduit de la marge brute ; la compter aussi ici la comptait deux fois.';

-- 4. Prochaine journée simulée : le lendemain de l'intégration (WF1 tourne chaque jour à 06:00).
create or replace view buta.mart_fraicheur as
select
  s.source,
  case when s.source = 'journee_simulee' then buta.journee_publiee() else s.date_reference end as date_reference,
  case when s.source = 'journee_simulee' then s.date_reference end as disponible_jusqu_au,
  s.ingere_le,
  case when s.source = 'journee_simulee' then (s.ingere_le at time zone 'Europe/Paris')::date + 1 else s.prochaine end as prochaine
from buta.source_fraicheur s;
comment on view buta.mart_fraicheur is 'Fraîcheur de chaque source telle que l''interface l''affiche : date de référence (pour journee_simulee, la journée publiée plafonnée à la veille), date jusqu''à laquelle les dossiers sont publiés d''avance (journee_simulee seulement), date et heure d''intégration, prochaine mise à jour attendue (pour journee_simulee, le lendemain de l''intégration).';

-- 5. Plans d'action : gain de marge cohérent et avancement déclaré cohérent avec le contrôle qualité.
update buta.plan_action set gain_attendu = 80000 where id = 5 and indicateur_code = 'CARNET';
update buta.plan_action set avancement = 40 where id = 4 and indicateur_code = 'QUALITE';
comment on column buta.plan_action.gain_attendu is 'Gain de marge attendu en euros, déclaré par le propriétaire du plan ; 0 quand le gain n''est pas chiffrable (qualité).';
comment on column buta.plan_action.avancement is 'Avancement déclaré par le propriétaire du plan, en pourcentage.';
