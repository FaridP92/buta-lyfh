-- 0039 : réconciliation datée des dossiers du Nord (26 septembre 2026, US-087).
-- H4 racontait une intégration « réconciliée par un référentiel commun », mais rien dans les données ne datait cette
-- réconciliation : un dossier du Nord reçu sans statut en juin restait en anomalie pour toujours, le doublon n'était
-- jamais fusionné, le libellé divergent jamais rapproché. Le score restait à 68. Cette migration date les trois gestes
-- qu'un Responsable Performance obtient d'une agence intégrée, avec la même règle déterministe que le générateur :
-- 1. Qualification des dossiers sans statut : `statut_qualifie` (déduit des dates finales, comme le funnel du
--    générateur) et `qualifie_le` = date du lead + 7 à 21 jours (7 + jour de l'année modulo 15). Le statut brut reçu
--    reste null : à une journée donnée, le statut vaut le statut brut, sinon le statut qualifié si la qualification est
--    passée.
-- 2. Fusion des doublons : `fusionne_le` sur le dossier le plus récent de la paire (même empreinte, même produit,
--    30 jours) = date du lead + 5 à 14 jours. Un doublon fusionné disparaît de dossier_a_date (et donc des vues) à
--    partir de cette date ; le contrôle C05 ne le compte plus.
-- 3. Rapprochement des libellés : table `ref_libelle_produit` (libellé reçu, produit, `rapproche_le`) alimentée en
--    quatre vagues du 6 juillet au 7 septembre 2026 ; le contrôle C09 ne compte que les libellés non rapprochés à la
--    journée contrôlée, et le rapprochement vaut pour tous les dossiers, anciens compris (c'est une table de
--    correspondance, pas une correction ligne à ligne).
-- Conséquence sur le jeu simulé : score 100 en mai, 73 puis 68 dès juin, remontée par paliers en septembre
-- (C09 rapproché le 7, C03 puis C05 éteints quand les derniers dossiers d'août sont qualifiés et fusionnés), 100 fin
-- septembre. L'historique de mart_qualite est rejoué après la migration. Les tests de l'histoire H4 lisent les
-- colonnes brutes (statut, empreinte, libellé reçu) et restent vrais.

alter table buta.fait_dossier
  add column if not exists statut_qualifie text references buta.dim_statut(code),
  add column if not exists qualifie_le date,
  add column if not exists fusionne_le date;
comment on column buta.fait_dossier.statut_qualifie is 'Statut attribué à la qualification d''un dossier reçu sans statut (H4, agence Nord) ; null sinon.';
comment on column buta.fait_dossier.qualifie_le is 'Date de qualification d''un dossier reçu sans statut ; avant cette date le dossier est « à qualifier ».';
comment on column buta.fait_dossier.fusionne_le is 'Date de fusion d''un doublon dans le dossier d''origine ; à partir de cette date le doublon sort des vues.';

create table if not exists buta.ref_libelle_produit (
  libelle_source text primary key,
  produit text not null references buta.dim_produit(code),
  rapproche_le date not null,
  commentaire text
);
comment on table buta.ref_libelle_produit is 'Table de correspondance des libellés produits reçus des systèmes sources vers le référentiel commun, avec la date de rapprochement (H4, intégration de l''agence Nord). Données simulées.';
alter table buta.ref_libelle_produit enable row level security;
drop policy if exists lecture_publique on buta.ref_libelle_produit;
create policy lecture_publique on buta.ref_libelle_produit for select to anon, authenticated using (true);
grant select on buta.ref_libelle_produit to anon, authenticated;

insert into buta.ref_libelle_produit (libelle_source, produit, rapproche_le, commentaire) values
  ('PV 3KW', 'PV3', '2026-07-06', 'première vague : les trois libellés les plus fréquents'),
  ('PV 6KW', 'PV6', '2026-07-06', 'première vague : les trois libellés les plus fréquents'),
  ('PAC AIR EAU 11KW', 'PACAE', '2026-07-06', 'première vague : les trois libellés les plus fréquents'),
  ('PV + BATTERIE', 'PVB', '2026-07-27', 'deuxième vague'),
  ('CHAUFFE EAU THERMO', 'CET', '2026-07-27', 'deuxième vague'),
  ('BORNE 7KW', 'BORNE', '2026-08-17', 'troisième vague'),
  ('POELE GRANULES', 'POELE', '2026-08-17', 'troisième vague'),
  ('PAC AIR/AIR', 'PACAA', '2026-09-07', 'dernier libellé, référentiel aligné')
on conflict (libelle_source) do update set produit = excluded.produit, rapproche_le = excluded.rapproche_le, commentaire = excluded.commentaire;

-- Données déjà chargées : même règle que scripts/generer-activite.ts (jour de l'année du lead).
update buta.fait_dossier set
  statut_qualifie = case
    when date_encaissement is not null then 'encaisse'
    when date_annulation is not null then 'annule'
    when date_signature is not null then 'signe'
    when date_devis is not null then 'refus'
    else 'sans_suite' end,
  qualifie_le = date_lead + 7 + (extract(doy from date_lead)::int % 15)
where statut is null;

update buta.fait_dossier b set fusionne_le = b.date_lead + 5 + (extract(doy from b.date_lead)::int % 10)
where exists (
  select 1 from buta.fait_dossier a
  where a.empreinte_contact = b.empreinte_contact and a.produit = b.produit and a.id < b.id and abs(b.date_lead - a.date_lead) <= 30);

-- Contrôles : statut vu à la journée contrôlée, doublons fusionnés et libellés rapprochés à cette date exclus.
update buta.controle set requete = 'select id, agence, date_lead, statut_a_date as statut, date_signature, date_pose, date_encaissement from (
       select d.*, coalesce(d.statut, case when d.qualifie_le <= $jour then d.statut_qualifie end) as statut_a_date
       from buta.fait_dossier d where d.publie and d.date_lead <= $jour) d
     where (date_pose is not null and date_signature is null)
       or (date_encaissement is not null and date_pose is null)
       or statut_a_date is null
       or (statut_a_date = ''pose'' and date_pose is null)
       or (statut_a_date = ''signe'' and date_signature is null)
       or (statut_a_date = ''encaisse'' and date_encaissement is null)',
  regle = 'Pas de pose sans signature, pas d''encaissement sans pose, pas de dossier sans statut à la journée contrôlée (qualification datée).'
where code = 'C03';
update buta.controle set requete = 'select a.id, b.id as doublon, a.agence, a.date_lead from buta.fait_dossier a
     join buta.fait_dossier b on b.empreinte_contact = a.empreinte_contact and b.produit = a.produit and b.id > a.id
       and abs(b.date_lead - a.date_lead) <= 30
     where a.publie and b.publie and a.date_lead <= $jour and b.date_lead <= $jour
       and (b.fusionne_le is null or b.fusionne_le > $jour)',
  regle = 'Même empreinte de contact, même produit, à moins de 30 jours, tant que le doublon n''est pas fusionné.'
where code = 'C05';
update buta.controle set requete = 'select d.id, d.agence, d.date_lead, d.produit_libelle_source from buta.fait_dossier d
     where d.publie and d.date_lead <= $jour and d.produit_libelle_source is not null
       and d.produit_libelle_source not in (select libelle from buta.dim_produit)
       and not exists (select 1 from buta.ref_libelle_produit r where r.libelle_source = d.produit_libelle_source and r.rapproche_le <= $jour)',
  regle = 'Le libellé produit reçu de la source correspond au référentiel commun ou à un libellé rapproché à la journée contrôlée.'
where code = 'C09';

-- dossier_a_date : statut vu à la journée, libellé hors référentiel non rapproché, doublons fusionnés exclus.
create or replace view buta.dossier_a_date as
with j as materialized (select buta.journee_publiee() as j)
select
  d.id, d.agence, d.commercial, d.canal, d.produit, d.produit_libelle_source, d.departement, d.empreinte_contact,
  d.date_lead,
  case when d.date_rdv_planifie <= j.j then d.date_rdv_planifie end as date_rdv_planifie,
  case when d.date_rdv <= j.j then d.date_rdv end as date_rdv,
  case when d.date_devis <= j.j then d.date_devis end as date_devis,
  case when d.date_devis <= j.j then d.montant_devis end as montant_devis,
  case when d.date_signature <= j.j then d.date_signature end as date_signature,
  case when d.date_pose <= j.j then d.date_pose end as date_pose,
  case when d.date_encaissement <= j.j then d.date_encaissement end as date_encaissement,
  case when d.date_annulation <= j.j then d.date_annulation end as date_annulation,
  d.date_pose as date_pose_prevue,
  d.date_annulation as date_annulation_finale,
  d.motif_annulation,
  coalesce(d.statut, case when d.qualifie_le <= j.j then d.statut_qualifie end) as statut,
  d.prix_catalogue, d.taux_remise,
  case when d.date_signature <= j.j then d.montant_ht end as montant_ht,
  d.cout_materiel, d.cout_pose, d.commission, d.aide_montant,
  case when d.aide_versee_le <= j.j then d.aide_versee_le end as aide_versee_le,
  d.technicien, j.j as journee,
  (d.produit_libelle_source is not null
    and d.produit_libelle_source not in (select libelle from buta.dim_produit)
    and not exists (select 1 from buta.ref_libelle_produit r where r.libelle_source = d.produit_libelle_source and r.rapproche_le <= j.j)) as libelle_hors_referentiel
from buta.fait_dossier d
cross join j
where d.publie and d.date_lead <= j.j and (d.fusionne_le is null or d.fusionne_le > j.j);
comment on view buta.dossier_a_date is 'Interne : dossiers publiés vus à la journée publiée (leads postérieurs exclus, événements postérieurs masqués, statut qualifié et libellés rapprochés à la journée, doublons fusionnés exclus), journée évaluée une fois. Non exposé.';

-- mart_alertes : même définition que 0029 (calcul dans buta_prive depuis 0034 et 0037), seule la CTE qualifier change.
create or replace view buta_prive.mart_alertes_calcul as
with j as materialized (select buta.journee_publiee() as j, date_trunc('month', buta.journee_publiee())::date as mois_courant),
cohortes_mures as (
  select mois from (select distinct mois from buta_prive.mart_couts_acquisition) m, j
  where (m.mois + interval '1 month')::date + 90 <= j.j and m.mois >= date '2026-04-01'
  order by mois desc limit 3
),
cpv as (
  select c.agence,
    sum(c.cout) filter (where c.mois in (select mois from cohortes_mures)) / nullif(sum(c.ventes) filter (where c.mois in (select mois from cohortes_mures)), 0) as cpv_recent,
    sum(c.cout) filter (where c.mois between date '2026-01-01' and date '2026-03-01') / nullif(sum(c.ventes) filter (where c.mois between date '2026-01-01' and date '2026-03-01'), 0) as cpv_t1,
    max(c.mois) filter (where c.mois in (select mois from cohortes_mures)) as derniere_cohorte,
    sum(c.ventes) filter (where c.mois in (select mois from cohortes_mures)) as ventes_recentes,
    sum(c.ventes) filter (where c.mois between date '2026-01-01' and date '2026-03-01') as ventes_t1
  from buta_prive.mart_couts_acquisition c
  where c.canal = 'leads_achetes' and c.agence <> 'RESEAU'
  group by c.agence
),
qualifier as (
  -- 0039 : statut et libellé vus à la journée publiée (qualification et rapprochement datés), doublons fusionnés exclus.
  select agence, count(*) as nb from buta.dossier_a_date
  where statut is null or libelle_hors_referentiel
  group by agence
),
fenetre_pose as (
  select p.agence, p.semaine, p.carnet_jours_ouvres, p.poses_en_retard,
    max(p.semaine) over () as derniere
  from buta_prive.mart_pose p, j
  where p.agence <> 'RESEAU' and p.semaine <= j.j and p.semaine >= j.j - 98
),
carnet as (
  select agence,
    max(carnet_jours_ouvres) filter (where semaine = derniere) as carnet_jours_ouvres,
    max(poses_en_retard) filter (where semaine = derniere) as poses_en_retard,
    (percentile_cont(0.5) within group (order by carnet_jours_ouvres) filter (where semaine between derniere - 84 and derniere - 7))::numeric as carnet_median_12s
  from fenetre_pose
  group by agence
),
alertes as (
  select 'CPV_LEADS_ACHETES' as code, agence, 'alerte' as gravite,
    round(100.0 * (cpv_recent - cpv_t1) / cpv_t1, 0) as valeur,
    'coût par vente des leads achetés +' || round(100.0 * (cpv_recent - cpv_t1) / cpv_t1, 0) || chr(160) || '% vs T1 (cohortes jusqu''à ' || to_char(derniere_cohorte, 'MM/YYYY') || ')' as texte
  from cpv where cpv_t1 > 0 and cpv_recent > 1.3 * cpv_t1 and ventes_recentes >= 8 and ventes_t1 >= 8
  union all
  select 'DOSSIERS_A_QUALIFIER', agence, 'attention', nb, nb || ' dossiers à qualifier, référentiel en cours d''alignement' from qualifier where nb > 0
  union all
  select 'CARNET_POSE', agence, 'alerte', carnet_jours_ouvres,
    'carnet de pose à ' || round(carnet_jours_ouvres, 0) || ' jours ouvrés (+' || round(100.0 * (carnet_jours_ouvres - carnet_median_12s) / carnet_median_12s, 0) || chr(160) || '% sur douze semaines)'
  from carnet where carnet_median_12s > 0 and carnet_jours_ouvres >= 5 and carnet_jours_ouvres > 1.3 * carnet_median_12s
  union all
  select 'POSES_EN_RETARD', agence, 'attention', poses_en_retard, poses_en_retard || ' poses en retard' from carnet where poses_en_retard >= 10
)
select a.code, a.agence, ag.nom_bassin, a.gravite, a.valeur, ag.nom_bassin || ' : ' || a.texte as texte, j.j as calcule_le
from alertes a join buta.dim_agence ag on ag.code = a.agence cross join j;

-- mart_reconciliation_libelles : date de rapprochement ajoutée (vue privée puis vue mince recréée, DONNEES.md §4.8).
create or replace view buta_prive.mart_reconciliation_libelles as
select d.agence, d.produit_libelle_source as libelle_source, d.produit as produit_code, p.libelle as libelle_referentiel,
  count(*) as dossiers, min(d.date_lead) as premier_lead, max(d.date_lead) as dernier_lead,
  r.rapproche_le
from buta.fait_dossier d
join buta.dim_produit p on p.code = d.produit
left join buta.ref_libelle_produit r on r.libelle_source = d.produit_libelle_source
where d.publie and d.produit_libelle_source is not null and d.produit_libelle_source <> p.libelle
group by d.agence, d.produit_libelle_source, d.produit, p.libelle, r.rapproche_le
order by dossiers desc;
comment on view buta_prive.mart_reconciliation_libelles is 'Libellés produits reçus du système source qui divergent du référentiel, par agence : libellé source, produit résolu, nombre de dossiers, premier et dernier lead, date de rapprochement dans le référentiel commun (null tant que le libellé n''est pas rapproché). Montre la réconciliation « avant, après » (H4, agence Nord). Données simulées.';
comment on column buta_prive.mart_reconciliation_libelles.rapproche_le is 'Date à laquelle le libellé a été rapproché du référentiel commun (table ref_libelle_produit) ; null tant qu''il ne l''est pas.';
create or replace view buta.mart_reconciliation_libelles with (security_invoker = true) as select * from buta_prive.mart_reconciliation_libelles;
comment on view buta.mart_reconciliation_libelles is 'Libellés produits reçus du système source qui divergent du référentiel, par agence : libellé source, produit résolu, nombre de dossiers, premier et dernier lead, date de rapprochement dans le référentiel commun (null tant que le libellé n''est pas rapproché). Montre la réconciliation « avant, après » (H4, agence Nord). Données simulées.';
comment on column buta.mart_reconciliation_libelles.rapproche_le is 'Date à laquelle le libellé a été rapproché du référentiel commun (table ref_libelle_produit) ; null tant qu''il ne l''est pas.';
grant select on buta.mart_reconciliation_libelles to anon, authenticated, analyste_ro;
grant select on buta_prive.mart_reconciliation_libelles to anon, authenticated, analyste_ro, service_role;

-- Après cette migration : select buta.rafraichir_marts() (mart_alertes et les vues matérialisées lisent dossier_a_date),
-- puis rejeu des contrôles du 1er mai à la journée publiée (JOURNAL.md).
