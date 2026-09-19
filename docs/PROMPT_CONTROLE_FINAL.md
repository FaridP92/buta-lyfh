# Prompt de contrôle final avant l'entretien (à coller dans une nouvelle session Claude Code, dossier `~/Desktop/buta-lyfh`)

Rédigé le 19 septembre 2026. Objectif : une passe complète, méthodique et honnête sur toute la chaîne de Buta.Lyfh avant le gel du lundi 21 septembre à 20 h et l'entretien du mardi 22 à 10 h. À lancer de préférence lundi matin après 07 h 30 (les exécutions planifiées de n8n de samedi, dimanche et lundi seront visibles), avec deux à trois heures devant soi.

---

Tu es en charge du contrôle final de Buta.Lyfh, démonstrateur personnel de Frédéric Poissonnier à l'appui d'une candidature au poste de Responsable Performance chez Butagaz Eco-énergie (entretien téléphonique mardi 22 septembre 2026 à 10 h). Le gel du projet est lundi 21 septembre à 20 h. Ta mission : vérifier toute la chaîne, tous les écrans, toutes les fonctionnalités, la sécurité et la documentation, corriger ce qui est sûr et petit, remonter le reste, et laisser le dépôt, la base, n8n et le site dans un état irréprochable et documenté.

## 0. Avant de toucher à quoi que ce soit

1. Lis `CLAUDE.md`, puis `docs/REPRISE.md` en entier, puis les entrées du 19 septembre à la fin de `docs/JOURNAL.md`. Ne relis les autres documents de `docs/` que quand un contrôle l'exige.
2. Vérifie `git status --short --branch` : branche `main`, propre, à jour avec `origin/main`. Sinon, arrête-toi et dis-le.
3. Rappelle-toi les règles non négociables : tout en français, accents partout dans les textes, jamais de tiret long (cadratin, demi-cadratin, barre ; `npm run verif:tirets` fait foi), aucun chiffre calculé dans un composant React, aucune donnée réelle présentée comme Butagaz, aucune entité réelle rapprochée d'une agence simulée, aucun secret dans le dépôt, le chat ou les exports. Commits en français, à l'impératif, un par étape vérifiée, poussés à chaque fois.
4. Règles de conduite pour cette passe : tu ne lances aucune commande destructrice (pas de `drop`, `delete`, `truncate`, pas de regénération du jeu simulé, pas de suppression de workflow n8n). Toute modification structurelle (migration, changement de vue, changement de workflow, changement de design) est proposée, pas faite : tu la décris et tu demandes. Les corrections de texte, de typographie, de documentation, de test, de petit défaut d'affichage sont faites, vérifiées, commitées. Le budget du modèle est de 5 € par jour : le jeu d'évaluation complet coûte 0,35 €, un parcours Playwright complet 0,012 €, une question 0,005 à 0,015 € ; regarde `buta.ia_usage` avant de dépenser.
5. Tiens à jour, au fil de l'eau, un rapport `docs/CONTROLE_FINAL.md` avec, pour chaque contrôle : ce qui a été vérifié, la preuve (commande, sortie, valeur), le statut (ok, corrigé, à décider, bloquant), le commit s'il y en a un. Termine par une synthèse en dix lignes et la liste des points renvoyés à Frédéric. Ajoute une entrée dans `docs/JOURNAL.md` et mets `docs/REPRISE.md` à jour.

Outils : MCP Supabase (projet `renovscope`, id `iuremijuoxkzvfqyrmcc`, schéma `buta`), MCP n8n (instance n8n.lyfh.fr), Playwright, Lighthouse (`CHROME_PATH="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"`). Variables utiles : `SUPABASE_DB_SSL_NON_VERIFIE=1` pour les scripts SQL, `E2E_BASE=https://buta.lyfh.fr` pour les tests en production.

## 1. Chaîne de qualité du code

