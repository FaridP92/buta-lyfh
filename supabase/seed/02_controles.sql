-- Les douze controles de coherence (DONNEES.md §4.6). Chaque requete renvoie les lignes en anomalie
-- (au plus quelques colonnes), executee par buta.executer_controles. Rejouable (upsert).

insert into buta.controle (code, ordre, libelle, regle, bloquant, requete) values
  ('C01', 1, 'Dossier sans agence', 'Tout dossier publié porte une agence.', true,
   $q$select id, date_lead from buta.fait_dossier where publie and agence is null$q$),
  ('C02', 2, 'Dossier sans canal', 'Tout dossier publié porte un canal d''acquisition.', false,
   $q$select id, date_lead from buta.fait_dossier where publie and canal is null$q$),
  ('C03', 3, 'Statut incohérent avec les dates', 'Pas de pose sans signature, pas d''encaissement sans pose, pas de dossier sans statut.', true,
   $q$select id, agence, statut, date_signature, date_pose, date_encaissement from buta.fait_dossier
     where publie and (
       (date_pose is not null and date_signature is null)
       or (date_encaissement is not null and date_pose is null)
       or statut is null
       or (statut = 'pose' and date_pose is null)
       or (statut = 'signe' and date_signature is null)
       or (statut = 'encaisse' and date_encaissement is null))$q$),
  ('C04', 4, 'Dates non chronologiques', 'Lead, RDV, devis, signature, pose, encaissement se suivent dans l''ordre.', true,
   $q$select id, agence, date_lead, date_rdv, date_devis, date_signature, date_pose, date_encaissement from buta.fait_dossier
     where publie and (
       date_rdv_planifie < date_lead or date_rdv < date_lead or date_devis < date_rdv
       or date_signature < date_devis or date_pose < date_signature
       or date_encaissement < date_pose or date_annulation < date_signature)$q$),
  ('C05', 5, 'Doublon probable', 'Même empreinte de contact, même produit, à moins de 30 jours.', false,
   $q$select a.id, b.id as doublon, a.agence, a.date_lead from buta.fait_dossier a
     join buta.fait_dossier b on b.empreinte_contact = a.empreinte_contact and b.produit = a.produit and b.id > a.id
       and abs(b.date_lead - a.date_lead) <= 30
     where a.publie and b.publie$q$),
  ('C06', 6, 'Montant hors bornes du produit', 'Montant HT signé entre 60 % et 140 % du prix catalogue du produit.', false,
   $q$select d.id, d.agence, d.produit, d.montant_ht, p.prix_catalogue from buta.fait_dossier d
     join buta.dim_produit p on p.code = d.produit
     where d.publie and d.montant_ht is not null
       and (d.montant_ht < p.prix_catalogue * 0.6 or d.montant_ht > p.prix_catalogue * 1.4)$q$),
  ('C07', 7, 'Remise supérieure à 20 %', 'Aucune remise au-delà de 20 % du prix catalogue.', false,
   $q$select id, agence, taux_remise from buta.fait_dossier where publie and taux_remise > 0.20$q$),
  ('C08', 8, 'Marge négative', 'Montant HT moins coût matériel moins coût de pose reste positif.', false,
   $q$select id, agence, produit, montant_ht, cout_materiel, cout_pose from buta.fait_dossier
     where publie and montant_ht is not null and montant_ht - cout_materiel - cout_pose < 0$q$),
  ('C09', 9, 'Libellé produit hors référentiel', 'Le libellé produit reçu de la source correspond au référentiel commun.', true,
   $q$select id, agence, date_lead, produit_libelle_source from buta.fait_dossier
     where publie and produit_libelle_source is not null
       and produit_libelle_source not in (select libelle from buta.dim_produit)$q$),
  ('C10', 10, 'Objectif manquant pour un mois publié', 'Chaque mois publié de chaque agence a un objectif.', false,
   $q$select distinct date_trunc('month', d.date_lead)::date as mois, d.agence from buta.fait_dossier d
     where d.publie and d.agence is not null
       and not exists (select 1 from buta.objectif o where o.mois = date_trunc('month', d.date_lead)::date and o.agence = d.agence)$q$),
  ('C11', 11, 'Fraîcheur de la journée simulée', 'La dernière journée publiée date de moins de 72 heures.', true,
   $q$select source, date_reference, ingere_le from buta.source_fraicheur
     where source = 'journee_simulee' and ingere_le < now() - interval '72 hours'
     union all
     select 'journee_simulee', null, null where not exists (select 1 from buta.source_fraicheur where source = 'journee_simulee')$q$),
  ('C12', 12, 'Funnel monotone par cohorte', 'Par agence et mois de création du lead : leads ≥ RDV tenus ≥ devis ≥ signatures ≥ poses.', false,
   $q$select agence, mois, leads, rdv, devis, signatures, poses from (
       select agence, date_trunc('month', date_lead)::date as mois,
         count(*) as leads, count(date_rdv) as rdv, count(date_devis) as devis,
         count(date_signature) as signatures, count(date_pose) as poses
       from buta.fait_dossier where publie group by 1, 2) t
     where not (leads >= rdv and rdv >= devis and devis >= signatures and signatures >= poses)$q$)
on conflict (code) do update set
  ordre = excluded.ordre, libelle = excluded.libelle, regle = excluded.regle,
  bloquant = excluded.bloquant, requete = excluded.requete;
