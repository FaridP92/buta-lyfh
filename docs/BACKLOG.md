# Backlog par lots

Chaque lot se termine par `npm run check`, les captures comparées à DESIGN.md, les critères cochés dans JOURNAL.md avec la preuve, un commit, et un déploiement (à partir du lot 0).

## Lot 0 · Socle et mise en ligne (session 1, vendredi matin)
- US-001 Dépôt initialisé (Vite, React, TypeScript strict, Tailwind v4, shadcn/ui, ECharts, Framer Motion, TanStack Query, Router, Zod, Fontsource, oxlint, Prettier, Vitest, Playwright), `npm run check` vert sur un projet vide.
- US-002 Tokens et thème (DESIGN.md §1 et §2), bascule sombre et clair, polices auto-hébergées.
- US-003 Mise en page : rail, barre haute (période, comparaison, agence, Cmd K, Exporter, fraîcheur), pied de page réglementaire, tiroir mobile.
- US-004 Onze routes avec un état « en construction » propre (titre, une phrase, pas de faux contenu) ; page Méthode complète dès ce lot.
- US-005 `scripts/deploiement.sh`, premier déploiement réel, HTTPS, `curl` vert, capture téléphone.
- US-006 `verif:tirets`, `verif:sources` (squelette), README.
- US-007 Identité (DESIGN.md §10) : marque-mot et monogramme en SVG, favicons, animation d'ouverture, motif du point ambre dans le rail ; captures comparées à la description.
- US-008 Revue « interface générée » (DESIGN.md §9) sur la coquille et la page Méthode : chaque ligne du tableau vérifiée, écarts corrigés avant déploiement.
Critères : URL en ligne, logo et favicon en place, Lighthouse accessibilité supérieur à 95 sur la coquille, zéro tiret long, journal rempli.

## Lot 1 · Données (session 1, vendredi après-midi)
- US-010 Migrations : dimensions, faits, marché, exploitation, vues, RLS, rôles, fonctions (DONNEES.md §4) ; advisors passés ; skill supabase-rls-guard.
- US-011 `ingerer-marche.ts` : Insee, RGE, RTE, DPE, contrôles de totaux, `source_fraicheur`.
- US-012 `generer-activite.ts` : réseau de neuf agences nommées par bassin, effectifs codés, canaux, produits, règles, objectifs au grain produit, charges d'agence, sept histoires, contrôles du générateur, chargement, publication jusqu'à J-1 (et `npm run publier -- --jusqua AAAA-MM-JJ` pour publier d'avance).
- US-013 Vues `mart_` avec `COMMENT ON`, vues matérialisées, `rafraichir_marts()`, tests SQL (funnel monotone, totaux, sept histoires retrouvées par requête : une requête par histoire dans `supabase/tests/histoires.sql`).
- US-014 `instantane.ts` et lecture de secours dans le front.
Critères : chiffres de contrôle retrouvés à 0,5 % ; les sept requêtes d'histoires renvoient les effets attendus ; résiduel de la décomposition d'écart sous 3 % ; seuls KO attendus des contrôles : agence Nord sur l'intégration ; aucune table de faits lisible par anon ; advisor `security_definer_view` assumé et noté.

## Lot 2 · Écrans de pilotage (session 2, samedi)
Ordre de valeur si le temps manque : Vue d'ensemble, puis Ventes et marge, puis Forecast, puis Funnel.
- US-020 Vue d'ensemble (ECRANS.md §1) avec phrases par règles.
- US-021 Funnel et leads (§3), Sankey, matrice, qualité des leads, leads en attente.
- US-022 Ventes et marge (§4), cascade, matrice, remises, règle de remise (`lib/remise.ts` testé).
- US-023 Forecast et atterrissage (§5), éventail, hypothèses, curseur (`lib/forecast.ts` testé), risques et opportunités.
- US-024 Filtres URL, fiche indicateur (panneau), palette de commandes, export CSV et XLSX des tableaux.
Critères : chaque composant de la fiche d'écran présent ; animation signature de chaque écran (DESIGN.md §11) en place et fluide ; revue « interface générée » (DESIGN.md §9) passée sur chaque écran ; histoires H1, H2, H3, H5, H6, H7 visibles (H5 par le taux d'annulation des départements couverts à distance sur Ventes) ; 375 px lisible ; captures validées.

