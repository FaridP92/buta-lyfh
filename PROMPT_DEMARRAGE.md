# Prompts à coller dans Claude Code

## Avant de lancer (à faire par Frédéric, 15 minutes)
1. Déplacer ce dossier : `mv ~/Desktop/CV/projets/buta-lyfh ~/Desktop/Buta-Lyfh`, puis ouvrir Claude Code dans `~/Desktop/Buta-Lyfh` avec les MCP Supabase et n8n actifs, en mode ultracode.
2. Créer le dépôt GitHub privé `buta-lyfh` (vide).
3. Dans Plesk : ajouter le sous-domaine `buta.lyfh.fr` (racine `/var/www/vhosts/lyfh.fr/buta.lyfh.fr`), activer le certificat Let's Encrypt, ajouter l'enregistrement DNS A `buta` vers `51.77.150.125` si la zone n'est pas gérée par Plesk. Vérifier avec `curl -I https://buta.lyfh.fr` (une page Plesk par défaut suffit).
4. Vérifier que ta clé SSH personnelle ouvre un shell sur le VPS (`ssh root@51.77.150.125 'echo ok'`). La clé de déploiement de LYFH ne convient pas : elle est verrouillée sur le script de LYFH.
5. Clé Anthropic : créer une clé API avec un plafond de dépense (10 euros suffisent pour le week-end). Elle sera posée en secret Supabase et en credential n8n, jamais dans le dépôt. Sans clé le samedi soir, l'analyste bascule sur Mistral (credential n8n existant).
6. Décider et écrire dans `docs/JOURNAL.md` : projet Supabase cible (schéma `buta` dans le projet `renovscope`, choix par défaut, ou projet dédié si le plan le permet).
7. Décider et écrire dans `docs/JOURNAL.md` le nom : Buta.Lyfh (ton choix) ou Reseau.Lyfh (variante neutre proposée par la relecture). Le sous-domaine Plesk suit ce choix.

## Session 1 : prompt de démarrage (copier tel quel)

Tu démarres le projet Buta.Lyfh. Lis `CLAUDE.md` puis les documents de `docs/` dans l'ordre indiqué, intégralement, avant d'écrire une ligne de code. Ne me pose aucune question dont la réponse est dans ces documents. Les seules décisions ouvertes sont listées dans `docs/JOURNAL.md`.

Objectif de cette session : livrer le lot 0 et le lot 1 de `docs/BACKLOG.md`, vérifiés selon `docs/VERIFICATION.md`.
- Lot 0 : squelette de l'application (stack de `docs/ARCHITECTURE.md`), système de design de `docs/DESIGN.md` implémenté en tokens et composants de base, identité complète (logo, monogramme, favicons, animation d'ouverture, motif du point ambre, `docs/DESIGN.md` §10), navigation complète avec les onze routes en état « à venir » élégant, page Méthode complète, déploiement réel sur https://buta.lyfh.fr selon `docs/DEPLOIEMENT_VPS.md`. La session n'est pas finie tant que l'URL ne répond pas en HTTPS avec la coquille, le logo et le pied de page réglementaire.
- Lot 1 : schéma SQL `buta` (migrations Supabase, RLS vérifiée avec le skill supabase-rls-guard et les advisors), ingestion du marché réel (`npm run ingerer:marche`), générateur d'activité simulée (`npm run generer:activite`, graine fixe, les sept histoires de `docs/DONNEES.md` §3.4 injectées et vérifiables par requête), vues `mart_` avec tests SQL de cohérence, instantané statique de secours.

Méthode de travail :
- Travaille par lot, dans l'ordre. Pour chaque lot : plan court (dix lignes maximum) dans `docs/JOURNAL.md`, exécution, `npm run check`, captures d'écran des écrans touchés en 1280 px et 375 px comparées à `docs/DESIGN.md` (skill visual-verdict), puis critères d'acceptation cochés dans le journal avec la preuve (commande et résultat).
- Mobilise les skills listés dans `CLAUDE.md` au moment indiqué, et les MCP Supabase et n8n plutôt que des scripts manuels quand un outil existe.
- Exigence de design : le résultat doit ressembler à un produit conçu par un studio, pas à un gabarit généré. Avant de déclarer un écran fini, passe-le contre le tableau de `docs/DESIGN.md` §9 (ce qui trahit une interface générée), vérifie son animation signature (§11) et compare la capture aux tokens (§1 à §5). Si un écran ressemble à un tableau de bord générique, il n'est pas fini.
- Aucun chiffre calculé dans un composant. Aucun tiret long. Aucune mention qui laisserait croire à des données Butagaz. Commit en fin de chaque lot (skill git-commit-guardian).
- Si tu dois choisir entre finir proprement le lot en cours et entamer le suivant, finis le lot en cours. Si un point de `docs/` te paraît faux ou incohérent, écris-le dans le journal avec ta proposition, applique la solution la plus simple, et continue.

Commence par le lot 0. Rends compte en fin de session : ce qui est en ligne, ce qui est vérifié, ce qui reste, en français, sans tiret long.

## Session 2 : prompt de reprise (lots 2 et 3)

Reprends Buta.Lyfh. Relis `CLAUDE.md`, `docs/JOURNAL.md` (état exact), `docs/ECRANS.md`, `docs/INDICATEURS.md` et `docs/DESIGN.md`. Vérifie `git status` et que https://buta.lyfh.fr répond avant de commencer.

Objectif : lots 2 et 3 de `docs/BACKLOG.md`, c'est-à-dire les écrans du palier A (Vue d'ensemble, Territoires, Funnel et leads, Ventes et marge, Forecast et atterrissage, Qualité et référentiels) branchés sur les vues `mart_`, filtres globaux persistés dans l'URL, palette de commandes, export CSV et XLSX, responsive 375 px, et la mise en ligne à chaque lot. Chaque écran est comparé à sa fiche de `docs/ECRANS.md` composant par composant, et à `docs/DESIGN.md` par capture d'écran, avant d'être déclaré fini. Les sept histoires simulées doivent être visibles à l'écran là où la fiche l'indique.

Même méthode que la session 1. Termine par le déploiement, `npm run e2e`, et le compte rendu.

## Session 3 : prompt de reprise (lots 4 et 5)

Reprends Buta.Lyfh. Relis `CLAUDE.md`, `docs/JOURNAL.md`, `docs/AUTOMATISATIONS.md`, `docs/IA.md`, `docs/VERIFICATION.md`.

Objectif : lot 4a d'abord (WF1, WF2, WF5 créés, validés et publiés via le MCP, exportés dans `n8n/` ; badge de fraîcheur et alertes alimentés ; journées publiées d'avance jusqu'au 25 septembre ; relecture et corrections du palier A ; déploiement propre). Ensuite seulement, si le palier A est irréprochable et qu'il reste du temps lundi : lot 4b (Edge Functions `analyste` et `expliquer-ecart` avec secrets, WF3 et WF4, écrans Automatisations, Analyste, Pose et encaissement, Plans d'action et rituels) puis lot 5 (Playwright, Lighthouse, accessibilité, relecture par workflow de réfutation à trois lentilles en mode ultracode, corrections, journal final, commit, déploiement, gel à 20 h). À la fin, l'application est celle qui sera montrée mardi : rien d'« à venir » ne doit rester visible, tout écran non fini est retiré de la navigation.
