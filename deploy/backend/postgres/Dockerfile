# Postgres 17 avec les extensions du projet Supabase d'origine : PostGIS, pgvector, pg_cron (pg_trgm, pgcrypto, uuid-ossp en contrib).
FROM postgres:17-bookworm
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-17-postgis-3 postgresql-17-postgis-3-scripts postgresql-17-pgvector postgresql-17-cron \
 && rm -rf /var/lib/apt/lists/*