## Lot 3 · Territoires et qualité (session 2, samedi soir)
- US-030 Territoires (§2) : carte départements, composantes et curseurs (`lib/indice.ts` testé), tableau, zoom communes, agences et RGE, bloc gaz citerne.
- US-031 Qualité et référentiels (§8) : score, douze contrôles, fraîcheur, référentiels, lignage.
- US-032 Méthode (§11) enrichie : histoires listées, hypothèses, contexte public cité une fois, sources, export Power BI palier A (zip : CSV des vues mart et `modele_etoile.md`).
Critères : sources et licences affichées ; H4 visible ; GeoJSON communes simplifiés sous 300 Ko par département ; palier A complet et déployé.

## Lot 4a · Automatisation du palier A (session 3, dimanche)
- US-040 WF1 et WF2 créés, testés, publiés, exportés ; badge de fraîcheur alimenté ; alertes de la Vue d'ensemble issues des contrôles ; journées publiées d'avance jusqu'au 25 septembre. Publication faite le 19 septembre à 13 h (credential créé par Frédéric, exécutions manuelles, exports dans `n8n/`) ; tâches pg_cron de secours conservées jusqu'au contrôle de lundi matin.
- US-041 WF5 (santé). Relecture du palier A, corrections, déploiement propre. WF0 et WF5 publiés le 19 septembre.
Critères : WF1, WF2, WF5 ont une ligne de journal réussie ; palier A irréprochable en ligne dimanche soir.

## Lot 4b · Palier B (lundi, seulement si le palier A est irréprochable)
- US-042 Edge Functions `analyste` et `expliquer-ecart`, secrets, quotas, journal, jeu d'évaluation à 90 %. Fait le 19 septembre : clé posée le 18 au soir, évaluation 21/24 puis 23/24 puis 24/24 (migration 0031 : catalogue commenté colonne par colonne et surcharge `round` ; socle IA : cache du prompt, budgets de sortie, rejeu sans réflexion) ; écran Analyste en navigation, parcours Playwright `e2e/analyste.spec.ts`.
- US-043 WF3 et WF4 ; écrans Automatisations (§9), Analyste (§10), bouton Expliquer sur Ventes et Vue d'ensemble. Décision du 18 septembre : WF4 (marché mensuel) n'est pas construit avant l'entretien, le rejeu mensuel des sources de marché reste un script (`npm run ingerer:marche`) ; l'écran Automatisations ne le montre pas. WF3 publié le 19 septembre après exécution manuelle (revue du 07/09 rédigée par Mistral, contrôlée, publiée).
- US-044 Pose et encaissement (§6), Plans d'action et rituels (§7) avec la revue générée ; `mesures.dax` et `LISEZMOI.md` dans l'export Power BI (skill powerbi-dax-expert).
Critères : chaque workflow a une ligne de journal réussie ; l'analyste répond aux 24 questions selon l'attendu ; budget visible. Tout écran non fini est retiré de la navigation.

