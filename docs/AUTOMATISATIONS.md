# Automatisations · n8n et Edge Functions

Principe repris des workflows Courant : chaque workflow écrit une ligne dans `automatisation_run` (début, fin, statut, message, lignes), porte une note collante (déclencheur, entrées, sorties, credentials par nom), et envoie un email Gmail à Frédéric après trois échecs consécutifs. Les workflows sont créés, validés (`validate_workflow`) et publiés via le MCP n8n, puis exportés en JSON dans `n8n/` à chaque modification. Le skill `n8n-workflow-architect` relit chaque workflow avant publication. Aucun secret dans les exports.

## 1. Workflows
| Code | Nom n8n | Déclencheur | Étapes | Sortie visible |
|---|---|---|---|---|
| WF1 | Buta - Journée simulée (quotidien 06:00) | Schedule 06:00 Europe/Paris | RPC `buta.publier_journee(veille)` (idempotent : si la veille est déjà publiée d'avance, zéro ligne et statut « déjà publié ») ; RPC `buta.rafraichir_marts()` ; journal | badge de fraîcheur « journée du JJ/MM intégrée à 06:0x » |
| WF2 | Buta - Contrôles qualité (quotidien 06:20) | Schedule 06:20 | RPC `buta.executer_controles(jour)` ; si un contrôle bloquant est KO ou si le score est sous 90 : email Gmail avec la synthèse ; journal | écran Qualité, alertes de la Vue d'ensemble |
| WF3 | Buta - Revue hebdomadaire (lundi 07:00) | Schedule lundi 07:00 | RPC `buta.faits_revue_hebdo(semaine précédente)` ; nœud modèle (Anthropic si credential présent, sinon Mistral) avec le prompt de IA.md §4 ; contrôle que le texte ne contient aucun nombre absent des faits (nœud Code) ; RPC `buta.publier_revue` ; email Gmail à Frédéric ; journal | écran Plans d'action et rituels, bloc Revue |
| WF4 | Buta - Marché mensuel (1er du mois 03:00) | Schedule mensuel | RGE : 101 appels `values_agg` par département (HTTP Request, batch 5, attente 500 ms) ; RTE : export CSV filtré SOLAI agrégé par département (nœud Code) ; DPE : `values_agg` F ou G et énergies par département ; RPC `buta.upsert_marche_departement(jsonb)` ; `source_fraicheur` ; journal | écran Territoires, fraîcheur des sources |
| WF5 | Buta - Santé (toutes les 6 h) | Schedule */6 h | HTTP `https://buta.lyfh.fr/` (attend 200 et « Buta.Lyfh ») ; HTTP Supabase `mart_kpi_mensuel?limit=1` ; journal ; email après trois échecs | écran Automatisations |

Règles : idempotence (rejouer WF1 le même jour ne publie rien deux fois ; WF4 fait des upserts) ; délais d'attente explicites sur chaque nœud HTTP (30 s) ; pas de boucle sans borne ; un sous-workflow par département pour WF4 si la mémoire pose problème (leçon DVF Insights). Fuseau Europe/Paris sur l'instance.

## 2. Edge Functions (Supabase, Deno)
### `analyste`
Entrée : `{ question: string, contexte?: { periode, agence } }`. Sortie : `{ statut: 'ok' | 'refus' | 'repli' | 'erreur', sql?, colonnes?, lignes?, reponse?, sources?, cout_eur, duree_ms, motif_refus? }` (même union pour `expliquer-ecart`, validée par Zod côté front).
Étapes : quota (5 appels par minute et 20 par jour par empreinte d'adresse hachée, 400 par jour au total, budget `IA_BUDGET_JOUR_EUR`, fixé à 5 € la semaine de l'entretien puis 1,5 €) ; classification de la question (périmètre, conseil, hors sujet) ; génération SQL par le modèle avec le catalogue des vues autorisées (IA.md §2) ; validation syntaxique et sémantique (SELECT unique, vues autorisées seulement, `LIMIT` forcé à 200, aucune fonction dangereuse) ; exécution avec le rôle `analyste_ro` et `statement_timeout 5s` ; rédaction de la réponse par le modèle à partir des lignes (le modèle ne calcule rien : s'il faut un total, il est calculé en SQL) ; contrôle que tout nombre de la réponse figure dans les lignes ou est une reformulation d'unité ; journal `analyste_question` et `ia_usage`.
### `expliquer-ecart`
Entrée : `{ perimetre: 'reseau' | code agence, mois, indicateur: 'CA' | 'MARGE' | 'CONVERSION' }`. Étapes : lecture des faits dans `mart_ecarts`, `mart_funnel`, `mart_ventes_produit`, `mart_alertes` pour le périmètre ; prompt structuré (IA.md §3) ; sortie `{ constat, causes: [{texte, fait, source}], action, sources }` ; même contrôle des nombres ; cache 24 h par clé (périmètre, mois, indicateur, date de publication) pour ne pas payer deux fois la même explication.
Repli : si `ANTHROPIC_API_KEY` est absent ou le budget épuisé, `statut: 'repli'` et le front affiche les phrases par règles (`src/lib/phrases.ts`).

## 3. Journal et affichage
`automatisation_run` alimente l'écran Automatisations (50 dernières exécutions, durée, statut) et la ligne « prochaine exécution » calculée depuis le déclencheur. `ia_usage` alimente un compteur discret sur l'écran Analyste (« coût du jour : 0,23 € sur 1,50 € »).

## 4. Mise en place
1. Credential n8n « Supabase Buta (service role) » (URL du projet, clé service) ; credential Anthropic « Anthropic Buta » si la clé existe.
2. Secrets Supabase : `supabase secrets set ANTHROPIC_API_KEY=... IA_BUDGET_JOUR_EUR=1.5 ANALYSTE_DB_URL=...` ; déploiement des fonctions par le MCP (`deploy_edge_function`).
3. Création des cinq workflows par le MCP, exécution manuelle de test de chacun, vérification des lignes de journal, publication, export JSON.
4. Le lundi 21 septembre au matin, vérifier que WF1, WF2 ont tourné et que le badge de fraîcheur affiche la veille. Avant le gel de 20 h, publier d'avance jusqu'au 25 septembre (`npm run publier -- --jusqua 2026-09-25`) : si n8n ne tourne pas mardi matin, l'application reste fraîche et le contrôle 11 (72 heures) reste vert.
