-- 0023 : executer_lecture refusait tout (« \b » n'est pas une frontière de mot en PostgreSQL, c'est « \y »).
-- Accepte aussi une requête qui commence par « with » (CTE) : la validation fine (mots interdits, vues
-- autorisées, limite) est faite par l'Edge Function avant l'appel, ceci reste le dernier verrou.

create or replace function buta.executer_lecture(p_sql text)
returns json
language plpgsql
security definer
set search_path = buta, public
as $$
declare
  resultat json;
begin
  if p_sql !~* '^\s*(select|with)\y' then
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
