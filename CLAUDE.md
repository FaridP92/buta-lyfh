# Buta.Lyfh · règles du projet (lu en premier par Claude Code)

Buta.Lyfh est un démonstrateur personnel de Frédéric Poissonnier, construit à l'appui d'une candidature au poste de Responsable Performance chez Butagaz Eco-énergie (entretien téléphonique le mardi 22 septembre 2026, 10 h 00). Il n'est affilié ni à Butagaz ni à Butagaz Eco-énergie. Il montre, sur un réseau d'installateurs simulé calé sur le marché réel, ce qu'un Responsable Performance met en place : pilotage du lead à l'encaissement, analyse des écarts, forecast, plans d'action, contrôles de cohérence, automatisation, et une lecture du marché à partir de données ouvertes.

## Ordre de lecture obligatoire avant toute action
1. `docs/BRIEF.md` : vision, cible, effet recherché, paliers, critères de succès.
2. `docs/ECRANS.md` : chaque écran, composant par composant.
3. `docs/INDICATEURS.md` : catalogue des indicateurs, formules, grains.
4. `docs/DONNEES.md` : sources réelles vérifiées, modèle de simulation, schéma SQL, RLS.
5. `docs/DESIGN.md` : système de design, mouvement, graphiques, interdits.
6. `docs/ARCHITECTURE.md` : stack, arborescence, environnements, secrets.
7. `docs/DEPLOIEMENT_VPS.md` : Plesk, DNS, nginx, rsync, contrôles de mise en ligne.
8. `docs/AUTOMATISATIONS.md` : workflows n8n, Edge Functions, journaux.
9. `docs/IA.md` : analyste, garde-fous, prompts, jeu d'évaluation.
10. `docs/BACKLOG.md` : lots et critères d'acceptation. `docs/VERIFICATION.md` : portes de qualité.
`docs/JOURNAL.md` : à tenir à jour à chaque session (décisions, écarts, à vérifier).

## Règles non négociables
- Langue : tout en français (interface, code commenté, documentation, commits). Noms de variables et de tables en français sans accents (`fait_dossier`, `taux_signature`).
- Typographie : jamais de tiret long (cadratin, demi-cadratin, barre) nulle part : code, UI, docs, messages de commit. Le tiret simple `-`, la virgule, les parenthèses et le deux-points remplacent. Un script `npm run verif:tirets` échoue si un tiret long apparaît dans `src/`, `docs/`, `supabase/`, `n8n/`.
- Vérité des chiffres : aucun nombre affiché n'est calculé dans un composant React. Les calculs vivent en SQL (vues `mart_`) ou dans `src/lib/` avec tests Vitest. Le modèle de langage ne produit jamais un chiffre : il commente des faits calculés en SQL qui lui sont transmis (principe repris de Courant et RenovScope).
- Données : les données de marché sont réelles et sourcées (Insee, ADEME, RTE), chaque écran affiche source, licence et date de référence. Les données d'activité (leads, ventes, poses, encaissements) sont simulées, et chaque écran qui en affiche porte la mention « données d'activité simulées ». Ne jamais laisser croire qu'il s'agit de données Butagaz.
- Personnes et entités : aucune agence, personne ou entité réelle n'est associée à une performance simulée. Les agences simulées portent des noms de bassins (Saintonge, Angoumois, Marensin, Born, Marsan, Bordeaux Métropole, Haute Gironde, Bassin d'Arcachon, Nord), sont positionnées au centre de leur bassin, et les effectifs sont des codes. Les implantations réelles sont citées une seule fois, sur la page Méthode, comme contexte public ; aucun rachat réel n'est cité (décision du 19 septembre 2026 : l'agence simulée « Nord », intégrée en juin avec des données à réconcilier, ne doit pouvoir être rapprochée d'aucune entité réelle).
- Marque : aucun logo, aucune couleur de marque, aucun visuel Butagaz. Le nom de l'application vit dans une seule constante (`src/app/marque.ts`) et le sous-domaine dans `.env`, pour qu'un renommage prenne dix minutes. Le nom affiché est « Buta.Lyfh ». Le pied de page et la page Méthode portent la mention : « Démonstrateur personnel de Frédéric Poissonnier, à l'appui d'une candidature. Sans lien avec Butagaz. Données de marché publiques, données d'activité simulées. »
- Niveau de design : celui d'un produit de studio, pas d'un gabarit. `docs/DESIGN.md` §9 liste ce qui trahit une interface générée et ce qu'on fait à la place ; §10 définit le logo ; §11 les animations signature. Chaque écran est relu contre ces trois sections, capture à l'appui, avant d'être déclaré fini.
- Ton : sobre, précis, aucun superlatif dans l'interface (« le meilleur », « révolutionnaire » sont interdits). Les titres disent ce que l'écran permet de décider.
- Sécurité : la clé Anthropic et la clé service ne quittent jamais le serveur (Edge Functions, n8n). Le front n'embarque que l'URL de l'API et la clé anon, bornée par la RLS. Le rôle SQL de l'analyste est en lecture seule, limité aux vues autorisées, avec `statement_timeout`.
- Périmètre : rien n'est ajouté au périmètre d'un lot sans l'écrire dans `docs/BACKLOG.md`. Un lot est fini quand ses critères d'acceptation sont vérifiés et notés dans `docs/JOURNAL.md`, pas avant.
- Pas de faux fini : aucun `TODO` laissé dans le code livré, aucun test `skip`, aucune branche non implémentée. Si quelque chose bloque, l'écrire dans le journal et le dire.

