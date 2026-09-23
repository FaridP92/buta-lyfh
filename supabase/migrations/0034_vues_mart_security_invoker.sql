-- 0034 : Security Advisor Supabase du 23 septembre 2026 (18 erreurs, 3 avertissements et 6 suggestions sur buta).
-- Les vues mart_ du schéma buta, exposé par l'API, s'exécutaient avec les droits de leur propriétaire (lint 0010
-- security_definer_view) et les trois vues matérialisées étaient lisibles par anon (lint 0016). C'était voulu
-- (DONNEES.md §4.8 : fait_dossier, fait_cout_canal et ia_usage n'ont aucun droit pour anon, seules les vues agrégées
-- les exposent), mais un schéma exposé ne doit contenir que des objets qui appliquent les droits de l'appelant.
-- Rien ne change pour le front, n8n, les Edge Functions ni l'analyste : mêmes noms, colonnes, commentaires et droits.
-- 1. Les vingt et une vues mart_ (dont trois matérialisées) passent dans buta_prive, schéma non exposé par l'API et
--    sans usage pour anon, authenticated ni analyste_ro. Elles gardent leurs droits, leurs commentaires, leurs index
--    et leurs dépendances (une vue référence les autres par identifiant, pas par nom).
-- 2. Dans buta, chaque mart_ devient une vue mince security_invoker (select * de la vue privée) : les droits de
--    l'appelant s'appliquent à la vue mince, la vue privée calcule avec les droits de son propriétaire, comme avant.
-- 3. rafraichir_marts() rafraîchit les vues matérialisées à leur nouvelle place.
-- 4. Les six tables sans politique (lint 0008) reçoivent une politique restrictive explicite : anon et authenticated
--    n'y accèdent jamais, même si une politique permissive était ajoutée par erreur. Une seule politique pour toutes
--    les opérations suffit ici, puisqu'elle refuse tout. postgres et service_role contournent la RLS ; analyste_ro
--    n'est pas visé (il ne lit que les vues).
-- Règle pour la suite (DONNEES.md §4.8) : une vue mart_ se crée ou se modifie dans buta_prive, puis sa vue mince est
-- créée ou recréée dans buta avec (security_invoker = true), ses commentaires et le grant select à anon,
-- authenticated et analyste_ro. Le select * d'une vue mince est figé à sa création : une colonne ajoutée à la vue
-- privée n'y apparaît qu'après recréation.

create schema if not exists buta_prive;
revoke all on schema buta_prive from public;
comment on schema buta_prive is 'Calcul des vues mart_ avec les droits du propriétaire. Non exposé par l''API, aucun usage pour anon, authenticated ni analyste_ro : lu seulement au travers des vues minces security_invoker de buta (migration 0034).';

-- 1. Déplacement
alter view buta.mart_alertes set schema buta_prive;
alter view buta.mart_automatisation set schema buta_prive;
alter view buta.mart_couts_acquisition set schema buta_prive;
alter view buta.mart_delais set schema buta_prive;
alter view buta.mart_ecarts set schema buta_prive;
alter view buta.mart_encaissement set schema buta_prive;
alter view buta.mart_fraicheur set schema buta_prive;
alter view buta.mart_ia_usage set schema buta_prive;
alter view buta.mart_kpi_mensuel set schema buta_prive;
alter view buta.mart_marche_commune set schema buta_prive;
alter view buta.mart_marche_departement set schema buta_prive;
alter view buta.mart_objectif_mensuel set schema buta_prive;
alter view buta.mart_plans_action set schema buta_prive;
alter view buta.mart_pose set schema buta_prive;
alter view buta.mart_qualite set schema buta_prive;
alter view buta.mart_reconciliation_libelles set schema buta_prive;
alter view buta.mart_remises set schema buta_prive;
alter view buta.mart_revue_hebdo set schema buta_prive;
alter materialized view buta.mart_forecast set schema buta_prive;
alter materialized view buta.mart_funnel set schema buta_prive;
alter materialized view buta.mart_ventes_produit set schema buta_prive;

-- 2. Vues minces : commentaires recopiés (buta.catalogue_analyste() les lit pour décrire les vues au modèle).
-- service_role reçoit ses droits par les privilèges par défaut du schéma buta (0025).
do $$
declare
  v record;
  c record;
