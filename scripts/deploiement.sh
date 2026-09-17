#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && source .env

npm run check
npm run instantane || echo "instantane ignore (Supabase absent ou vues absentes)"
npm run build

DOSSIER_PARENT=$(dirname "$VPS_RACINE")
DOSSIER=$(basename "$VPS_RACINE")

rsync -az --delete dist/ "$VPS_HOTE:$VPS_RACINE.nouveau/"
# Basculement atomique par renommage ; .well-known (defis Let's Encrypt de Plesk)
# est recopie depuis l'ancienne version pour ne pas casser le renouvellement du certificat.
ssh "$VPS_HOTE" "set -e; cd '$DOSSIER_PARENT'
  rm -rf '$DOSSIER.ancien'
  [ -d '$DOSSIER' ] && mv '$DOSSIER' '$DOSSIER.ancien'
  mv '$DOSSIER.nouveau' '$DOSSIER'
  [ -d '$DOSSIER.ancien/.well-known' ] && cp -a '$DOSSIER.ancien/.well-known' '$DOSSIER/'
  chown -R faridp:psacln '$DOSSIER'"

curl -fsS https://buta.lyfh.fr/ | grep -q 'Buta.Lyfh'
curl -fsS https://buta.lyfh.fr/territoires | grep -q 'Buta.Lyfh'

echo "En ligne : $(date)"
