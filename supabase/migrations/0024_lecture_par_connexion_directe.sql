-- 0024 : PostgreSQL interdit « set role » dans une fonction security definer : executer_lecture ne peut pas
-- endosser analyste_ro. Les Edge Functions lisent donc la base par une connexion directe (SUPABASE_DB_URL,
-- injectée dans l'environnement des fonctions, jamais dans le navigateur) et exécutent, dans une même
-- transaction, « set local role analyste_ro » puis « set local statement_timeout = '5s' » puis la requête :
-- le rôle en lecture seule et le délai s'appliquent réellement (ARCHITECTURE.md §4). La fonction est retirée.

drop function if exists buta.executer_lecture(text);
