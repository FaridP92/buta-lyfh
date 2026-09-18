# Exports des workflows n8n

Un fichier JSON par workflow (nom, nœuds, connexions, réglages, étiquettes), tel qu'exporté depuis l'instance n8n.lyfh.fr après publication. Les credentials n'y figurent que par leur nom (« Supabase Buta (service role) », « Gmail account ») : aucun secret. Les fichiers sont copiés dans `dist/n8n/` à la construction (`scripts/copier-exports-n8n.ts`) et servis par l'écran Automatisations.

| Fichier | Workflow | Déclencheur |
|---|---|---|
| `wf0-erreurs.json` | Buta - Erreurs (journal et alerte) | Error Trigger (réglage « Error workflow » de WF1, WF2, WF5) |
| `wf1-journee-simulee.json` | Buta - Journée simulée (quotidien 06:00) | chaque jour à 06:00 Europe/Paris |
| `wf2-controles-qualite.json` | Buta - Contrôles qualité (quotidien 06:20) | chaque jour à 06:20 |
| `wf5-sante.json` | Buta - Santé (toutes les 6 h) | toutes les 6 heures, minute 10 |

Pour réimporter : n8n, « Import from file », puis rattacher les credentials par leur nom et publier.