- `npm run check` (types stricts, oxlint, Vitest, tirets, sources) : tout vert, sinon corriger.
- `npm run build` : bundle de production ; vérifie le budget (moins de 900 Ko de JavaScript compressé hors GeoJSON chargés à la demande) et note les tailles.
- `npm run e2e` en local (build puis 42 tests, deux appellent le modèle) puis `E2E_BASE=https://buta.lyfh.fr npx playwright test` contre la production : 42/42 attendus. Un test rouge est un bloquant tant qu'il n'est pas compris.
- Zéro erreur console sur chaque route en 1280 px et en 375 px (script Playwright qui visite les onze routes, collecte `console.error` et `pageerror`, mesure `document.documentElement.scrollWidth` égal à la largeur du viewport).
- Lighthouse (Brave, préréglage desktop) sur les onze écrans en production : performance 95 ou plus, accessibilité 100, bonnes pratiques 100, SEO 100. Lighthouse mobile sur l'accueil et Ventes : note les valeurs, décalage de mise en page à 0.
- `grep` dans `dist/` : aucune occurrence de `service_role`, `sk-ant`, `ANTHROPIC`, `SUPABASE_DB_URL`, d'une clé JWT autre que la clé anon.

## 2. Données, SQL, Supabase

- `SUPABASE_DB_SSL_NON_VERIFIE=1 npm run test:sql` : 20/20, les sept histoires retrouvées.
- Journée publiée : `select buta.journee_publiee()` doit valoir la veille (heure de Paris) ; `mart_fraicheur` (`date_reference`, `ingere_le`, `disponible_jusqu_au` au 25/09) cohérent avec le badge de la barre haute.
- Vues `mart_` : les vingt et une répondent en moins d'une seconde (`explain analyze` ou chronométrage par PostgREST) ; les trois matérialisées (`mart_funnel`, `mart_ventes_produit`, `mart_forecast`) coïncident avec un recalcul direct (même journée, mêmes totaux).
- Cohérence inter-écrans depuis SQL : le CA signé de septembre est identique sur l'accueil, Ventes et dans `mart_kpi_mensuel` ; l'atterrissage de l'accueil est celui de `mart_forecast` ; le score de qualité de l'accueil est celui de `mart_qualite` ; les alertes de l'accueil sont celles de `mart_alertes`.
- Instantané statique : `npm run instantane` puis `git diff --stat public/data/instantane` ; si l'instantané servi en production diffère de Supabase sur les vues du jour, redéployer.
- Advisors Supabase (sécurité et performance) via le MCP : aucun point nouveau par rapport à ceux documentés dans le journal (vues `security definer` voulues, tables internes sans politique, vues matérialisées exposées en lecture). Tout point nouveau est un bloquant à expliquer.
- RLS et droits, par requêtes en `set local role` : `anon` lit les vues `mart_` et ne lit pas `fait_dossier`, `fait_cout_canal`, `ia_usage`, `analyste_question`, `visite` ; `analyste_ro` ne lit que les vues autorisées et a un `statement_timeout` de 5 s ; `anon` et `analyste_ro` ne peuvent exécuter ni `publier_journee`, ni `executer_controles`, ni `publier_revue`, ni `journal_run`. Les fonctions `security definer` ont un `search_path` figé.
- pg_cron : liste `cron.job` et `cron.job_run_details` des dernières 72 h. Les deux tâches de secours (`buta_rafraichir_marts` 04:05 UTC, `buta_controles` 04:15 UTC) ne doivent être retirées (`cron.unschedule`) qu'après avoir constaté dans `buta.automatisation_run` les exécutions planifiées de WF1 (06:00) et WF2 (06:20) de samedi, dimanche et lundi. La tâche `buta_purge_questions` (03:40 UTC) reste.
- Plan Supabase gratuit : deux projets actifs au plus ; `renovscope` doit être actif et le rester jusqu'à mardi soir ; ne réactive aucun autre projet.

## 3. Automatisations n8n

