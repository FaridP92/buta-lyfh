#!/usr/bin/env bash
# Sauvegarde quotidienne de la base Buta / RenovScope (pg_dump format custom), rétention 14 jours.
# Planifié par /etc/cron.d/buta-backup. Restauration :
#   docker compose -f /opt/buta-backend/docker-compose.yml exec -T db pg_restore -U postgres -d buta --clean --if-exists --no-owner < /var/backups/buta/buta-AAAAMMJJ-HHMMSS.dump
set -euo pipefail
DEST=/var/backups/buta
mkdir -p "$DEST"
cd /opt/buta-backend
OUT="$DEST/buta-$(date -u +%Y%m%d-%H%M%S).dump"
docker compose exec -T db pg_dump -U postgres -d buta -Fc -Z 6 -n buta -n buta_prive -n analytics -n qualite -n rag -n staging -n public > "$OUT"
[ -s "$OUT" ] || { echo "dump vide" >&2; rm -f "$OUT"; exit 1; }
chmod 600 "$OUT"
find "$DEST" -name 'buta-*.dump' -mtime +14 -delete
