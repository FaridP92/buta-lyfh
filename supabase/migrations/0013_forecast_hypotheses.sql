-- 0013 : mart_forecast expose ses hypothèses. Le panneau « hypothèses » de l'écran Forecast affiche les
-- taux de signature observés par tranche d'âge des devis (0 à 30, 31 à 60, 61 à 90 jours), le taux
-- d'annulation à six mois, le taux de signature pondéré implicite du pipe (pipe pondéré / montant des
-- devis en cours, annulation comprise) et la projection du run-rate saisonnalisé ; le curseur de
-- src/lib/forecast.ts recalcule l'atterrissage à partir de ces colonnes, sans écrire en base.
-- Vue matérialisée : suppression et recréation (les colonnes ne peuvent pas être ajoutées en place).

drop materialized view if exists buta.mart_forecast;

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
taux as (
  select agence,
    coalesce(s0_30::numeric / nullif(ouverts_0, 0), 0) as taux_0_30,
    coalesce(s31_60::numeric / nullif(ouverts_30, 0), 0) as taux_31_60,
    coalesce(s61_90::numeric / nullif(ouverts_60, 0), 0) as taux_61_90,
    coalesce(annules_6m::numeric / nullif(signes, 0), 0) as taux_annulation_6m
  from tranches
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
    tx.taux_0_30, tx.taux_31_60, tx.taux_61_90, tx.taux_annulation_6m,
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
  left join taux tx on tx.agence = r.agence
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
  case when objectif_annuel > 0 then round(100.0 * (realise_a_date + pipe_pondere + projection_run_rate * greatest(mois_restants - 1.5, 0) / nullif(mois_restants, 0) - objectif_annuel) / objectif_annuel, 1) end as ecart_atterrissage_pct,
  round(100.0 * coalesce(taux_0_30, 0), 1) as taux_signature_0_30,
  round(100.0 * coalesce(taux_31_60, 0), 1) as taux_signature_31_60,
  round(100.0 * coalesce(taux_61_90, 0), 1) as taux_signature_61_90,
  round(100.0 * coalesce(taux_annulation_6m, 0), 1) as taux_annulation_6m,
  case when montant_devis_en_cours > 0 then round(100.0 * pipe_pondere / montant_devis_en_cours, 1) end as taux_signature_pipe,
  round(projection_run_rate, 0) as projection_run_rate
from calcul;

comment on materialized view buta.mart_forecast is 'ATTERR : atterrissage annuel du CA signé par agence (et RESEAU) : réalisé à date, objectif annuel, pipe pondéré (PIPE_POND : devis en cours de moins de 90 jours x taux de signature observé par tranche d''âge sur 12 mois x (1 - taux d''annulation à 6 mois)), run-rate 3 mois saisonnalisé au-delà des 45 jours couverts par le pipe, bornes basse et haute à un écart-type mensuel x racine des mois restants (intervalle à 68 %), probabilité d''atteinte (P_ATTEINTE, loi normale sur le run-rate, arrondie à 5 points), hypothèses exposées (taux de signature par tranche d''âge, annulation à 6 mois, taux implicite du pipe, projection du run-rate). Données simulées.';
comment on column buta.mart_forecast.probabilite_atteinte is 'P_ATTEINTE : probabilité que l''atterrissage dépasse l''objectif, en pourcentage arrondi à 5 points.';
comment on column buta.mart_forecast.taux_signature_pipe is 'Pipe pondéré / montant des devis en cours, en pourcentage : taux de signature pondéré implicite du pipe, annulation à six mois comprise ; valeur de départ du curseur.';
comment on column buta.mart_forecast.projection_run_rate is 'Somme des mois restants du run-rate trois mois multiplié par le coefficient de saisonnalité 2025 du mois, en euros ; l''atterrissage n''en retient que la part au-delà des 45 jours couverts par le pipe.';

grant select on buta.mart_forecast to anon, authenticated, analyste_ro;