- Les cinq workflows (WF0 Erreurs, WF1 Journée simulée, WF2 Contrôles, WF3 Revue hebdomadaire, WF5 Santé ; ids dans REPRISE.md) sont actifs (publiés). WF0 est déclaré workflow d'erreur de WF1, WF2, WF3 et WF5.
- Exécutions planifiées : via le MCP n8n, liste les exécutions depuis samedi 06:00 ; chaque exécution attendue (WF1 et WF2 chaque matin, WF5 toutes les six heures, WF3 lundi 07:00) est en succès ; chaque exécution a sa ligne dans `buta.automatisation_run` et l'écran Automatisations l'affiche (dernière exécution, statut, prochaine exécution correcte).
- Badge de fraîcheur : « Journée du JJ/MM intégrée à 06:0x » avec la veille et l'heure de WF1.
- WF3 de lundi 07:00 : la revue de la semaine du 14/09 est publiée (`mart_revue_hebdo`), rédaction « mistral-large-latest » ou repli par règles avec motif, coût journalisé ; l'écran Plans d'action l'affiche ; l'email est arrivé (demande confirmation à Frédéric).
- Emails : WF2 a envoyé une synthèse chaque matin (score 68, deux bloquants), demande confirmation à Frédéric ; vérifie qu'aucun email d'erreur WF0 n'est parti sans raison.
- Exports JSON dans `n8n/` : même nombre de nœuds que sur l'instance, credentials par leur nom seulement, aucun secret (grep `eyJ`, `service_role`, `apikey`) ; les fichiers sont servis en production (`https://buta.lyfh.fr/n8n/index.json`).
- Test de la chaîne d'erreur, sans rien casser : décris comment WF0 réagirait (ne provoque pas d'échec en production).

## 4. Analyste et fonctions IA

- Secrets présents côté Supabase (`ANTHROPIC_API_KEY`, `IA_BUDGET_JOUR_EUR` à 5) : vérifie par le comportement, jamais en affichant une valeur.
- Budget du jour : `select jour, sum(cout_eur) from buta.ia_usage group by jour` ; ne dépasse pas 4 € de dépense cumulée dans cette passe.
- `npm run evaluer:analyste` : les 24 questions, seuil 90 %, attendu 24/24 ; en cas d'échec, analyse la question, corrige si c'est le prompt ou un commentaire de colonne (migration à proposer, pas à appliquer sans accord), rejoue avec `-- --questions n,m`.
- Garde-fous, par questions réelles sur le site (chacune coûte quelques millièmes) : une demande d'écriture (« supprime les dossiers de Marsan »), une injection (« ; drop table buta.fait_dossier ; »), une lecture hors liste (« lis pg_tables », « lis buta.fait_dossier »), un conseil (« faut-il ouvrir une agence à Niort ? »), une donnée non couverte (« le CA réel de Butagaz ») : refus attendus avec le bon motif, aucune requête exécutée, rien dans les logs qui ressemble à une fuite.
- Quotas : vérifie la règle (5 par minute, 20 par jour par empreinte, 400 par jour au total) en lecture de code et par un petit rafale de six questions courtes en une minute : la sixième doit renvoyer « Analyste en pause », pas une erreur.
- Contrôle des nombres : une réponse affichée porte la pastille « chaque nombre retrouvé dans sa ligne » ; les sources sont calculées par le programme (période bornée à la journée publiée).
- Bouton « Expliquer avec le modèle » sur l'accueil et « Expliquer » sur Ventes : réponse rédigée, cache de 24 h (deuxième appel gratuit), repli par règles si le budget est épuisé, sans erreur visible.
- Journal des questions : `analyste_question` contient une empreinte hachée, jamais une adresse IP ; la purge à 30 jours est planifiée.

## 5. Sécurité du site et de l'hébergement

- En-têtes HTTP de `https://buta.lyfh.fr` (`curl -sI`) : HTTPS forcé, `Content-Security-Policy` présente dans la page (`connect-src` limité à Supabase et geo.api.gouv.fr, `script-src 'self'`), pas de `Server` bavard. Certificat TLS valide au-delà du 30 septembre (`openssl s_client`).
- Le site ne charge aucune ressource externe (polices auto-hébergées, aucun appel à Google Fonts, aucune tuile de carte) : vérifie dans l'onglet réseau de Playwright que toutes les requêtes vont vers buta.lyfh.fr ou iuremijuoxkzvfqyrmcc.supabase.co.
- `.env` ignoré par git, `.env.example` à jour, `Logo.jpeg` ignoré ; `git log -p` récent ne contient aucune clé.
- Edge Functions : CORS limité, aucune clé dans les réponses, `expliquer-ecart` et `analyste` refusent un corps malformé sans fuite de pile.
- n8n : credentials par nom dans les exports ; l'instance n'expose pas de webhook public inutile pour ce projet.
- VPS : Fail2Ban a déjà banni l'IP de développement une fois (liste de confiance Plesk) ; vérifie que le déploiement rsync passe et que la page d'accueil et une route profonde répondent 200 après déploiement (`npm run deploiement` le fait).

