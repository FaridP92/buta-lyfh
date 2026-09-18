# Architecture · Buta.Lyfh

## 1. Choix et raisons
- Front : application web statique (React 19, Vite 7, TypeScript strict avec `noUncheckedIndexedAccess` et `exactOptionalPropertyTypes`, Tailwind CSS v4, composants Radix via shadcn/ui, ECharts 6 avec `echarts-for-react`, Framer Motion, TanStack Query, React Router 7, Zod, Fontsource). Même socle que DVF Insights, déjà éprouvé par Frédéric ; un bundle statique se déploie sur le VPS Plesk sans runtime Node à maintenir, et tient le jour J.
- Données : Supabase Postgres, schéma `buta` (projet cible dans JOURNAL.md), RLS lecture publique sur les vues et dimensions, écriture par le rôle service uniquement. Accès front via PostgREST avec la clé anon.
- Automatisations : n8n (n8n.lyfh.fr), workflows publiés via le MCP, appels RPC Supabase avec le credential service, journal en base. Le motif « journal, alerte email après trois échecs » est repris des workflows Courant.
- IA : Supabase Edge Functions (Deno) `analyste` et `expliquer-ecart`, clé Anthropic en secret Supabase, modèle `claude-sonnet-5` ; repli Mistral (credential n8n) via un webhook n8n si la clé Anthropic manque. Le front appelle les fonctions avec la clé anon ; les fonctions appliquent quota, journal et budget.
- Secours : `public/data/instantane/*.json` regénéré à chaque déploiement (`npm run instantane`) ; le front lit d'abord l'instantané (affichage immédiat), puis rafraîchit depuis Supabase et remplace, en affichant « instantané du JJ/MM » si Supabase ne répond pas.
- Hébergement : `https://buta.lyfh.fr`, sous-domaine Plesk du VPS OVH (51.77.150.125), fichiers statiques servis par nginx, TLS Let's Encrypt (DEPLOIEMENT_VPS.md).

## 2. Arborescence
```
buta-lyfh/
  CLAUDE.md  PROMPT_DEMARRAGE.md  README.md  .env.example  package.json  vite.config.ts  tsconfig.json
  docs/                    ce dossier
  public/
    data/instantane/       JSON de secours (générés)
    geo/                   GeoJSON départements 100 m et communes simplifiées par département (générés au lot 1, moins de 300 Ko chacun)
    fonts/                 (vide : Fontsource via node_modules)
  src/
    app/                   routeur, mise en page (rail, barre haute, pied), fournisseurs (Query, thème, filtres URL)
    ecrans/                un dossier par écran : vue-ensemble, territoires, funnel, ventes, forecast, pose, plans-action, qualite, automatisations, analyste, methode
    composants/            carte-kpi, tableau, pastille, badge, fiche-indicateur, palette-commandes, export
    graphiques/            thème ECharts, sankey, cascade, eventail, heatmap, geo, mini-courbe
    donnees/               client Supabase, référentiel des vues (Zod), useVue(nom, filtres), instantané, formatage
    lib/                   calculs interactifs testés : indice.ts, forecast.ts, remise.ts, phrases.ts, format.ts
    styles/                tokens.css, base.css
  scripts/
    ingerer-marche.ts  generer-activite.ts  instantane.ts  deploiement.sh  verif-tirets.ts  verif-sources.ts  export-powerbi.ts
  supabase/
    migrations/            0001_schema.sql ... (dimensions, faits, marché, exploitation, vues, RLS, rôles, fonctions)
    functions/analyste/    index.ts  prompts.ts  garde-fous.ts
    functions/expliquer-ecart/
    seed/                  référentiels (agences, canaux, produits, contrôles, plans d'action)
  n8n/                     exports JSON des cinq workflows, README
  e2e/                     Playwright
  tests/                   Vitest (lib, formatage, schémas Zod)
```

## 3. Flux de données
1. Marché : `scripts/ingerer-marche.ts` (local, mensuel par n8n pour la partie légère) vers `marche_*`, `rge_installateur`, `source_fraicheur`.
2. Activité : `scripts/generer-activite.ts` (une fois) vers `fait_dossier`, `fait_cout_canal`, `objectif`, dimensions ; publication quotidienne par `buta.publier_journee`.
3. Marts : vues et vues matérialisées rafraîchies par `buta.rafraichir_marts()` en fin de WF1.
4. Front : `useVue('mart_funnel', filtres)` valide la réponse avec Zod, met en cache 60 s, retombe sur l'instantané en cas d'échec.
5. IA : front vers Edge Function (clé anon) vers Postgres (rôle `analyste_ro`) et Anthropic ; journal `ia_usage`, `analyste_question`.
6. Automatisations : n8n vers RPC Supabase (clé service) vers journal `automatisation_run`, lu par l'écran Automatisations.

## 4. Environnements et secrets
- Local : `.env` avec `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (scripts seulement, jamais dans `VITE_`), `SUPABASE_DB_URL` (migrations, scripts), `VPS_HOTE=root@51.77.150.125`, `VPS_RACINE=/var/www/vhosts/lyfh.fr/buta.lyfh.fr`.
- Supabase : secrets `ANTHROPIC_API_KEY`, `IA_BUDGET_JOUR_EUR` (5 la semaine de l'entretien, 1.5 ensuite), `IA_MODELE=claude-sonnet-5`, facultatifs `MISTRAL_API_KEY` (repli) et `IA_SEL` (sel de l'empreinte). La lecture de l'analyste utilise `SUPABASE_DB_URL`, injectée par Supabase dans l'environnement des fonctions, avec `set local role analyste_ro` et `set local statement_timeout = '5s'` dans la transaction (lot 4b, migration 0024) : aucun mot de passe supplémentaire à distribuer.
- n8n : credential Supabase (clé service, à créer pour ce projet, nommée « Supabase Buta (service role) »), credential Anthropic ou Mistral, Gmail existant pour les alertes.
- Aucun secret dans le dépôt, `.env.example` complet et commenté.

## 5. Performance
Bundle initial inférieur à 900 Ko compressé ; ECharts chargé par écran (import dynamique par type de graphique) ; GeoJSON départements 100 m (environ 1 Mo) chargé à l'entrée de Territoires ; communes simplifiées (moins de 300 Ko par département, mesuré au lot 1) chargées à la demande et mises en cache ; images absentes (tout est vectoriel) ; polices sous-ensemble latin ; en-têtes de cache immuables sur `/assets/`, `index.html` sans cache. Objectif : premier affichage utile sous 2 s en 4G, interaction sous 100 ms.
