-- 0017 : publication d'avance sans montrer le futur, fraîcheur exposée, échecs consécutifs (lot 4a).
-- 1. journee_publiee() est plafonnée à la veille en heure de Paris : un script peut publier d'avance
--    jusqu'au 25 septembre (DONNEES.md §3), l'application n'affiche jamais que J-1, et sans workflow
--    la journée affichée avance quand même chaque nuit.
-- 2. dossier_a_date exclut les leads postérieurs à la journée publiée (publiés d'avance, pas encore visibles).
-- 3. mart_fraicheur : la fraîcheur des sources telle que l'interface la montre (journée publiée plafonnée,
--    date jusqu'à laquelle les données sont disponibles, prochaine journée).
-- 4. echecs_consecutifs(workflow) : nombre d'échecs consécutifs en tête du journal n8n (email au troisième).

create or replace function buta.journee_publiee()
returns date
language sql
stable
set search_path = buta, public
as $$
  select least(
    coalesce(
      (select date_reference from buta.source_fraicheur where source = 'journee_simulee'),
      (now() at time zone 'Europe/Paris')::date - 1),
    (now() at time zone 'Europe/Paris')::date - 1);
$$;
comment on function buta.journee_publiee() is 'Journée simulée affichée : dernière journée publiée (source_fraicheur.journee_simulee) plafonnée à la veille en heure de Paris, pour qu''une publication d''avance ne montre jamais le futur ; à défaut, la veille.';

-- Dossiers publiés, vus à la journée publiée : les dates postérieures sont masquées et les leads
-- postérieurs (publiés d'avance) sont exclus.
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
where d.publie and d.date_lead <= j.j;
comment on view buta.dossier_a_date is 'Interne : dossiers publiés vus à la journée publiée (leads postérieurs exclus, événements postérieurs masqués). Non exposé.';

-- Fraîcheur telle qu'affichée : pour la journée simulée, la journée publiée plafonnée et la date
-- jusqu'à laquelle les dossiers sont déjà publiés (d'avance) ; les autres sources telles quelles.
create or replace view buta.mart_fraicheur as
select
  s.source,
  case when s.source = 'journee_simulee' then buta.journee_publiee() else s.date_reference end as date_reference,
  case when s.source = 'journee_simulee' then s.date_reference end as disponible_jusqu_au,
  s.ingere_le,
  case when s.source = 'journee_simulee' then buta.journee_publiee() + 1 else s.prochaine end as prochaine
from buta.source_fraicheur s;
comment on view buta.mart_fraicheur is 'Fraîcheur de chaque source telle que l''interface l''affiche : date de référence (pour journee_simulee, la journée publiée plafonnée à la veille), date jusqu''à laquelle les dossiers sont publiés d''avance (journee_simulee seulement), date et heure d''intégration, prochaine mise à jour attendue.';
grant select on buta.mart_fraicheur to anon, authenticated, analyste_ro;

-- Échecs consécutifs d'un workflow, comptés depuis la dernière exécution (les cent dernières lignes suffisent).
create or replace function buta.echecs_consecutifs(p_workflow text)
returns integer
language sql
stable
security definer
set search_path = buta, public
as $$
  with derniers as (
    select statut, row_number() over (order by debute_le desc, id desc) as rang
    from buta.automatisation_run
    where workflow = p_workflow
    order by debute_le desc, id desc
    limit 100
  )
  select count(*)::integer
  from derniers d
  where d.statut = 'erreur'
    and not exists (select 1 from derniers p where p.rang < d.rang and p.statut <> 'erreur');
$$;
comment on function buta.echecs_consecutifs(text) is 'Nombre d''exécutions en erreur consécutives en tête du journal du workflow (0 si la dernière a réussi) ; les workflows envoient un email au troisième échec.';
revoke execute on function buta.echecs_consecutifs(text) from public, anon, authenticated;
grant execute on function buta.echecs_consecutifs(text) to service_role;