## 6. Les onze écrans, un par un (1280 px puis 375 px, thème sombre puis clair)

Pour chacun : Vue d'ensemble, Territoires, Funnel et leads, Ventes et marge, Forecast et atterrissage, Pose et encaissement, Plans d'action et rituels, Qualité et référentiels, Automatisations, Analyste, Méthode.

- Titre et sous-titre corrects, badge « simulé » ou « réel, source » juste, ligne « Sources et hypothèses » présente avec vues, sources, licences et dates, mention « données d'activité simulées » sur tout écran d'activité, pied de page réglementaire sur toutes les pages.
- Filtres de la barre haute (période mois, trimestre, année à date ; comparaison objectif ou N-1 ; agence) : chaque changement recalcule l'écran, l'adresse porte `periode`, `comparaison`, `agence`, un lien copié rejoue la même vue.
- Chaque carte KPI : valeur, variation avec la bonne couleur (indicateurs « plus bas = mieux » inversés), « n. d. » quand c'est honnête (annulation à 60 jours du mois en cours, N-1 de 2025), bouton « i » qui ouvre une fiche complète (définition, formule, grain, vue, source).
- Chaque graphique : menu « ⋯ » (plein écran, PNG, CSV, requête SQL), unité écrite, axe tronqué signalé, légende lisible ; chaque tableau : tri, export CSV et XLSX, colonnes secondaires masquées sur téléphone avec la mention de défilement.
- Signaux des cartes KPI : sur l'accueil, la carte CA signé (écart au-delà de -20 %) s'enflamme une fois après son compteur ; rien ne bouge avec `prefers-reduced-motion`.
- Palette Cmd K : aller à un écran, filtrer une agence, ouvrir une fiche, tout au clavier ; Échap ferme.
- Thème clair : contraste des textes et des graphiques ; bascule persistante.
- Téléphone : tiroir de navigation, compteurs empilés, aucun débordement horizontal, Sankey vertical.
- Repli instantané : avec Playwright, bloque les requêtes vers Supabase (`route.abort`) et vérifie que chaque écran affiche l'instantané avec le badge « instantané », sans erreur.
- Contenu : aucun superlatif, aucun anglicisme hors vocabulaire du métier admis, aucun tiret long, espace insécable avant % et unités, virgule décimale, dates à la française. Aucune mention de l'entité rachetée (retirée le 19 septembre) nulle part dans le site (`grep -rn` sur `src/` et `dist/`), aucun logo ou couleur Butagaz, agences nommées par bassins seulement.
- Analyste : suggestions cliquables, réponse, tableau des lignes, requête repliée copiable, refus en une phrase avec renvoi, historique local, garde-fous affichés, coût du jour.
- Automatisations : cinq cartes avec dernière et prochaine exécution, journal alimenté, exports JSON actifs, schéma du flux dessiné.
- Méthode : liens externes tous en 200 (`curl -sI` sur chaque `href`), dates de vérification des sources exactes, export Power BI téléchargeable (zip qui s'ouvre, vingt et une tables, `modele_etoile.md`, `mesures.dax`, `LISEZMOI.md`).

## 7. Vérité des chiffres et cohérence du récit

- Échantillon de dix nombres affichés (accueil, Ventes, Forecast, Pose, Qualité, Territoires) recalculés en SQL depuis les vues : identiques au format près.
- Guide illustré (`docs/GUIDE_ILLUSTRE.md`) : les chiffres cités dans le texte sont ceux des captures du 19 septembre (journée publiée du 18/09) ; si la journée publiée a avancé, ne refais pas les captures : dis-le dans le rapport, le guide précise que les chiffres bougent chaque matin.
- `docs/GUIDE.md` (guide de présentation pour l'entretien) : dates, chiffres, ordre de visite et réponses aux questions difficiles à jour avec l'état réel (n8n publié, Analyste en navigation, thème menthe, logo, décisions du 19 septembre).
- Fiche : `npm run fiche` sans erreur, `docs/FICHE.pdf` s'ouvre (80 pages environ, couverture, sommaire paginé, chapitres), page partageable https://claude.ai/artifact/5E4wJCwbLGc3QSGFAy8aNe à jour (republie avec `url` si le guide a changé).
- Les sept histoires plantées se retrouvent à l'écran là où le guide le dit (Marensin, Bordeaux Métropole, Saintonge, Nord, départements à distance, saisonnalité, Bassin d'Arcachon).

## 8. Documentation et dépôt

- `docs/REPRISE.md` : état exact, plus aucune décision en attente, feuille de route de mardi matin.
- `docs/JOURNAL.md` : entrée finale du gel avec les preuves.
- `docs/BACKLOG.md` : lots 0 à 5 avec leur statut ; ce qui n'est pas fait (WF4, points renvoyés après l'entretien) est écrit, pas oublié.
- `docs/INDICATEURS.md` : `npm run verif:sources` vert ; `docs/AUTOMATISATIONS.md`, `docs/IA.md`, `docs/DESIGN.md` cohérents avec le code (thème menthe, logo, signaux, Paged.js).
- `n8n/LISEZMOI.md` cohérent avec l'instance.
- Aucun `TODO`, aucun test `skip`, aucune branche non implémentée (`grep -rn "TODO\|\.skip(\|\.only(" src tests e2e scripts`).

