-- Cohérence du jeu simulé et des vues (VERIFICATION.md §2). Chaque requête renvoie (test, ok, ...).

-- Funnel monotone par cohorte de creation et par agence (contrôle 12, sur le jeu complet publie).
select 'funnel monotone par cohorte' as test, count(*) = 0 as ok, count(*) as cohortes_en_defaut from (
  select agence, date_trunc('month', date_lead) as mois,
    count(*) as leads, count(date_rdv) as rdv, count(date_devis) as devis, count(date_signature) as signatures, count(date_pose) as poses
  from buta.fait_dossier where publie group by 1, 2) t
where not (leads >= rdv and rdv >= devis and devis >= signatures and signatures >= poses);

-- Totaux : les vues et la table racontent la même chose (ventes et CA signe du réseau, mois complets).
with table_brute as (
  select count(*) as ventes, sum(montant_ht) as ca from buta.dossier_a_date
  where date_signature is not null and date_annulation is null and date_signature < date_trunc('month', buta.journee_publiee())),
vue as (
  select sum(ventes) as ventes, sum(ca_signe) as ca from buta.mart_kpi_mensuel
  where agence = 'RESEAU' and mois < date_trunc('month', buta.journee_publiee())),
vue_produit as (
  select sum(ventes) as ventes, sum(ca_signe) as ca from buta.mart_ventes_produit
  where agence = 'RESEAU' and produit = 'TOUS' and mois < date_trunc('month', buta.journee_publiee()))
select 'totaux ventes et CA : table = mart_kpi_mensuel = mart_ventes_produit' as test,
  table_brute.ventes = vue.ventes and table_brute.ventes = vue_produit.ventes and table_brute.ca = vue.ca and table_brute.ca = vue_produit.ca as ok,
  table_brute.ventes as ventes_table, vue.ventes as ventes_kpi, vue_produit.ventes as ventes_produit,
  table_brute.ca as ca_table, vue.ca as ca_kpi, vue_produit.ca as ca_produit
from table_brute, vue, vue_produit;

-- Somme des agences = RESEAU dans mart_kpi_mensuel.
select 'somme des agences = RESEAU (mart_kpi_mensuel)' as test, count(*) = 0 as ok, count(*) as mois_en_defaut from (
  select mois, sum(ca_signe) filter (where agence <> 'RESEAU') as somme, max(ca_signe) filter (where agence = 'RESEAU') as reseau
  from buta.mart_kpi_mensuel group by mois) t where somme <> reseau;