## Lot 5 · Qualité finale (lundi, gel à 20 h)
- US-050 Playwright complet (routes, filtres, export, palette, analyste, mobile), Lighthouse, accessibilité clavier.
- US-051 Relecture par workflow de réfutation (mode ultracode, trois lentilles : faits contre DONNEES.md et INDICATEURS.md, forme et typographie, recruteur Butagaz simulé), corrections.
- US-052 Retrait de la navigation de tout écran non fini ; test téléphone 4G ; gel à 20 h ; journal final ; commit ; déploiement.
- US-053 Fiche de présentation illustrée pour un lecteur étranger au projet : `npm run fiche` génère `docs/FICHE.html` et `docs/FICHE.pdf` depuis `docs/GUIDE_ILLUSTRE.md` seul (couverture, repères, sommaire, chaque visuel avec sa capture et sa lecture, notice) ; la page est aussi publiée comme lien partageable. Fait le 19 septembre.
- US-054 Signaux animés des cartes KPI (demande de Frédéric du 19 septembre) : carte qui s'enflamme à -20 % ou -5 points (éclats et secousse du premier essai remplacés le jour même), gerbe à +10 % ou +3 points, règle testée dans `src/lib/signaux.ts`, canvas `SignalCarte`, une fois par période, rien en mouvement réduit. Fait le 19 septembre.
- US-055 Logo fourni par Frédéric (19 septembre) : monogramme détouré dans le rail et les favicons, couverture et en-tête de la fiche de présentation, thème du document aux couleurs du logo (bleu et menthe). Fait le 19 septembre.
- US-056 Thème de l'application aligné sur le logo (décision de Frédéric du 19 septembre, 14 h 30) : mot-marque « BUTA.LYFH » en Montserrat 800 avec le monogramme, accent menthe (token `--accent`) à la place de l'ambre pour l'identité et l'interaction, ambre conservé pour « simulé », « attention » et les paliers de charge ; palette des séries réordonnée ; captures du guide et chiffres du texte refaits sur la journée publiée du 18/09. Fait le 19 septembre.
- US-057 Balises Open Graph et Twitter Card avec une capture de l'accueil en 1200 × 630 (demande de Frédéric du 19 septembre). Fait le 20 septembre (PR 1).
- US-058 Guide illustré et fiche : date d'entretien et « recruteur simulé » retirés, coordonnées de l'auteur en couverture et en pied (`scripts/lib/auteur.ts`), captures des compteurs reprises sur la journée du 18/09. Fait le 20 septembre (PR 2).
- US-059 Fiche et synthèse servies à des adresses stables (`/fiche.pdf`, `/synthese.pdf`, copie au build par `scripts/copier-documents.ts`), section « Documents » sur Méthode, synthèse d'une page A4 générée par `npm run synthese`. Fait le 20 septembre (PR 3 et 4).

## Lot 6 · Après l'entretien : lecture par des directions non métier (session 4, mardi 22 septembre)
Contexte : l'entretien avec le cabinet a eu lieu le 22 septembre au matin, le lien est envoyé ; les prochains interlocuteurs (ressources humaines, direction régionale, direction commerciale, direction financière) ne sont pas tous du métier du pilotage. Demande de Frédéric : application améliorée et vérifiée (transitions, fonctionnalités, affichage), et une fiche qui explique chaque page en détail (ce qu'on y trouve, d'où ça vient, ce que ça vise).
- US-070 Guide de chaque écran, une seule source (`src/lib/guideEcrans.ts`) : question, décision, contenu, sources, intention, et lecture par chacun des quatre profils ; test Vitest de couverture et de forme. Fait le 22 septembre.
- US-071 Panneau « Comprendre cet écran » dans la barre haute (`src/composants/GuideEcran.tsx`, 480 px, navigation entre les écrans dans le panneau), entrée dans la palette. Fait le 22 septembre.
- US-072 Transitions de route (DESIGN.md §11) par l'API View Transitions (sortant 120 ms, entrant 220 ms, rail et barre haute nommés et immobiles), entrée d'écran en fondu décalé de 40 ms par carte (§4), retour en haut de page au changement d'écran (un changement de filtre conserve la position) ; `framer-motion`, jamais utilisé, retiré des dépendances. Fait le 22 septembre.
- US-073 Mode présentation (reprend US-060 sans l'enchaînement automatique : en réunion, c'est le présentateur qui avance) : touche P ou bouton de la barre haute, plein écran quand le navigateur l'accorde, rail, barre haute et pied masqués, flèches pour changer d'écran, repère en bas à droite, Échap pour sortir. Fait le 22 septembre.
- US-074 Filtres globaux sur téléphone (période, comparaison, agence) dans le tiroir de navigation, options partagées avec la barre haute (`src/app/optionsFiltres.ts`). Fait le 22 septembre.
- US-075 Présentation par écran en PDF (`npm run captures:presentation` puis `npm run presentation`, `scripts/generer-presentation.ts`) : couverture par profil, avant de lire, sommaire et parcours conseillé par direction, une page par écran avec capture, glossaire des indicateurs depuis le catalogue, servie à `/presentation.pdf` et liée depuis Méthode. Fait le 22 septembre.
- US-076 Page Méthode sans la date de l'entretien ; barre haute resserrée (libellés « Rechercher » et « Comprendre cet écran » en icône sous 1 536 px, sélecteurs sans retour à la ligne) ; doublon de tokens du thème clair retiré. Fait le 22 septembre.
Critères : `npm run check` vert, parcours Playwright du lot 6 (`e2e/lot6.spec.ts`) verts en 1280 et 375 px, PDF de 17 pages sans page quasi vide, déploiement et relecture en production.