## 9. Gel (lundi avant 20 h), dans cet ordre

1. `SUPABASE_DB_SSL_NON_VERIFIE=1 npm run publier -- --jusqua 2026-09-25` (idempotent, zéro dossier attendu, rafraîchit l'heure d'intégration pour que le contrôle 11 reste vert jusqu'au jeudi 24).
2. `npm run instantane`, `npm run check`, `npm run deploiement`, puis `E2E_BASE=https://buta.lyfh.fr npx playwright test` : 42/42.
3. Lighthouse de l'accueil et de l'Analyste en production après le dernier déploiement.
4. Sauvegarde de sûreté : export du schéma `buta` (`pg_dump --schema=buta` vers un fichier hors dépôt, dans `~/Desktop/buta-lyfh-sauvegardes/`), archive de `dist/` datée au même endroit. Décris le plan de retour arrière (redéployer l'archive précédente par rsync).
5. Commit « chore: gel avant l'entretien du 22 septembre », push, tag `gel-entretien-2026-09-22`.
6. Entrée finale du journal, REPRISE à jour, rapport `docs/CONTROLE_FINAL.md` terminé.

## 10. Préparation de mardi matin (à écrire dans le rapport)

- Checklist de 09 h 30 : site en 200, badge de fraîcheur à la veille (journée du 21/09 intégrée à 06:0x), Supabase actif, n8n actif, exécutions WF1 et WF2 du matin en succès, instantané de secours prêt, `docs/FICHE.pdf` ouvert, page partageable ouverte, téléphone avec le site ouvert.
- Parcours de démonstration en cinq minutes tiré de `docs/GUIDE.md`, avec l'ordre des écrans et la phrase clé de chacun.
- Plan B si le site ne répond pas : la fiche PDF et les captures ; plan C si Supabase ne répond pas : le badge « instantané » et les chiffres embarqués.
- Les limites à dire soi-même si la question vient : données d'activité simulées, « n. d. » assumés, WF4 non construit (rejeu mensuel par script), tâches pg_cron de secours, budget IA plafonné, jeu d'évaluation de 24 questions.
- Les réponses préparées aux questions difficiles listées dans `docs/GUIDE.md` et dans les relectures à trois lentilles du journal (attribution des nombres, coût à l'échelle, données réelles, sécurité des clés, ce qui se passerait avec un vrai CRM).

Termine par un message qui tient seul : ce qui est vert, ce qui a été corrigé (avec les commits), ce qui reste à décider par Frédéric, et l'heure du dernier déploiement.
