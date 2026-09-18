-- 0028 : filet de sécurité pg_cron (18 septembre, lot 5).
-- Les trois vues matérialisées (mart_funnel, mart_ventes_produit, mart_forecast) et les contrôles du matin ne sont
-- rafraîchis que par WF1 et WF2, qui attendent le credential n8n. Comme la journée publiée avance chaque jour
-- (plafonnée à la veille) alors que les dossiers sont déjà publiés d'avance, les vues matérialisées prendraient
-- un jour de retard sur les autres vues à chaque lever de journée. Deux tâches pg_cron (heure UTC : 04:05 et 04:15,
-- soit 06:05 et 06:15 à Paris en été) rejouent le rafraîchissement et les contrôles. Elles n'écrivent rien dans le
-- journal des automatisations (qui reste celui de n8n) et seront retirées quand WF1 et WF2 seront publiés.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.unschedule(jobid) from cron.job where jobname in ('buta_rafraichir_marts', 'buta_controles');
select cron.schedule('buta_rafraichir_marts', '5 4 * * *', $$select buta.rafraichir_marts();$$);
select cron.schedule('buta_controles', '15 4 * * *', $$select buta.executer_controles(buta.journee_publiee());$$);