## Palier C (après l'entretien)
- US-060 Mode présentation (touche P, plein écran, enchaînement des écrans toutes les 20 s). Fait au lot 6 (US-073) sans l'enchaînement automatique.
- US-061 Journal des visites anonymisé (`visite`), affiché sur Méthode pour Frédéric seulement (paramètre d'URL non devinable).
- US-062 GitHub Actions de déploiement, clé verrouillée.
- US-063 Revue hebdomadaire en PDF (skill createur-pdf-premium).

## Dette du gatekeeper DevSecOps (24 septembre 2026, JOURNAL session 6)
- US-077 Écran Analyste : `catch` dans `poser()` (réponse hors contrat rendue « Pas de réponse ») et délai de deux minutes sur `functions.invoke` ; délai de 20 s par page sur `lireSupabase`. Fait.
- US-078 CORS des Edge Functions restreint à l'origine du site et au poste de développement (`SITE_ORIGINE`, `IA_ORIGINES`). Fait le 24 septembre au soir : les deux fonctions déployées par le MCP Supabase (`expliquer-ecart` v11, `analyste` v13), en-têtes vérifiés par OPTIONS depuis le site, le poste local et une origine inconnue.
- US-079 `mart_alertes` et `mart_ecarts` matérialisées (migration 0037, `rafraichir_marts()` en rafraîchit cinq). Fait, appliquée et vérifiée le 24 septembre au soir (verrou exclusif ajouté après un interblocage).
- US-080 Réessais sur les nœuds HTTP n8n (trois essais, 5 s) et Mistral (deux) ; exports `n8n/` alignés. Fait, les cinq workflows publiés.
- US-081 Suite de chaos dans `e2e/chaos.spec.ts`, tests de contrat `tests/ia.test.ts`, SQL adverse `tests/garde-fous-adverse.test.ts`, couverture avec seuils dans `npm run check`. Fait.
- US-082 Vitest 5 et `@vitest/coverage-v8` ; `overrides` npm sur les dépendances transitives de mapshaper (adm-zip, image-size, file-type, fflate) : `npm audit` à zéro, CLI mapshaper vérifiée. Fait.
- US-083 En-têtes de sécurité sur les réponses servies par nginx et HSTS (Plesk, DEPLOIEMENT_VPS.md §1) ; `.htaccess` porte HSTS. Directives à poser dans Plesk.
- US-084 PostGIS hors de `public` : story RenovScope (drop cascade sur ses colonnes géométriques), non traitée ici.
Critères : `npm run check` et `npm run e2e` verts (chaos compris), `npm audit` à zéro, en production : `curl -I` avec les cinq en-têtes sur `/` et `/assets/`, réponse OPTIONS des fonctions avec l'origine du site, `select buta.rafraichir_marts()` citant cinq vues.
