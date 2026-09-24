-- 0037 : mart_alertes et mart_ecarts matérialisées (24 septembre 2026, passage du gatekeeper DevSecOps).
-- Mesuré en base : 2,2 s par lecture de mart_alertes, 1,0 s pour mart_ecarts ; les deux sont lues par la vue
-- d'ensemble et exposées à l'analyste, dont le délai est de 5 s. Le calcul reste une vue (suffixe _calcul) ; la vue
-- matérialisée de même nom en porte le résultat, rafraîchi par rafraichir_marts() en fin de WF1 (06:00, après la
-- publication de la journée) et par la tâche pg_cron de secours (04:05 UTC). Ni l'une ni l'autre ne lit
-- controle_resultat : le contenu ne dépend que de la journée publiée. Les vues minces de buta sont recréées par
-- create or replace, qui conserve leurs commentaires, leurs colonnes et leurs droits (DONNEES.md §4.8).
-- Verrou exclusif pris d'abord sur les deux vues minces : une lecture PostgREST en cours (2 s sur mart_alertes) tenait
-- la vue mince et attendait la vue privée renommée, d'où un interblocage à la première application (24 septembre).
lock table buta.mart_alertes, buta.mart_ecarts in access exclusive mode;

alter view buta_prive.mart_alertes rename to mart_alertes_calcul;
alter view buta_prive.mart_ecarts rename to mart_ecarts_calcul;

create materialized view buta_prive.mart_alertes as select * from buta_prive.mart_alertes_calcul;
create materialized view buta_prive.mart_ecarts as select * from buta_prive.mart_ecarts_calcul;

do $$
declare
  v text;
  c record;
begin
  foreach v in array array['mart_alertes', 'mart_ecarts'] loop
    execute format('comment on materialized view buta_prive.%I is %L', v,
      obj_description(('buta_prive.' || v || '_calcul')::regclass, 'pg_class'));
    for c in
      select a.attname, d.description
      from pg_attribute a
      join pg_description d on d.objoid = a.attrelid and d.objsubid = a.attnum
      where a.attrelid = ('buta_prive.' || v || '_calcul')::regclass and a.attnum > 0 and not a.attisdropped
    loop
      execute format('comment on column buta_prive.%I.%I is %L', v, c.attname, c.description);
    end loop;
    execute format('grant select on buta_prive.%I to anon, authenticated, analyste_ro, service_role', v);
    execute format('create or replace view buta.%I with (security_invoker = true) as select * from buta_prive.%I', v, v);
  end loop;
end
$$;

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
  refresh materialized view buta_prive.mart_ecarts;
  refresh materialized view buta_prive.mart_alertes;
  return 'mart_funnel, mart_ventes_produit, mart_forecast, mart_ecarts, mart_alertes rafraichies a ' || now()::text;
end;
$$;
comment on function buta.rafraichir_marts() is 'Rafraîchit les cinq vues matérialisées de buta_prive (fin de WF1, secours pg_cron à 04:05 UTC).';
