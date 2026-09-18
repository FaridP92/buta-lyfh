-- 0016 : réconciliation des libellés produits (H4, écran Qualité). Les dossiers reçus avec un libellé
-- hors référentiel (agence Nord pendant son intégration) sont comptés par libellé source et par
-- produit résolu, pour montrer « avant, après » sans exposer fait_dossier.

create or replace view buta.mart_reconciliation_libelles as
select d.agence, d.produit_libelle_source as libelle_source, d.produit as produit_code, p.libelle as libelle_referentiel,
  count(*) as dossiers, min(d.date_lead) as premier_lead, max(d.date_lead) as dernier_lead
from buta.fait_dossier d
join buta.dim_produit p on p.code = d.produit
where d.publie and d.produit_libelle_source is not null and d.produit_libelle_source <> p.libelle
group by d.agence, d.produit_libelle_source, d.produit, p.libelle
order by dossiers desc;
comment on view buta.mart_reconciliation_libelles is 'Libellés produits reçus du système source qui divergent du référentiel, par agence : libellé source, produit résolu, nombre de dossiers, premier et dernier lead. Montre la réconciliation « avant, après » (H4, agence Nord). Données simulées.';

grant select on buta.mart_reconciliation_libelles to anon, authenticated, analyste_ro;
