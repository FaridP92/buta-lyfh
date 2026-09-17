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

Commit lot 0 : `4ece850`.

### Session 1, 17 septembre 2026 : lot 1

Plan lot 1 (dix lignes) :
1. Migration 0001 : schéma `buta`, dimensions, faits, marché, exploitation, index, commentaires (DONNEES.md §4.1 à 4.4).
2. Migration 0002 : RLS sur toutes les tables, politique `lecture_publique`, grants, rôle `analyste_ro` (§4.8).
3. Seed des référentiels (`supabase/seed/`) : agences par bassin, territoires, effectifs codés, canaux, produits, statuts, dates, départements, contrôles.
4. `scripts/ingerer-marche.ts` : Insee, RGE, RTE, DPE, contours simplifiés, contrôles de totaux, `source_fraicheur`.
5. `scripts/generer-activite.ts` : PRNG à graine fixe 20260922, règles §3.3, sept histoires §3.4, coûts, charges, objectifs, contrôles du générateur, chargement, publication jusqu'à J-1.
6. Migration 0003 : seize vues `mart_` avec `COMMENT ON`, vues matérialisées, `rafraichir_marts()`.
7. Migration 0004 : fonctions et RPC (`publier_journee`, `executer_controles`, `faits_revue_hebdo`, `publier_revue`, `journal_run`, `upsert_marche_departement`).
8. Tests SQL : `supabase/tests/histoires.sql` (une requête par histoire), funnel monotone, totaux, résiduel d'écart sous 3 %, douze contrôles.
9. `scripts/instantane.ts` et client `src/donnees/` (Zod, `useVue`, repli instantané).
10. Advisors Supabase, skill supabase-rls-guard, test négatif anon sur `fait_dossier`, journal, commit.

