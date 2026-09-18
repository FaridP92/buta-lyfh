-- 0014 : objectif mensuel sur toute l'année. mart_kpi_mensuel ne porte l'objectif que des mois publiés ;
-- l'éventail d'atterrissage a besoin de la trajectoire cumulée de l'objectif jusqu'en décembre.
-- Grain mois × agence (et RESEAU), à partir de la table objectif (ventes cibles × prix catalogue cible × (1 - remise cible)).

create or replace view buta.mart_objectif_mensuel as
select mois, coalesce(agence, 'RESEAU') as agence,
  round(sum(ventes), 1) as objectif_ventes,
  round(sum(ventes * prix_catalogue_cible * (1 - taux_remise_cible)), 0) as objectif_ca
from buta.objectif
group by grouping sets ((mois, agence), (mois));
comment on view buta.mart_objectif_mensuel is 'Objectif mensuel de ventes et de CA signé HT net de remise par agence (et RESEAU), sur toute l''année, y compris les mois à venir. Sert à la trajectoire cumulée de l''objectif sur l''écran Forecast. Données simulées.';

grant select on buta.mart_objectif_mensuel to anon, authenticated, analyste_ro;
