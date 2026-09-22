# Buta.Lyfh

Démonstrateur personnel de Frédéric Poissonnier, à l'appui d'une candidature au poste de Responsable Performance chez Butagaz Eco-énergie. Sans lien avec Butagaz. Données de marché publiques (Insee, ADEME, RTE), données d'activité simulées.

Cockpit de pilotage d'un réseau d'installateurs (photovoltaïque, pompes à chaleur) : du lead à l'encaissement, écarts, forecast, plans d'action, contrôles de cohérence, automatisation n8n, analyste IA, et lecture du marché réel des territoires.

- Application : https://buta.lyfh.fr
- Démarrage : `CLAUDE.md`, puis `docs/` dans l'ordre indiqué, puis `PROMPT_DEMARRAGE.md`.
- Stack : React 19, Vite 7, TypeScript strict, Tailwind v4, Radix, ECharts, Supabase (Postgres, Edge Functions), n8n, VPS OVH Plesk.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur Vite local |
| `npm run check` | typage strict, oxlint, Vitest, `verif:tirets`, `verif:sources` |
| `npm run build` | bundle de production dans `dist/` |
| `npm run e2e` | Playwright, chaque route en 1280 px et 375 px, zéro erreur console (`E2E_BASE` pour cibler la production) |
| `npm run instantane` | JSON de secours des vues `mart_` dans `public/data/instantane/` |
| `npm run ingerer:marche` | charge le marché réel (Insee, RGE, RTE, DPE) |
| `npm run generer:activite` | régénère le jeu simulé (graine fixe) et le charge |
| `npm run captures:presentation` | captures de chaque écran pour la présentation par écran (`CAPTURE_BASE` pour cibler un serveur) |
| `npm run presentation` | présentation par écran (`docs/PRESENTATION.html` et `.pdf`, servie à `/presentation.pdf`) |
| `npm run deploiement` | check, build, rsync vers le VPS, test HTTP |

Configuration locale : copier `.env.example` en `.env`. Aucun secret n'est versionné.

## Arborescence

Voir `docs/ARCHITECTURE.md` §2. En résumé : `src/app` (mise en page, routeur, filtres URL), `src/ecrans` (un dossier par écran), `src/composants`, `src/graphiques`, `src/donnees`, `src/lib` (calculs testés), `scripts/`, `supabase/`, `n8n/`, `e2e/`, `tests/`.

## Journal

Chaque session est consignée dans `docs/JOURNAL.md` : décisions, écarts, preuves de vérification.