État au fil de la session (mis à jour à la fin du lot) :
- Migrations 0001 à 0005 appliquées par le MCP sur `renovscope` (schéma `buta` : 26 tables, seize vues `mart_` dont trois matérialisées, sept fonctions RPC, rôle `analyste_ro` sans mot de passe pour l'instant). Seeds chargés : 11 départements, 9 agences, 18 territoires, 44 commerciaux, 52 techniciens, 8 canaux, 8 produits, 10 statuts, 730 jours, 12 contrôles, 12 plans d'action.
- `scripts/ingerer-marche.ts` (écrit et exécuté par un fork) : téléchargements et calculs faits, cache dans `.cache/marche/`, GeoJSON simplifiés sous 300 Ko par département (départements 100 m : 1 108 Ko). Chiffres de contrôle : 18 sur 20 exacts à l'unité ; RTE 17 et 59 obtenus 23 520 et 23 394 contre 23 076 et 22 651 attendus (+1,9 % et +3,3 %) : le registre RTE a été rafraîchi depuis le calcul des constantes, valeurs confirmées sur l'API en direct. Chargement en base en attente de `SUPABASE_DB_URL`.
- `scripts/generer-activite.ts` : à blanc, 43 851 dossiers sur 24 mois, CA signé 37,1 M€, acquisition 16,9 % du CA (cible 12 à 22 %), contrôles du générateur verts. Chargement en attente de `SUPABASE_DB_URL`.
- Deux gestes tableau de bord attendus de Frédéric (guidés en session) : `SUPABASE_DB_URL` dans `.env` (Connect, Session pooler) et `buta` dans « Exposed schemas » (Settings, Data API). PostgREST répond PGRST106 tant que le second n'est pas fait.

Écarts et décisions (lot 1, en cours) :
- Colonnes ajoutées à `fait_dossier` par rapport à DONNEES.md §4.2 : `empreinte_contact` (contrôle 5, doublons), `produit_libelle_source` (contrôle 9 et H4), et `remise` nommée `taux_remise` (taux entre 0 et 1, sans ambiguïté avec un montant). `dim_produit` porte en plus `part_mix_base` et `profil_saison` (règles §3.3 rendues lisibles en base). `controle` porte `ordre`.
- Les vues lisent les dossiers publiés « à la journée publiée » (`buta.journee_publiee()`, vue interne `dossier_a_date`) : toute date postérieure est masquée, le réalisé ne contient jamais le futur simulé. Le `statut` stocké est l'état final du dossier ; l'état à date se déduit des dates.
- Décomposition d'écart : avec un taux de remise moyen pondéré par les prix, la formule d'INDICATEURS.md est exactement télescopique, le résiduel est nul par construction (pas seulement sous 3 %).
- Probabilité d'atteinte : loi normale analytique (`buta.phi`) sur le run-rate plutôt que 500 tirages à graine fixe (même sens, déterministe, calculable dans une vue).
- H3 Saintonge : avec le modèle de coûts de DONNEES.md §3.3 (matériel et pose au prix catalogue nominal), passer la remise de 4 % à 9 % baisse le taux de marge d'environ 3,8 points, pas 3 : le test attend -2,4 à -5 points et la doc devrait dire « environ 4 points ».
- H7 Bassin d'Arcachon : avec 4 commerciaux et 15 % de la Gironde, l'agence signe environ 9 dossiers par mois ; un carnet de 30 jours ouvrés n'est pas atteignable à ces volumes. Le test vérifie l'effet relatif (retards +22 j, carnet au moins doublé), pas les valeurs absolues « 30 à 68 jours ».
- Leads mensuels : les propriétaires occupants par département sont figés dans le générateur (Insee 2022 arrondis, dix départements = 1 755 000, Nord = 623 000) pour que le jeu ne dépende pas de l'état de `marche_departement`. La saisonnalité est normalisée pour redistribuer les leads dans l'année sans changer le volume annuel.
- Commune du dossier laissée nulle (le département est le grain géographique des indicateurs) ; aucune coordonnée de dossier n'existe donc.
- `scripts/lib/bd.ts` a été écrit en même temps par le fork et par moi ; version fusionnée (pool et client, upsert et insertion par lots).
- Advisors après migrations : `function_search_path_mutable` sur `journee_publiee` et `phi` (corrigé, 0005) ; `rls_enabled_no_policy` sur `fait_dossier`, `fait_cout_canal`, `ia_usage`, `analyste_question`, `visite` : voulu (aucune lecture directe, seules les vues agrégées exposent). Les autres remarques (`spatial_ref_sys`, PostGIS dans public, `st_estimatedextent`, schémas analytics, qualite, rag, staging) concernent le projet renovscope existant, hors périmètre. `security_definer_view` n'apparaîtra qu'une fois le schéma exposé : assumé.
- DONNEES.md §1 : les totaux « France » Insee et DPE sont France entière ; la métropole seule donne 31 911 516 RP et 730 791 maisons F ou G. RTE : 23 520 (17) et 23 394 (59) à date. L'API RGE n'a pas de code Insee : résolu par code postal, nom normalisé puis centre le plus proche (fork).

Audit RLS (skill supabase-rls-guard, exécuté sur la base après les migrations 0001 à 0006) :

| Qui | Quoi | Opération | Preuve |
|---|---|---|---|
| anon, authenticated | 21 tables (dimensions, marché, objectifs, charges, plans, revues, contrôles, journal n8n, fraîcheur) | SELECT par politique `lecture_publique` + grant | `pg_policies` : 21 politiques, toutes `[anon, authenticated]`, `cmd = SELECT` ; aucune politique d'écriture |
| anon, authenticated, analyste_ro | seize vues `mart_` (dont trois matérialisées) | SELECT par grant, vues exécutées avec les droits du propriétaire | `set local role anon` : `mart_kpi_mensuel` répond (210 lignes) ; `set local role analyste_ro` : `mart_forecast` répond (20 lignes) |
| personne (hors service_role et postgres) | `fait_dossier`, `fait_cout_canal`, `ia_usage`, `analyste_question`, `visite`, vue interne `dossier_a_date` | aucune | `set local role anon` puis `analyste_ro` sur `fait_dossier` : « permission denied for table fait_dossier » |
| service_role seulement | `publier_journee`, `executer_controles`, `faits_revue_hebdo`, `publier_revue`, `journal_run`, `recalculer_indices`, `upsert_marche_departement`, `rafraichir_marts` (security definer, `search_path` figé) | EXECUTE | `anon` sur `publier_journee` et `analyste_ro` sur `executer_controles` : « permission denied for function » |
| tout le monde | `journee_publiee()`, `phi()` (lecture seule, `search_path` figé par 0005) | EXECUTE | advisors : plus d'alerte `function_search_path_mutable` |

RLS activée sur les 26 tables (`relrowsecurity = true` partout). `analyste_ro` : `rolcanlogin = true`, `rolconfig = statement_timeout=5s ; work_mem=16MB ; search_path=buta` (appliqués à la connexion du rôle par le pooler, pas sous `SET ROLE`), mot de passe à poser au lot 4b hors dépôt. Migration 0006 : `grant analyste_ro to postgres` pour permettre les tests par `SET ROLE` (postgres n'est pas superutilisateur sur Supabase). Advisors après 0005 : sur `buta`, seulement `rls_enabled_no_policy` (INFO) sur les cinq tables volontairement fermées.