-- Decomposition de l'écart : résiduel sous 3 % de l'écart total (quand l'écart est significatif).
select 'résiduel de la decomposition d''écart < 3 %' as test,
  count(*) filter (where abs(residuel) > 0.03 * abs(ecart_total)) = 0 as ok,
  count(*) as lignes, count(*) filter (where abs(residuel) > 0.03 * abs(ecart_total)) as lignes_en_defaut,
  max(abs(residuel)) as residuel_max_eur
from buta.mart_ecarts where comparaison_disponible and abs(ecart_total) > 1000;

-- Les effets de la decomposition se somment à l'écart total (au résiduel pres).
select 'somme des effets = écart total' as test,
  count(*) filter (where abs(ecart_total - (effet_volume + effet_mix + effet_prix + effet_remise + residuel)) > 2) = 0 as ok,
  count(*) as lignes
from buta.mart_ecarts;

-- Poids de l'acquisition (avec commissions) entre 12 et 22 % du CA au niveau réseau, mois complets.
select 'poids de l''acquisition 12 à 22 %' as test,
  100 * sum(couts_acquisition + commissions) / sum(ca_signe) between 12 and 22 as ok,
  round(100 * sum(couts_acquisition + commissions) / sum(ca_signe), 1) as poids_pct
from buta.mart_kpi_mensuel where agence = 'RESEAU' and mois < date_trunc('month', buta.journee_publiee());

-- Aucune date posterieure à la journée publiée dans les vues d'evenement.
select 'aucun evenement futur dans dossier_a_date' as test, count(*) = 0 as ok, count(*) as lignes from buta.dossier_a_date
where date_rdv > journee or date_devis > journee or date_signature > journee or date_pose > journee or date_encaissement > journee;

-- Les douze contrôles : seuls KO ou alertes attendus, ceux de l'agence Nord (H4) : C03 (statut), C05 (doublons), C09 (libellés).
with r as (select buta.executer_controles(buta.journee_publiee()) as synthese),
detail as (
  select e->>'controle' as controle, e->>'statut' as statut, (e->>'nb_lignes')::int as nb
  from r, jsonb_array_elements(r.synthese->'controles') e)
select 'douze contrôles : seuls C03, C05, C09 en défaut (Nord)' as test,
  bool_and(statut = 'ok' or controle in ('C03', 'C05', 'C09')) as ok,
  string_agg(controle || '=' || statut || '(' || nb || ')', ' ' order by controle) as detail
from detail;

-- Les anomalies des contrôles en défaut sont toutes dans l'agence Nord.
select 'anomalies des contrôles C03, C05, C09 : agence Nord seulement' as test,
  count(*) filter (where agence <> 'NOR') = 0 as ok, count(*) as anomalies, count(*) filter (where agence = 'NOR') as dont_nord
from (
  select agence from buta.fait_dossier where publie and statut is null
  union all
  select agence from buta.fait_dossier where publie and produit_libelle_source is not null and produit_libelle_source not in (select libelle from buta.dim_produit)
  union all
  select a.agence from buta.fait_dossier a join buta.fait_dossier b on b.empreinte_contact = a.empreinte_contact and b.produit = a.produit and b.id > a.id and abs(b.date_lead - a.date_lead) <= 30 where a.publie and b.publie) t;

-- Publication d'avance (0017) : la journée publiée ne dépasse jamais la veille en heure de Paris,
-- et aucun lead postérieur à la journée n'entre dans dossier_a_date même si des dossiers sont publiés d'avance.
select 'journée publiée plafonnée à la veille (Paris)' as test,
  buta.journee_publiee() <= (now() at time zone 'Europe/Paris')::date - 1 as ok,
  buta.journee_publiee() as journee, (select date_reference from buta.source_fraicheur where source = 'journee_simulee') as publie_jusqu_au;

select 'aucun lead futur dans dossier_a_date' as test, count(*) = 0 as ok, count(*) as lignes
from buta.dossier_a_date where date_lead > journee;

-- mart_fraicheur : la journée simulée affichée est la journée publiée, la disponibilité est au moins égale,
-- la prochaine intégration est le lendemain de la dernière (WF1 tourne chaque jour à 06:00).
select 'mart_fraicheur : journée simulée = journée publiée' as test,
  date_reference = buta.journee_publiee() and disponible_jusqu_au >= date_reference and prochaine = (ingere_le at time zone 'Europe/Paris')::date + 1 as ok,
  date_reference, disponible_jusqu_au, prochaine
from buta.mart_fraicheur where source = 'journee_simulee';

-- echecs_consecutifs : zéro pour un workflow inconnu (journal vide) ; le scénario à trois échecs est vérifié en transaction annulée dans le journal.
select 'echecs_consecutifs : 0 sans exécution' as test, buta.echecs_consecutifs('WF_INCONNU') = 0 as ok, buta.echecs_consecutifs('WF_INCONNU') as valeur;

-- Sécurité (0034, 0036). Une définition de mart antérieure à 0034 recopiée telle quelle (« create or replace view
-- buta.mart_... ») efface security_invoker sans erreur : la vue s'exécuterait de nouveau avec les droits de son
-- propriétaire dans le schéma exposé. Ces trois tests le détectent, avec les grants par colonne.
select 'vues de buta lisibles par l''API toutes en security_invoker' as test, count(*) = 0 as ok,
  coalesce(string_agg(c.relname, ', '), '') as vues_en_defaut
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'buta' and c.relkind in ('v', 'm')
  and (has_any_column_privilege('anon', c.oid, 'SELECT') or has_any_column_privilege('authenticated', c.oid, 'SELECT')
    or has_any_column_privilege('analyste_ro', c.oid, 'SELECT'))
  and not coalesce('security_invoker=true' = any(c.reloptions), false);

select 'buta_prive sans usage pour les rôles de l''API ni analyste_ro' as test,
  not (has_schema_privilege('anon', 'buta_prive', 'USAGE') or has_schema_privilege('authenticated', 'buta_prive', 'USAGE')
    or has_schema_privilege('analyste_ro', 'buta_prive', 'USAGE') or has_schema_privilege('service_role', 'buta_prive', 'USAGE')) as ok;

select 'chaque vue mince lisible jusqu''à sa vue privée (anon, authenticated, analyste_ro, service_role)' as test, count(*) = 0 as ok,
  coalesce(string_agg(c.relname || ':' || r.role, ', '), '') as manquants
from pg_class c join pg_namespace n on n.oid = c.relnamespace
cross join unnest(array['anon', 'authenticated', 'analyste_ro', 'service_role']) as r(role)
where n.nspname = 'buta' and c.relkind = 'v' and c.relname like 'mart\_%'
  and not (has_table_privilege(r.role, c.oid, 'SELECT')
    and coalesce(has_table_privilege(r.role, to_regclass('buta_prive.' || quote_ident(c.relname)), 'SELECT'), false));

-- 0038 : flux et agences des contrôles. Le flux ne dépasse jamais le stock ; les agences totalisent le stock quand
-- le contrôle porte une agence ; le flux du jour de mart_qualite est la somme des flux des douze contrôles.
select 'contrôles 0038 : flux <= stock et agences = stock' as test,
  bool_and(nb_lignes_30j is null or nb_lignes_30j <= nb_lignes)
    and bool_and(agences = '{}'::jsonb or (select sum(value::int) from jsonb_each_text(agences)) = nb_lignes) as ok,
  count(*) as lignes
from buta.controle_resultat where jour = buta.journee_publiee();

select 'contrôles 0038 : flux C09 = recompte direct sur 30 jours' as test, r.nb_lignes_30j = d.n as ok, r.nb_lignes_30j, d.n as recompte
from buta.controle_resultat r,
  (select count(*) as n from buta.fait_dossier
   where publie and date_lead <= buta.journee_publiee() and date_lead > buta.journee_publiee() - 30
     and produit_libelle_source is not null and produit_libelle_source not in (select libelle from buta.dim_produit)) d
where r.jour = buta.journee_publiee() and r.controle = 'C09';

select 'mart_qualite 0038 : flux_30j_jour = somme des flux du jour' as test,
  bool_and(flux_30j_jour = somme) as ok, count(*) as jours
from (select jour, max(flux_30j_jour) as flux_30j_jour, sum(nb_lignes_30j) as somme from buta.mart_qualite group by jour) t;

select 'synthèse 0038 : changement, jour_precedent, flux et agences_texte par contrôle' as test,
  (r.s ? 'changement') and (r.s ? 'jour_precedent') and bool_and((e ? 'nb_lignes_30j') and (e ? 'agences_texte')) as ok,
  r.s->>'changement' as changement, r.s->>'jour_precedent' as jour_precedent
from (select buta.executer_controles(buta.journee_publiee()) as s) r, jsonb_array_elements(r.s->'controles') e
group by r.s;