begin
  for v in
    select cl.oid, cl.relname, obj_description(cl.oid, 'pg_class') as description
    from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'buta_prive' and cl.relkind in ('v', 'm') and cl.relname like 'mart\_%'
    order by cl.relname
  loop
    execute format('create view buta.%I with (security_invoker = true) as select * from buta_prive.%I', v.relname, v.relname);
    execute format('comment on view buta.%I is %L', v.relname, v.description);
    for c in
      select a.attname, col_description(v.oid, a.attnum) as description
      from pg_attribute a
      where a.attrelid = v.oid and a.attnum > 0 and not a.attisdropped and col_description(v.oid, a.attnum) is not null
    loop
      execute format('comment on column buta.%I.%I is %L', v.relname, c.attname, c.description);
    end loop;
    execute format('grant select on buta.%I to anon, authenticated, analyste_ro', v.relname);
  end loop;
end
$$;

-- 3. Rafraîchissement (pg_cron buta_rafraichir_marts à 04:05 UTC et workflow n8n wf1)
create or replace function buta.rafraichir_marts()
returns text
language plpgsql
security definer
set search_path = buta, public
as $$
begin
  refresh materialized view buta_prive.mart_funnel;
  refresh materialized view buta_prive.mart_ventes_produit;
  refresh materialized view buta_prive.mart_forecast;
  return 'mart_funnel, mart_ventes_produit, mart_forecast rafraichies a ' || now()::text;
end;
$$;

-- 4. Refus explicite sur les tables lues seulement par le rôle service et par les vues privées
create policy aucun_acces_direct on buta.fait_dossier as restrictive for all to anon, authenticated using (false) with check (false);
create policy aucun_acces_direct on buta.fait_cout_canal as restrictive for all to anon, authenticated using (false) with check (false);
create policy aucun_acces_direct on buta.ia_usage as restrictive for all to anon, authenticated using (false) with check (false);
create policy aucun_acces_direct on buta.analyste_question as restrictive for all to anon, authenticated using (false) with check (false);
create policy aucun_acces_direct on buta.explication_cache as restrictive for all to anon, authenticated using (false) with check (false);
create policy aucun_acces_direct on buta.visite as restrictive for all to anon, authenticated using (false) with check (false);
comment on policy aucun_acces_direct on buta.fait_dossier is 'Refus explicite (0034) : lu par les vues privées buta_prive.mart_* et écrit par le rôle service.';
comment on policy aucun_acces_direct on buta.fait_cout_canal is 'Refus explicite (0034) : lu par les vues privées buta_prive.mart_* et écrit par le rôle service.';
comment on policy aucun_acces_direct on buta.ia_usage is 'Refus explicite (0034) : lu par buta_prive.mart_ia_usage et écrit par les Edge Functions (rôle service).';
comment on policy aucun_acces_direct on buta.analyste_question is 'Refus explicite (0034) : questions libres des visiteurs, jamais exposées ; rôle service seulement.';
comment on policy aucun_acces_direct on buta.explication_cache is 'Refus explicite (0034) : cache des explications IA ; rôle service seulement.';
comment on policy aucun_acces_direct on buta.visite is 'Refus explicite (0034) : journal de visites ; rôle service seulement.';

-- Contrôle : 21 vues minces, et plus aucune vue lisible par anon ou authenticated sans security_invoker dans buta
do $$
declare
  n_minces integer;
  n_exposees integer;
begin
  select count(*) into n_minces
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'buta' and c.relkind = 'v' and c.relname like 'mart\_%'
    and 'security_invoker=true' = any(c.reloptions);
  select count(*) into n_exposees
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'buta' and c.relkind in ('v', 'm')
    and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('authenticated', c.oid, 'SELECT'))
    and not coalesce('security_invoker=true' = any(c.reloptions), false);
  if n_minces <> 21 or n_exposees <> 0 then
    raise exception '0034 : % vues minces (21 attendues), % vues exposées sans security_invoker (0 attendue)', n_minces, n_exposees;
  end if;
end
$$;

notify pgrst, 'reload schema';
