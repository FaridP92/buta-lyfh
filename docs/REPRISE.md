# Reprise rapide · Buta.Lyfh

À lire en premier en reprenant une session (avec `CLAUDE.md`). Ce fichier remplace la relecture intégrale de `docs/` : il donne l'état exact, les décisions prises et la feuille de route. Le détail des preuves est dans `docs/JOURNAL.md`.

## État au 18 septembre 2026, 03:10

- **En ligne** : https://buta.lyfh.fr (lots 0, 1 et 2 déployés). Onze routes (Méthode, Vue d'ensemble, Ventes et marge, Forecast, Funnel finies, six « à venir »), badge de fraîcheur en direct (« Journée du 17/09 »), e2e 26/26 contre la production.
- **Données** : projet Supabase `renovscope` (`iuremijuoxkzvfqyrmcc`), schéma `buta` exposé à l'API. Migrations 0001 à 0015 appliquées (0011 : prorata ; 0012 : remises ; 0013 : hypothèses du forecast ; 0014 : objectif mensuel ; 0015 : médianes lead vers RDV). 72 261 dossiers simulés (59 838 publiés au 17/09) après recalibrage à 80 leads par commercial, marché réel 96 départements et 4 691 communes. Dix-huit vues `mart_` rapides. Tests SQL `npm run test:sql` : 16/16 (sept histoires retrouvées).
- **Lot 2 terminé** : quatre écrans de pilotage et palette enrichie livrés, vérifiés, en ligne (captures `docs/captures/lot2/`, Lighthouse 99 / 100 / 100 / 100 sur `/ventes`). Lot 3 à commencer : Territoires, Qualité, Méthode enrichie et export Power BI.
- **Dépôt** : GitHub `FaridP92/buta-lyfh`, remote HTTPS, `main` à jour. Commits et push à chaque étape vérifiée.

## Ce qu'il faut savoir (décisions non évidentes)

- Accents français partout (textes, commentaires, commits) ; identifiants sans accents. Aucun tiret long (`npm run verif:tirets`).
- Aucun chiffre calculé dans un composant : SQL (`mart_`) ou `src/lib/` testé (`periode.ts` agrège les mois, `format.ts` formate).
- `.env` local : `SUPABASE_DB_URL` = pooler transaction (port 6543), `SUPABASE_DB_SSL_NON_VERIFIE=1` nécessaire aux scripts (`SUPABASE_DB_SSL_NON_VERIFIE=1 npm run test:sql`).
- Les migrations 0008 à 0010 ont été appliquées par `pg` direct (fichier `.sql` puis ligne dans `supabase_migrations.schema_migrations`) ; 0001 à 0007 par le MCP `apply_migration`.
- Générateur : tirage systématique par cohorte et par canal (variance réduite), Bordeaux Métropole à 25 % de leads achetés, coûts sur le prix du dossier. Regénérer : `SUPABASE_DB_SSL_NON_VERIFIE=1 npm run generer:activite` puis `select buta.rafraichir_marts()` et `select buta.executer_controles(buta.journee_publiee())`.
- Vues : `buta.dossier_a_date` masque tout événement postérieur à `buta.journee_publiee()` ; les vues utilisent `with j as materialized` (sinon la fonction est évaluée par ligne).
- Alertes (`mart_alertes`) : CPV sur cohortes mûres avec plancher de 8 ventes ; carnet relatif (×1,3 médiane 12 semaines) ; poses en retard à 60 j sur place, 90 j à distance.
- Front : `useVue(nom, filtres)` (Zod, instantané puis Supabase), `useFiltres()` (période mois/trimestre/année, comparaison, agence ; `agenceVue` = `RESEAU` ou code), `useDeclarerExport` pour le bouton Exporter global, `BoutonFiche` + catalogue `src/lib/indicateurs.ts`.
- Composants prêts : `Carte`, `CarteKPI` (compteur, mini courbe), `CarteGraphique` (menu plein écran, PNG, CSV, requête, `hauteurMobile` pour dépasser les 260 px mobiles), `Tableau` (tri, export, colonnes `secondaire` masquées sur mobile), `Pastille` + `statutEcart`, `Badge`, `LigneSources`, `Squelette`, `Graphique` (ECharts à la demande, `optionBase(tokens)` dans `src/graphiques/theme.ts`).
- Fail2Ban a banni l'IP de développement une fois ; elle est en liste de confiance Plesk. Déploiement : `npm run deploiement`.
- Le fork qui a écrit `scripts/ingerer-marche.ts` a laissé un cache `.cache/marche/` (gitignoré) ; `--charger` recharge sans retélécharger.

## Feuille de route (ordre de valeur, BACKLOG lots 2 et 3)

1. **Vue d'ensemble** : livrée (`src/ecrans/vue-ensemble/`, modèle pour les écrans suivants : `useFiltres`, `useVue` avec bornes `${debut}-01`, `agregerKpi`, `useDeclarerExport`, `clePeriode` pour rejouer les animations, `LigneSources` en pied).
2. **Ventes et marge** : livrée (`src/ecrans/ventes/`, constructeurs ECharts dans `options.ts` avec indicateur `mobile` ; `src/lib/ventes.ts`, `src/lib/remise.ts`, `expliquerEcart` dans `phrases.ts`).
3. **Forecast** : livrée (`src/ecrans/forecast/`, `src/lib/forecast.ts` : `recalculerAtterrissage`, `trajectoire`, `risquesEtOpportunites`).
4. **Funnel** : livrée (`src/ecrans/funnel/`, `src/lib/funnel.ts` ; Sankey avec `hauteurMobile`).
5. **Territoires** (lot 3) : carte départements (`/geo/departements-100m.geojson`, `mart_marche_departement`, indice ambre, périmètre détouré, contour qui se trace) ; composantes et curseurs (`src/lib/indice.ts` testé) ; tableau ; communes (`/geo/communes-{dep}.geojson`, `mart_marche_commune`, agences, RGE `rge_installateur`) ; bloc gaz citerne.
6. **Qualité** (lot 3) : score et douze contrôles (`mart_qualite`, une seule journée pour l'instant : la courbe 90 jours attend WF2 ou un rejeu daté), fraîcheur (`source_fraicheur`), référentiels (`dim_*`, libellés Nord), lignage SVG. H4.
7. **Méthode enrichie** + export Power BI (zip CSV des vues + `modele_etoile.md`, `versZip` prêt dans `src/lib/export.ts`).
8. Par écran : `disponible: true` dans `src/app/routes.ts`, revue DESIGN.md §9 et §11, captures 1280 et 375 (`docs/captures/lotN/`), e2e, `npm run deploiement`, journal, commit, push.

## Commandes utiles

`npm run dev` · `npm run check` · `npm run build` · `npm run e2e` (reconstruit puis teste ; `E2E_BASE=https://buta.lyfh.fr npx playwright test` contre la production) · Lighthouse : `CHROME_PATH="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" npx lighthouse <url> --preset=desktop --chrome-flags="--headless=new"` (Chrome for Testing de Playwright ne peint pas) · `SUPABASE_DB_SSL_NON_VERIFIE=1 npm run test:sql` · `npm run instantane` · `npm run deploiement`.
