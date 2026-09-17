# Reprise rapide · Buta.Lyfh

À lire en premier en reprenant une session (avec `CLAUDE.md`). Ce fichier remplace la relecture intégrale de `docs/` : il donne l'état exact, les décisions prises et la feuille de route. Le détail des preuves est dans `docs/JOURNAL.md`.

## État au 18 septembre 2026, 01:45

- **En ligne** : https://buta.lyfh.fr (lot 0 + lot 1, déployé). Coquille complète, onze routes (Méthode finie, dix « à venir »), badge de fraîcheur en direct (« Journée du 16/09 »), Lighthouse 99 / 100 / 100 / 100, e2e 26/26.
- **Données** : projet Supabase `renovscope` (`iuremijuoxkzvfqyrmcc`), schéma `buta` exposé à l'API. Migrations 0001 à 0010 appliquées. 43 306 dossiers simulés (36 178 publiés au 16/09), marché réel 96 départements et 4 691 communes. Seize vues `mart_` rapides (toutes sous 0,7 s pour anon). Tests SQL `npm run test:sql` : 16/16 (sept histoires retrouvées).
- **Lot 2 en cours** : socle des écrans commité (`fac6266`), aucun écran de pilotage encore branché.
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
- Composants prêts : `Carte`, `CarteKPI` (compteur, mini courbe), `CarteGraphique` (menu plein écran, PNG, CSV, requête), `Tableau` (tri, export), `Pastille` + `statutEcart`, `Badge`, `LigneSources`, `Squelette`, `Graphique` (ECharts à la demande, `optionBase(tokens)` dans `src/graphiques/theme.ts`).
- Fail2Ban a banni l'IP de développement une fois ; elle est en liste de confiance Plesk. Déploiement : `npm run deploiement`.
- Le fork qui a écrit `scripts/ingerer-marche.ts` a laissé un cache `.cache/marche/` (gitignoré) ; `--charger` recharge sans retélécharger.

## Feuille de route (ordre de valeur, BACKLOG lots 2 et 3)

1. **Vue d'ensemble** (`src/ecrans/vue-ensemble/`) : 4 KPI (VENTES, CA_SIGNE, TX_MARGE, TX_CONV cohorte M-3) depuis `mart_kpi_mensuel` + `mart_funnel` (canal TOUS) agrégés par `agregerKpi` ; atterrissage (`mart_forecast`, jauge 900 ms) ; funnel du mois (barres horizontales) ; alertes (`mart_alertes`) ; tableau agences ; carte miniature (`/geo/perimetre.geojson` + `dim_agence`) ; « Ce que dit le mois » par règles (`src/lib/phrases.ts` à écrire et tester, depuis `mart_ecarts` + KPI + alertes). Animation : compteurs décalés de 80 ms, jauge de gauche à droite.
2. **Ventes et marge** : KPI (CA signé, CA posé, TX_MARGE, PANIER, REMISE, TX_ANNUL) ; cascade `mart_ecarts` (barres empilées transparentes, tombent à 120 ms d'écart, résiduel en dernier) ; barres empilées CA par produit + courbe marge (`mart_ventes_produit`) ; matrice agence × produit ; tableau agences (`mart_kpi_mensuel` : CA, écart objectif, écart N-1, marge, marge après acquisition, résultat, remise, annulations) ; remises (boîtes à moustaches par agence) + `src/lib/remise.ts` (régression, seuil « 8 % ± 3 points ») testé. H3, H5 (`taux_annulation_a_distance` vs `sur_place`), H6.
3. **Forecast** : éventail (`mart_forecast` + mensuel réalisé de `mart_kpi_mensuel`), panneau hypothèses avec curseur taux de signature du pipe (`src/lib/forecast.ts` testé, recalcul local du central et des bornes), tableau agences (réalisé, objectif, central, écart, probabilité, pastille), risques et opportunités par règles (poses en retard `mart_pose`, pipe vs N-1). H7, H1, H3.
4. **Funnel** : KPI (LEADS, TX_RDV, TX_DEVIS, TX_SIGN, CPL, CPV) ; Sankey (coule 800 ms) depuis `mart_funnel` ; matrice canal × agence ; courbe 20 mois leads et ventes par canal ; tableau qualité des leads (`mart_couts_acquisition`, pastille `a_revoir`) ; leads sans RDV 48 h (`sans_rdv_48h`, courbe 8 semaines à approximer par mois). H2, H1, H6.
5. **Territoires** (lot 3) : carte départements (`/geo/departements-100m.geojson`, `mart_marche_departement`, indice ambre, périmètre détouré, contour qui se trace) ; composantes et curseurs (`src/lib/indice.ts` testé) ; tableau ; communes (`/geo/communes-{dep}.geojson`, `mart_marche_commune`, agences, RGE `rge_installateur`) ; bloc gaz citerne.
6. **Qualité** (lot 3) : score et douze contrôles (`mart_qualite`, une seule journée pour l'instant : la courbe 90 jours attend WF2 ou un rejeu daté), fraîcheur (`source_fraicheur`), référentiels (`dim_*`, libellés Nord), lignage SVG. H4.
7. **Méthode enrichie** + export Power BI (zip CSV des vues + `modele_etoile.md`, `versZip` prêt dans `src/lib/export.ts`).
8. Par écran : `disponible: true` dans `src/app/routes.ts`, revue DESIGN.md §9 et §11, captures 1280 et 375 (`docs/captures/lotN/`), e2e, `npm run deploiement`, journal, commit, push.

## Commandes utiles

`npm run dev` · `npm run check` · `npm run build` · `npm run e2e` (ou `E2E_BASE=https://buta.lyfh.fr npm run e2e`) · `SUPABASE_DB_SSL_NON_VERIFIE=1 npm run test:sql` · `npm run instantane` · `npm run deploiement`.
