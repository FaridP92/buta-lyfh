-- 0036 : relecture de 0034 (23 septembre 2026). Les vues privées de buta_prive ne donnaient le droit de lecture au
-- rôle service que parce qu'elles avaient été créées dans buta avant d'être déplacées (0025). Une vue mince est
-- security_invoker : les Edge Functions (lireVue, clé service) et le workflow n8n WF5 doivent pouvoir lire la vue
-- privée. Toute vue créée désormais dans buta_prive par postgres reçoit ce droit d'office ; anon, authenticated et
-- analyste_ro restent à accorder explicitement, vue par vue (DONNEES.md §4.8).
alter default privileges for role postgres in schema buta_prive grant select on tables to service_role;
