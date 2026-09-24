# Portes de qualité

## 1. À chaque lot
- `npm run check` : typage strict, lint, tests unitaires (lib, formatage, schémas), `verif:tirets`, `verif:sources`.
- `npm run check` mesure la couverture Vitest de `src/lib`, des garde-fous et de `nombres.ts` avec des seuils (92 % de lignes, 80 % de branches, 85 % de fonctions, `vitest.config.ts`) : un calcul ajouté sans test fait échouer la porte.
- Chaos (`e2e/chaos.spec.ts`, joué par `npm run e2e`) : Supabase coupé, lent (20 s), corps corrompu, 500, instantané coupé en même temps, Edge Function coupée en cours de requête ou répondant hors contrat. Chaque écran doit rester lisible sur l'instantané et l'Analyste dire « Pas de réponse » ; aucune exception non gérée.
- Captures d'écran des écrans touchés en 1280 px et 375 px (Playwright), comparées à DESIGN.md avec le skill visual-verdict : palette, typographie, grille, états, badges. Un écart est corrigé avant de passer au lot suivant.
- Critères d'acceptation du lot cochés dans JOURNAL.md avec la preuve (commande, sortie, capture).
- Commit (skill git-commit-guardian) et déploiement, puis contrôles de DEPLOIEMENT_VPS.md §4.

## 2. Données
- Totaux de contrôle de DONNEES.md §1 retrouvés à 0,5 % après ingestion.
- Sept requêtes d'histoires (`supabase/tests/histoires.sql`) : chaque effet attendu retrouvé avec la bonne amplitude (± 20 % de l'effet cible).
- Douze contrôles exécutés sur le jeu complet : les seuls KO attendus sont ceux de l'agence Nord (H4) sur la période d'intégration ; le contrôle 12 travaille par cohorte, pas par mois d'événement.
- Advisors Supabase sans alerte de sécurité ; test négatif : `select * from buta.fait_dossier` avec la clé anon renvoie une erreur ou zéro ligne.

## 3. Interface
- Chaque chiffre affiché correspond à sa vue `mart_` (test Playwright qui lit l'API et compare cinq KPI par écran).
- Chaque carte KPI a une fiche ; chaque graphique a source, unité, export.
- Navigation clavier complète ; contraste AA ; Lighthouse : performance supérieure à 90, accessibilité supérieure à 95, bonnes pratiques 100.
- Zéro erreur console sur toutes les routes, en ligne, en 1280 px et 375 px.
- Badge « simulé » présent sur tous les écrans d'activité ; mention réglementaire dans le pied de chaque page ; aucun logo ni couleur Butagaz ; aucune phrase de recommandation d'implantation.

## 4. IA
Jeu d'évaluation à 90 % au moins ; refus corrects ; aucun nombre non traçable dans dix réponses tirées au hasard ; budget et quotas testés (le 11e appel dans la minute est refusé proprement).

## 5. Relecture finale (mode ultracode, dimanche soir et lundi)
Workflow de réfutation à trois lentilles, chacune avec `model: 'claude-opus-4-8'`, `effort: 'max'`, schéma de verdict `{ refute, problemes: [{ ou, phrase, probleme, gravite, correction }], verdict }`, sans juge de synthèse :
1. Faits : chaque texte de l'interface et de la page Méthode contre DONNEES.md, INDICATEURS.md et les chiffres de contrôle.
2. Forme : typographie française, tirets, unités, cohérence des libellés, orthographe, absence de superlatif et d'anglicisme.
3. Recruteur Butagaz simulé (Directeur Commerce et Opérations, contrôleur de gestion de formation) : cherche la faille, la prétention, le chiffre invraisemblable, la donnée qui pourrait passer pour réelle, et toute phrase qui associe une agence, une personne ou une entité réelle à une performance simulée. Chaque point bloquant est corrigé, chaque point mineur noté dans le journal.

## 6. Le lundi 21 septembre à 20 h (gel)
- WF1 et WF2 ont tourné le matin, le badge affiche la veille ; les journées sont publiées d'avance jusqu'au 25 septembre.
- Lien ouvert sur téléphone en 4G : accueil sous 2 s, Territoires sous 3 s.
- Tout écran non fini retiré de la navigation.
- Mail de remerciement du mardi préparé avec le lien et deux phrases de présentation (BRIEF.md §7).
