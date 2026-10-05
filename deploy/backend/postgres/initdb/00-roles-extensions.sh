#!/usr/bin/env bash
# Rôles, réglages et extensions équivalents à un projet Supabase, exécutés une seule fois à l'initialisation.
# Ils doivent exister avant la restauration du dump (GRANT sur anon, authenticated, service_role, analyste_ro, assistant_ro).
set -euo pipefail
psql -v ON_ERROR_STOP=1 -v apw="$AUTHENTICATOR_PASSWORD" -v rpw="$ANALYSTE_RO_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password :'apw';
grant anon, authenticated, service_role to authenticator;
create role analyste_ro login password :'rpw';
create role assistant_ro nologin;
create role supabase_admin nologin;   -- référencé par des ALTER DEFAULT PRIVILEGES du dump

alter role anon set statement_timeout = '3s';
alter role authenticated set statement_timeout = '8s';
alter role authenticator set statement_timeout = '8s';
alter role authenticator set lock_timeout = '8s';
alter role service_role set statement_timeout = '120s';
alter role analyste_ro set statement_timeout = '5s';
alter role analyste_ro set work_mem = '16MB';
alter role analyste_ro set search_path = buta;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role, analyste_ro;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists postgis with schema public;
create extension if not exists pg_cron;
alter database buta set search_path = "$user", public, extensions;
SQL
