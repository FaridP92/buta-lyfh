# Journal de projet

## Décisions ouvertes (à trancher par Frédéric avant la session 1)
- Projet Supabase cible : schéma `buta` dans le projet `renovscope` (iuremijuoxkzvfqyrmcc, eu-west-3) par défaut. Un projet dédié `buta-lyfh` est préférable si le plan de l'organisation autorise un projet actif de plus (le plan gratuit en limite le nombre).
- Clé Anthropic disponible avant samedi soir : oui / non. Sinon Mistral (credential n8n « Mistral Cloud account ») pour l'analyste et la revue hebdomadaire, en le disant sur la page Méthode.
- Sous-domaine `buta.lyfh.fr` créé dans Plesk et certificat actif : oui / non.
- Nom : Buta.Lyfh, choix de Frédéric. La relecture « faits et risques » du 17 septembre signale que la racine de la marque dans le nom et le sous-domaine peut être lue comme présomptueuse ou gênante par l'entreprise, et propose Reseau.Lyfh (reseau.lyfh.fr). Décision de Frédéric à noter ici ; le nom est isolé dans une constante pour changer d'avis en dix minutes.
- Relectures du 17 septembre appliquées : agences simulées nommées par bassin, aucune personne ni entité réelle dans les histoires, décomposition d'écart et atterrissage corrigés, volumétrie recalibrée, coûts d'acquisition et charges d'agence ajoutés, contrôle funnel par cohorte, vues sans `security_invoker`, déploiement Plesk par `.htaccess`, lot 4 scindé.

## Sessions

### Session 1, 17 septembre 2026 : lot 0

Décisions prises (défauts documentés, pas de blocage) :
- Projet Supabase cible : `renovscope` (iuremijuoxkzvfqyrmcc, eu-west-3, actif), schéma `buta`. L'organisation a déjà deux projets actifs sur le plan gratuit, un troisième projet dédié n'est pas raisonnable.
- Nom retenu : Buta.Lyfh, sans changement.
- Écart constaté : ma clé SSH (`~/.ssh/id_ed25519`, alias `vps`) est refusée par `root@51.77.150.125` (« Permission denied »). Le sous-domaine et le certificat sont déjà en place (`https://buta.lyfh.fr` répond 200). Proposition : Frédéric ajoute la clé publique `~/.ssh/id_ed25519.pub` de cette machine à `/root/.ssh/authorized_keys` sur le VPS. Je construis tout le reste du lot 0 en attendant, et je retente le déploiement en fin de lot.

