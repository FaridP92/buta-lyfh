# Déploiement sur le VPS (OVH, Plesk)

Faits connus du VPS (repris du projet LYFH, `DEPLOY.md`) : hôte `51.77.150.125`, Plesk, PHP-FPM 8.4 pour les autres sites, sites sous `/var/www/vhosts/lyfh.fr/`, utilisateur système de l'abonnement `faridp`, accès SSH root par clé. La clé de déploiement GitHub de LYFH est verrouillée sur un script et ne sert pas ici. n8n tourne sur le même VPS sous `n8n.lyfh.fr`.

## 1. Préparation (Frédéric, une fois)
1. Plesk : Sites web et domaines, Ajouter un sous-domaine `buta` sur `lyfh.fr`, racine `/var/www/vhosts/lyfh.fr/buta.lyfh.fr`. DNS : la zone `lyfh.fr` est chez Cloudflare (serveurs `dion` et `rosa.ns.cloudflare.com`), pas dans Plesk : créer l'enregistrement `A buta 51.77.150.125` dans Cloudflare en mode « DNS only » (nuage gris, comme `n8n.lyfh.fr`), pas en mode proxy ; vérifier avec `dig +short A buta.lyfh.fr` avant de demander le certificat. Puis certificat Let's Encrypt via Plesk, méthode HTTP (http-01), redirection HTTPS forcée. Constaté le 17 septembre : sans cet enregistrement, Plesk répond « Échec de l'autorisation pour le domaine ».
2. Plesk, Paramètres Apache et nginx du sous-domaine. Plesk génère lui-même un bloc `location /` : ajouter un second `location /` dans « Directives nginx supplémentaires » est refusé à l'enregistrement sur la plupart des versions. Ne pas insister. Chemin retenu :
   - Laisser le mode proxy Apache actif et cocher « Servir les fichiers statiques directement par nginx » (les assets partent par nginx, les routes profondes arrivent à Apache).
   - Les routes de l'application sont réécrites par un `.htaccess` versionné dans `public/` (donc livré dans `dist/`) :
```
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ /index.html [L]
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "DENY"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
  <FilesMatch "\.html$">
    Header always set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
```
   - Dans « Directives nginx supplémentaires », uniquement des `add_header ... always;` (les quatre en-têtes de sécurité) et, si Plesk l'accepte, un bloc `location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable" always; }` qui répète aussi les quatre en-têtes de sécurité (en nginx, un `add_header` local efface ceux du niveau supérieur). Si Plesk refuse le bloc, s'en passer : les assets de Vite portent un hachage dans leur nom, le cache d'un an est un confort, pas une nécessité.
   - Constaté le 24 septembre (gatekeeper) : les réponses servies directement par nginx (`/`, `/index.html`, `/assets/`) ne portaient aucun des quatre en-têtes, seules les routes réécrites par Apache les avaient, et HSTS manquait partout. À poser dans « Directives nginx supplémentaires » du sous-domaine (Plesk, hors dépôt), puis vérifier par `curl -I` sur `/` et sur un fichier de `/assets/` :
```
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Strict-Transport-Security "max-age=31536000" always;
```
     Le `.htaccess` porte les mêmes cinq en-têtes pour les réponses qui passent par Apache.
   - Tester la sauvegarde des directives dès cette étape. En cas de doute, la vérité est donnée par `curl -I` sur `/`, `/territoires`, `/index.html` et un fichier de `/assets/` après le premier déploiement : chaque réponse doit porter les quatre en-têtes.
3. Vérifier : `curl -I https://buta.lyfh.fr` répond 200 (page Plesk par défaut) avec un certificat valide.

## 2. Script `scripts/deploiement.sh` (écrit au lot 0)
```
set -euo pipefail
npm run check                      # verif:sources et instantane tolèrent l'absence de vues (avertissement, code 0) tant que le lot 1 n'est pas livré
npm run instantane || echo "instantané ignoré (API absente ou vues absentes)"
npm run build
rsync -az --delete dist/ "$VPS_HOTE:$VPS_RACINE.nouveau/"
ssh "$VPS_HOTE" "cd $(dirname $VPS_RACINE) && rm -rf buta.lyfh.fr.ancien && mv buta.lyfh.fr buta.lyfh.fr.ancien && mv buta.lyfh.fr.nouveau buta.lyfh.fr && chown -R faridp:psacln buta.lyfh.fr"
curl -fsS https://buta.lyfh.fr/ | grep -q 'Buta.Lyfh'
curl -fsS https://buta.lyfh.fr/territoires | grep -q 'Buta.Lyfh'
echo "En ligne : $(date)"
```
Le basculement par renommage rend le déploiement atomique et réversible (`mv` inverse). Le premier déploiement crée le dossier au lieu de le renommer. Le contenu Plesk par défaut est écrasé, c'est voulu.

## 3. Contenu de la politique de sécurité de contenu
`Content-Security-Policy` posée en balise meta dans `index.html` (nginx Plesk ne la porte pas facilement) : `default-src 'self'; connect-src 'self' https://geo.api.gouv.fr; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'`. L'API de données est servie en même origine (`/rest/v1`, `/functions/v1`) : `'self'` suffit, aucun domaine externe à autoriser. `frame-ancestors` n'est pas honoré dans une balise meta : la protection contre l'encadrement vient de l'en-tête `X-Frame-Options DENY` posé par nginx ci-dessus.

## 4. Contrôles après chaque mise en ligne
- `curl -I` sur `/`, `/territoires`, `/index.html` et un fichier de `/assets/` : code 200, TLS valide, les cinq en-têtes (les quatre de sécurité et `Strict-Transport-Security`) présents partout, `Cache-Control: no-cache` sur le HTML.
- `npm run e2e` contre `https://buta.lyfh.fr` (variable `E2E_BASE`), en 1280 px et 375 px, zéro erreur console.
- Lighthouse (Chrome headless) : performance, accessibilité, bonnes pratiques, SEO, résultats notés dans le journal.
- Test sur téléphone réel (4G, hors wifi) : page d'accueil et Territoires.
- Recherche de tirets longs et de la mention réglementaire dans `dist/index.html` et dans le bundle (script `verif:tirets` sur `dist/`).
- `https://buta.lyfh.fr/fiche.pdf` et `https://buta.lyfh.fr/synthese.pdf` répondent 200 en `application/pdf` : copiés depuis `docs/FICHE.pdf` et `docs/SYNTHESE.pdf` par `scripts/copier-documents.ts` à la construction, le `.htaccess` ne réécrit pas les fichiers existants.

## 5. Déploiement continu (palier C)
GitHub Actions sur `main` : `npm ci`, `npm run check`, `npm run build`, rsync par SSH avec une clé dédiée verrouillée sur un script `/usr/local/bin/buta-deploy.sh` (même motif que LYFH : la clé ne peut que déclencher le script). Inerte tant que la variable `DEPLOY_ENABLED` n'est pas à `true`.

## 6. Retour arrière
`ssh $VPS_HOTE "cd /var/www/vhosts/lyfh.fr && mv buta.lyfh.fr buta.lyfh.fr.casse && mv buta.lyfh.fr.ancien buta.lyfh.fr"` puis vérification `curl`. Toujours garder la version précédente jusqu'au déploiement suivant.
