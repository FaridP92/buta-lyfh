-- 0025 : droits du rôle service sur le schéma buta (lot 4b). Les Edge Functions et n8n appellent l'API REST avec la
-- clé service ; le rôle service_role (bypass RLS) n'avait ni usage sur le schéma ni privilège sur les tables :
-- « permission denied for schema buta » sur tout appel RPC ou lecture. Les fonctions security definer restent
-- réservées à service_role (0004, 0022) ; les rôles anon, authenticated et analyste_ro ne gagnent rien ici.

grant usage on schema buta to service_role;
grant select, insert, update, delete on all tables in schema buta to service_role;
grant usage, select on all sequences in schema buta to service_role;
alter default privileges for role postgres in schema buta grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema buta grant usage, select on sequences to service_role;
