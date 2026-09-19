-- 0033 : relecture de l'écran Analyste (19 septembre 2026, lentilles faits et recruteur).
-- 1. Les questions posées à l'analyste sont journalisées en clair avec une empreinte hachée (0022) ; elles ne sont
--    utiles que pour comprendre les échecs récents : purge quotidienne au-delà de 30 jours (pg_cron, 03:40 UTC).
-- 2. mart_automatisation.id était la seule colonne du catalogue encore sans commentaire (305 colonnes).
create or replace function buta.purger_journal_analyste(p_jours integer default 30)
returns integer
language plpgsql
security definer
set search_path = buta, pg_temp
as $$
declare
  n integer;
begin
  delete from buta.analyste_question where pose_le < now() - make_interval(days => p_jours);
  get diagnostics n = row_count;
  return n;
end;
$$;
comment on function buta.purger_journal_analyste(integer) is 'Supprime les questions journalisées de plus de p_jours jours (30 par défaut) ; appelée chaque nuit par pg_cron. Le journal d''usage (ia_usage, agrégé par jour) n''est pas concerné.';
revoke execute on function buta.purger_journal_analyste(integer) from public, anon, authenticated;
grant execute on function buta.purger_journal_analyste(integer) to service_role;

select cron.schedule('buta_purge_questions', '40 3 * * *', $$select buta.purger_journal_analyste(30)$$);

comment on column buta.mart_automatisation.id is 'Identifiant de l''exécution dans le journal.';
