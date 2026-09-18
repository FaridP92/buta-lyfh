-- 0018 : dossier_a_date évalue buta.journee_publiee() une seule fois (lot 4a).
-- Le cross join sur une sous-requête scalaire était aplati par le planificateur : la fonction (non
-- inlinable à cause de son search_path) était appelée pour chaque ligne et chaque expression, et le
-- filtre sur date_lead ajouté par 0017 faisait basculer le plan sur un parcours d'index avec accès
-- aléatoire au tas (mart_kpi_mensuel : 5,4 s, quatre vues au-delà du délai de 8 s de l'API).
-- Avec un CTE matérialisé, la journée est calculée une fois par référence à la vue : 50 ms.

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
  d.motif_annulation, d.statut, d.prix_catalogue, d.taux_remise,
  case when d.date_signature <= j.j then d.montant_ht end as montant_ht,
  d.cout_materiel, d.cout_pose, d.commission, d.aide_montant,
  case when d.aide_versee_le <= j.j then d.aide_versee_le end as aide_versee_le,
  d.technicien, j.j as journee
from buta.fait_dossier d
cross join j
where d.publie and d.date_lead <= j.j;
comment on view buta.dossier_a_date is 'Interne : dossiers publiés vus à la journée publiée (leads postérieurs exclus, événements postérieurs masqués), journée évaluée une fois. Non exposé.';