Plan lot 0 (dix lignes) :
1. Scaffold Vite + React 19 + TS strict + Tailwind v4 + shadcn/ui + ECharts + Framer Motion + TanStack Query + Router 7 + Zod + Fontsource.
2. Outillage : oxlint, Prettier, Vitest, Playwright ; `npm run check`.
3. Tokens et thème (DESIGN.md §1-2), bascule sombre/clair, polices auto-hébergées.
4. Mise en page : rail, barre haute, pied réglementaire, tiroir mobile.
5. Onze routes en état « à venir », page Méthode complète.
6. Identité : marque-mot, monogramme, favicons, animation d'ouverture, motif point ambre.
7. `scripts/deploiement.sh`, `verif-tirets.ts`, `verif-sources.ts` (squelette).
8. Revue « interface générée » (DESIGN.md §9) sur coquille et Méthode.
9. Captures 1280/375, comparaison DESIGN.md.
10. Déploiement réel (bloqué par l'accès SSH, voir ci-dessus), commit.

Résultat : l'accès SSH a été rétabli en cours de session (clé ajoutée par Frédéric), le déploiement a eu lieu.

Critères d'acceptation du lot 0 (BACKLOG) :
- [x] URL en ligne : `npm run deploiement` puis « En ligne : Thu Sep 17 21:02:08 CEST 2026 ». `curl -I` sur `/`, `/territoires`, `/index.html`, `/assets/index-*.js`, `/favicon.svg`, `/identite/marque-sombre.svg`, `/robots.txt` : HTTP/2 200, TLS 1.3, certificat Let's Encrypt (expire le 16 décembre 2026), les quatre en-têtes (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) présents partout, `Cache-Control: no-cache` sur le HTML.
- [x] Logo et favicon en place : `public/favicon.svg`, `favicon-32.png`, `favicon-180.png`, `public/identite/marque-{sombre,clair,mono}.svg` (police Instrument Serif embarquée en base64, aucune requête externe), composants `Marque` et `Monogramme`, animation d'ouverture (capture `docs/captures/lot0/ouverture-animation.png`), point ambre sur la route active (`rail-actif.png`).
- [x] Lighthouse accessibilité > 95 : sur https://buta.lyfh.fr/methode, performance 100, accessibilité 100, bonnes pratiques 100, SEO 100 (FCP 0,8 s, LCP 1,5 s, TBT 30 ms). Premier passage local : 85 en accessibilité, corrigé (voir écarts).
- [x] Zéro tiret long : `npm run verif:tirets` vert sur `src/`, `docs/`, `supabase/`, `n8n/`, `scripts/`.
- [x] `npm run check` vert (tsc strict, oxlint 0/0, Vitest 12/12, verif:tirets, verif:sources en mode avertissement tant que le lot 1 n'est pas livré).
- [x] `npm run e2e` : 26/26 (onze routes en 1280 et 375 px sans erreur console, palette Cmd K, mention réglementaire sur chaque page), en local sur le build et en ligne avec `E2E_BASE=https://buta.lyfh.fr`.
- [x] Revue « interface générée » (DESIGN.md §9) sur la coquille et Méthode : pas de bandeau centré (titre serif à gauche, période à droite) ; un seul titre serif par écran ; Lucide 1,5 px uniquement, aucun emoji, aucune icône dans un rond ; une seule lumière (ambre) ; rayon 14 px sur les cartes seulement, bordures à 8 % de blanc, aucune ombre en sombre ; échelle d'espacement 4/8/12/20/32/52 en tokens ; état « à venir » avec une phrase utile et le lot, pas d'icône triste ; mouvement lié au contenu (le point s'allume, le mot apparaît, rien en boucle). Captures : `docs/captures/lot0/`.
- [x] Bundle : 448 Ko de JavaScript, 143,6 Ko compressé (budget 900 Ko), CSS 24 Ko, polices latin et latin-ext seulement.

Écarts et décisions (lot 0) :
- DESIGN.md §1 donne `--texte-3: #6B7488`, mais §7 exige le contraste AA : ce gris fait 4,09:1 sur le fond et 3,52:1 sur `surface-2`. Appliqué : `#808A9D` en sombre (5,52:1 et 4,76:1), `#5B677D` en clair. De même l'ambre « assombri de 10 % » (`#DCA400`) fait 2,1:1 en texte sur fond clair : deux tokens ajoutés, `--ambre-texte` et `--menthe-texte` (identiques aux accents en sombre, `#8A6500` et `#0F766E` en clair), et les accents du thème clair descendus sous 3:1 minimum pour les composants (ratios calculés et vérifiés par script). À reporter dans DESIGN.md §1 si Frédéric valide.
- Vite inline les assets sous 4 Ko en `data:` URI, ce que la CSP `font-src 'self'` bloque (six polices bloquées en production, invisibles en dev). Décision : `assetsInlineLimit: 0` et import des seuls sous-ensembles latin et latin-ext de Fontsource. La CSP de DEPLOIEMENT_VPS.md §3 est conservée telle quelle.
- Radix `Tooltip.Trigger asChild` fusionne `className` comme une chaîne et casse la forme fonction `({ isActive }) => ...` de `NavLink` (la classe rendue contenait le code source de la fonction). Le rail calcule l'état actif avec `useLocation`. Le tiroir mobile, non enveloppé par Radix, garde la forme fonction.
- Page Méthode, liens de l'auteur (fournis par Frédéric en session) : LinkedIn `https://www.linkedin.com/in/f-poissonnier/`, projets « Courant » (`https://courant-sable.vercel.app/`, à la place de RenovScope cité dans ECRANS.md et CLAUDE.md) et « CoPilote Atelier » (`https://copilote-atelier.vercel.app/`), contact `faridp@free.fr`. Le CV est attendu à `/cv-frederic-poissonnier.pdf` : le fichier n'existe pas encore, à déposer dans `public/` (le lien renvoie 404 d'ici là).
- Plesk : nginx proxifie tout vers Apache (`AllowOverride FileInfo` actif), le `.htaccess` fait les réécritures et pose les en-têtes. « Servir les fichiers statiques directement par nginx » et le bloc `location /assets/` immutable ne sont pas configurés : confort, pas nécessaire (assets hachés). Le script de déploiement recopie `.well-known` depuis l'ancienne version pour préserver les défis Let's Encrypt.
- Le bouton « Exporter » de la barre haute et « Exporter pour Power BI » sont présents mais désactivés (infobulle « disponible au lot 2 / lot 3 ») : pas de faux contenu, l'état est dit.
- Le badge de fraîcheur affiche « Pas encore de donnée chargée » tant que `mart_kpi_mensuel` n'existe pas.
- Sélecteur de période : une seule option (mois courant) tant qu'aucune donnée n'existe ; branché sur l'URL (`?periode=`, `?comparaison=`, `?agence=`) dès maintenant.
- `SUPABASE_SERVICE_ROLE_KEY` et `SUPABASE_DB_URL` ne sont pas exposés par le MCP Supabase : `.env` les laisse vides. Cette session charge schéma et données par le MCP (`apply_migration`, `execute_sql`). À renseigner par Frédéric pour rejouer les scripts hors session.

À vérifier :
- Déposer `public/cv-frederic-poissonnier.pdf`.
- Reporter les nouvelles valeurs de tokens dans DESIGN.md §1 ou les contester.
- Test sur téléphone réel en 4G (DEPLOIEMENT_VPS.md §4) : à faire par Frédéric.
