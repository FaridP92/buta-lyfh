# Backend Buta.Lyfh et RenovScope (VPS)

Depuis le 5 octobre 2026, la base et l'API de Buta.Lyfh ne sont plus un projet Supabase : elles tournent dans des conteneurs Docker sur le VPS, avec le même contrat (`/rest/v1`, `/functions/v1`). Une seule base Postgres 17 `buta` porte les schémas `buta`, `buta_prive`, `analytics`, `qualite`, `rag` et `staging` (extensions PostGIS, pgvector, pg_trgm, pgcrypto, uuid-ossp, pg_cron). Elle a été copiée par `pg_dump` depuis Supabase : 45 tables aux comptes et empreintes identiques, structure identique (colonnes, fonctions, index, policies, contraintes, droits).

| Service | Rôle | Accès |
|---|---|---|
| `db` | Postgres 17 avec TLS (certificat auto-signé) | `127.0.0.1:54321` seulement |
| `rest` | PostgREST, schémas exposés `buta` et `analytics` | `https://buta.lyfh.fr/rest/v1/` (nginx, port local 3011) |
| `fn-analyste`, `fn-expliquer-ecart` | Edge Functions de `supabase/functions` (Deno 2.5.6, la 2.1 bloque TLS avec postgres.js) | via la passerelle |
| `gateway` | contrôle du JWT (équivalent de `verify_jwt`), puis relais | `https://buta.lyfh.fr/functions/v1/<nom>` (port local 8110) |

## Installation sur le VPS (`/opt/buta-backend`)
1. Copier `deploy/backend/` vers `/opt/buta-backend/` et `supabase/functions/` vers `/opt/buta-backend/functions/`.
2. Créer `.env` (modèle `.env.example`, `chmod 600`) : mots de passe Postgres, `JWT_SECRET` (HS256), `SERVICE_ROLE_KEY` et la clé anon (JWT signés avec ce secret, rôles `service_role` et `anon`), `IA_SEL`, `MISTRAL_API_KEY`, `ANTHROPIC_API_KEY` facultative (sinon repli Mistral).
3. Certificat TLS de la base : `certs/server.crt` et `certs/server.key` (auto-signé, clé en `chown 999:999`, `chmod 600` ; le dossier doit rester lisible).
4. `docker compose up -d db`, puis restaurer le dump : `docker compose exec -T db pg_restore -U postgres -d buta --no-owner -L <liste sans le schéma public> < dump` (les rôles et extensions sont créés par `postgres/initdb/00-roles-extensions.sh` à la première initialisation). Recréer la tâche `buta_purge_questions` (`cron.schedule`, migration 0033).
5. `docker compose up -d`.

## Exploitation
- nginx : `/var/www/vhosts/system/buta.lyfh.fr/conf/vhost_nginx.conf` (blocs `/rest/v1/` et `/functions/v1/`, sauvegardes datées dans `/root/backups-dvf`).
- Migration SQL : `docker compose exec -T db psql -U postgres -d buta < supabase/migrations/NNNN_xxx.sql`.
- Sauvegarde : `backup.sh`, planifiée par `/etc/cron.d/buta-backup` à 03h50 UTC dans `/var/backups/buta` (14 jours). Restauration documentée en tête du script.
- Accès SQL depuis un poste : `ssh -L 54321:127.0.0.1:54321 vps`, puis `postgresql://postgres:<mot de passe .env>@127.0.0.1:54321/buta` (scripts : `SUPABASE_DB_SSL_NON_VERIFIE=1`).
- n8n : les cinq workflows Buta et le credential « Supabase Buta (service role) » (hôte `https://buta.lyfh.fr`, clé `service_role` du backend) visent cette API.
- Fonctions : mises à jour en copiant `supabase/functions` vers `/opt/buta-backend/functions`, puis `docker compose up -d --force-recreate fn-analyste fn-expliquer-ecart`.