## Commandes
- `npm run dev` : serveur Vite local.
- `npm run check` : `typecheck` (tsc strict), `lint` (oxlint), `test` (Vitest), `verif:tirets`, `verif:sources` (chaque vue `mart_` a une fiche dans INDICATEURS.md).
- `npm run build` : bundle de production dans `dist/` (budget : moins de 900 Ko de JavaScript compressé hors GeoJSON chargés à la demande).
- `npm run e2e` : Playwright, parcours de chaque route en 1280 px et 375 px, zéro erreur console.
- `npm run instantane` : écrit `public/data/instantane/*.json` (secours statique des vues `mart_`) depuis la base.
- `npm run deploiement` : build, contrôle, rsync vers le VPS, test HTTP de la page d'accueil et d'une route profonde (voir DEPLOIEMENT_VPS.md).
- `npm run generer:activite` : régénère le jeu simulé (graine fixe) et le charge dans la base (tunnel SSH vers le VPS, voir `deploy/backend/README.md`). `npm run ingerer:marche` : charge le marché réel (Insee, RGE, RTE, DPE).

## Outils et skills à mobiliser
- Base et fonctions : backend auto-hébergé sur le VPS (`deploy/backend/README.md`) pour le schéma, les migrations (`docker compose exec -T db psql -U postgres -d buta < supabase/migrations/NNNN_xxx.sql`) et les Edge Functions ; vérification des droits et de la RLS après chaque migration.
- MCP n8n (instance n8n.lyfh.fr) pour créer, valider et publier les workflows ; export JSON de chaque workflow dans `n8n/`.
- Skills locaux, par lot : `frontend-design` et `ui-ux-pro-max` (écrans), `data-viz-dashboard-expert` (choix des graphiques), `supabase-rls-guard` (chaque migration), `n8n-workflow-architect` (workflows), `devops-cloud-deploy` (déploiement), `powerbi-dax-expert` (export Power BI), `expert-qa-e2e` (Playwright), `static-analysis-enforcer` (typage), `git-commit-guardian` (fin de lot), `visual-verdict` (captures d'écran contre DESIGN.md).
- Mode ultracode pour les relectures : workflows de réfutation à trois lentilles (faits contre DONNEES.md, forme et typographie, recruteur Butagaz simulé), sans juge de synthèse. La rédaction se fait à la main, la réfutation par workflow.

## Git
Dépôt privé `buta-lyfh` (GitHub, compte FaridP92). Un commit par lot au minimum, message en français, impératif, sans tiret long. Les secrets ne sont jamais versionnés (`.env` ignoré, `.env.example` documenté).
