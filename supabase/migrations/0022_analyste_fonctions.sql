-- 0022 : fonctions de l'analyste (lot 4b, IA.md §4) appelées par les Edge Functions avec la clé service.
-- 1. executer_lecture : exécute une requête SELECT déjà validée par la fonction, sous le rôle analyste_ro
--    (vues autorisées seulement) avec un délai de 5 s ; renvoie les lignes en json (ordre des colonnes conservé).
--    Remplace la connexion directe ANALYSTE_DB_URL prévue par ARCHITECTURE.md §4 : aucun mot de passe à
--    distribuer, la clé service des Edge Functions suffit et le rôle reste le même.
-- 2. verifier_quota : 5 questions par minute et 20 par jour par empreinte, 400 par jour au total, budget du jour.
-- 3. journaliser_ia : journal analyste_question et consommation ia_usage.
-- 4. explication_cache : cache 24 h des explications d'écart ; mart_ia_usage : compteur discret pour l'écran.

create or replace function buta.executer_lecture(p_sql text)
returns json
language plpgsql
security definer
set search_path = buta, public
as $$
declare
  resultat json;
begin
  if p_sql !~* '^\s*select\b' then
    raise exception 'seule une requête select est acceptée';
  end if;
  if position(';' in p_sql) > 0 then
    raise exception 'point-virgule refusé';
  end if;
  set local role analyste_ro;
  set local statement_timeout = '5s';
  set local search_path = buta;
  execute 'select coalesce(json_agg(row_to_json(t)), ''[]''::json) from (' || p_sql || ') t' into resultat;
  return resultat;
end;
$$;
comment on function buta.executer_lecture(text) is 'Exécute une requête SELECT validée par l''Edge Function analyste sous le rôle analyste_ro (lecture seule, vues autorisées, délai 5 s) et renvoie les lignes en json.';

create or replace function buta.verifier_quota(p_empreinte text, p_budget_jour numeric)
returns jsonb
language sql
stable
security definer
set search_path = buta, public
as $$
  with compteurs as (
    select
      count(*) filter (where empreinte = p_empreinte and pose_le > now() - interval '1 minute') as par_minute,
      count(*) filter (where empreinte = p_empreinte and pose_le >= date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris') as par_jour,
      count(*) filter (where pose_le >= date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris') as total_jour
    from buta.analyste_question
  ),
  cout as (
    select coalesce(sum(cout_eur), 0) as cout_jour from buta.ia_usage where jour = (now() at time zone 'Europe/Paris')::date
  )
  select jsonb_build_object(
    'autorise', c.par_minute < 5 and c.par_jour < 20 and c.total_jour < 400 and k.cout_jour < p_budget_jour,
    'motif', case
      when c.par_minute >= 5 then 'cinq questions par minute au plus, réessayez dans une minute'
      when c.par_jour >= 20 then 'vingt questions par jour au plus pour cette adresse'
      when c.total_jour >= 400 then 'quota global du jour atteint'
      when k.cout_jour >= p_budget_jour then 'budget du jour épuisé'
      else null end,
    'cout_jour', k.cout_jour,
    'budget_jour', p_budget_jour)
  from compteurs c, cout k;
$$;
comment on function buta.verifier_quota(text, numeric) is 'Quotas de l''analyste (IA.md §4) : 5 questions par minute et 20 par jour par empreinte, 400 par jour au total, budget du jour en euros.';

create or replace function buta.journaliser_ia(
  p_fonction text, p_empreinte text, p_question text, p_sql text, p_statut text,
  p_cout numeric, p_duree_ms integer, p_tokens_entree bigint, p_tokens_sortie bigint)
returns void
language plpgsql
security definer
set search_path = buta, public
as $$
begin
  if p_fonction = 'analyste' then
    insert into buta.analyste_question (empreinte, question, sql, statut, cout_eur, duree_ms)
    values (p_empreinte, left(p_question, 500), p_sql, p_statut, p_cout, p_duree_ms);
  end if;
  insert into buta.ia_usage (jour, fonction, appels, tokens_entree, tokens_sortie, cout_eur)
  values ((now() at time zone 'Europe/Paris')::date, p_fonction, 1, coalesce(p_tokens_entree, 0), coalesce(p_tokens_sortie, 0), coalesce(p_cout, 0))
  on conflict (jour, fonction) do update set
    appels = buta.ia_usage.appels + 1,
    tokens_entree = buta.ia_usage.tokens_entree + excluded.tokens_entree,
    tokens_sortie = buta.ia_usage.tokens_sortie + excluded.tokens_sortie,
    cout_eur = buta.ia_usage.cout_eur + excluded.cout_eur;
end;
$$;
comment on function buta.journaliser_ia(text, text, text, text, text, numeric, integer, bigint, bigint) is 'Journalise un appel IA : question (analyste) et consommation du jour (appels, tokens, coût).';

create table if not exists buta.explication_cache (
  cle text primary key,
  reponse jsonb not null,
  expire_le timestamptz not null
);
comment on table buta.explication_cache is 'Cache 24 h des explications d''écart (clé : périmètre, mois, indicateur, journée publiée). Écrit par l''Edge Function avec la clé service, jamais exposé.';
alter table buta.explication_cache enable row level security;

create or replace view buta.mart_ia_usage as
select jour, fonction, appels, tokens_entree, tokens_sortie, round(cout_eur, 4) as cout_eur
from buta.ia_usage;
comment on view buta.mart_ia_usage is 'Consommation quotidienne des fonctions IA (analyste, expliquer-ecart) : appels, tokens, coût en euros ; alimente le compteur discret de l''écran Analyste.';
grant select on buta.mart_ia_usage to anon, authenticated, analyste_ro;

revoke execute on function buta.executer_lecture(text) from public, anon, authenticated;
revoke execute on function buta.verifier_quota(text, numeric) from public, anon, authenticated;
revoke execute on function buta.journaliser_ia(text, text, text, text, text, numeric, integer, bigint, bigint) from public, anon, authenticated;
grant execute on function buta.executer_lecture(text), buta.verifier_quota(text, numeric),
  buta.journaliser_ia(text, text, text, text, text, numeric, integer, bigint, bigint) to service_role;

-- Catalogue transmis au modèle (IA.md §2) : vues autorisées, description et colonnes lues dans les commentaires SQL,
-- pour que la documentation du modèle et la base disent la même chose.
create or replace function buta.catalogue_analyste()
returns jsonb
language sql
stable
security definer
set search_path = buta, public
as $$
  select jsonb_agg(jsonb_build_object(
    'vue', c.relname,
    'description', obj_description(c.oid, 'pg_class'),
    'colonnes', (
      select jsonb_agg(jsonb_build_object('nom', a.attname, 'type', format_type(a.atttypid, a.atttypmod), 'description', col_description(c.oid, a.attnum)) order by a.attnum)
      from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped))
    order by c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'buta' and c.relkind in ('v', 'm') and c.relname like 'mart\_%'
    and has_table_privilege('analyste_ro', c.oid, 'SELECT');
$$;
comment on function buta.catalogue_analyste() is 'Catalogue des vues mart_ lisibles par analyste_ro (nom, description, colonnes typées et commentées), transmis au modèle de l''analyste.';
revoke execute on function buta.catalogue_analyste() from public, anon, authenticated;
grant execute on function buta.catalogue_analyste() to service_role;
