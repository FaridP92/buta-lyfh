-- Douze plans d'action simules, coherents avec les sept histoires (ECRANS.md §7). Proprietaires en codes.
-- Rejouable : la table est videe puis rechargee (pas de cle naturelle).

truncate buta.plan_action;

insert into buta.plan_action (agence, levier, proprietaire_code, gain_attendu, statut, echeance, avancement, indicateur_code) values
  ('BDX', 'Plafonner les leads achetés à 60 par mois et renégocier le prix du lead', 'C-BDX-01', 9000, 'en cours', '2026-10-31', 40, 'CPV'),
  ('MAR', 'Rétablir le rituel hebdomadaire de qualification des RDV avant devis', 'C-MAR-01', 14000, 'en cours', '2026-10-15', 70, 'TX_DEVIS'),
  ('SAI', 'Plafonner la remise à 6 % et réserver les remises au-delà à validation du responsable', 'C-SAI-01', 35000, 'planifié', '2026-11-30', 10, 'TX_MARGE'),
  ('NOR', 'Aligner le référentiel produits et qualifier les dossiers restants', 'C-NOR-01', 0, 'en cours', '2026-09-30', 85, 'QUALITE'),
  ('ARC', 'Renfort de pose : deux jours-technicien par semaine en sous-traitance jusqu''à résorption du carnet', 'C-ARC-01', 380000, 'en cours', '2026-10-31', 55, 'CARNET'),
  (null, 'Relancer sous 48 heures tout lead sans RDV planifié (file d''attente partagée)', 'RP-RESEAU', 21000, 'en cours', '2026-10-31', 30, 'ATTENTE48'),
  ('HGI', 'Grouper les poses des départements couverts à distance par tournées hebdomadaires', 'C-HGI-01', 12000, 'planifié', '2026-12-15', 0, 'D_SIGN_POSE'),
  (null, 'Appel de confirmation à J+3 après signature dans les départements couverts à distance', 'RP-RESEAU', 26000, 'en cours', '2026-11-15', 45, 'TX_ANNUL'),
  ('ANG', 'Animer le réseau de partenaires artisans avec un rendez-vous mensuel', 'C-ANG-01', 8000, 'planifié', '2026-12-31', 0, 'LEADS'),
  ('BOR', 'Suivi à 7 jours de tous les devis issus du salon d''octobre', 'C-BOR-01', 6000, 'planifié', '2026-11-15', 0, 'TX_SIGN'),
  (null, 'Relance d''encaissement à J+15 après pose, automatisée', 'RP-RESEAU', 15000, 'terminé', '2026-08-31', 100, 'D_ENCAISSE'),
  (null, 'Dossier d''aide complet avant la pose pour réduire les aides en attente', 'RP-RESEAU', 18000, 'en cours', '2026-12-31', 20, 'AIDES_ATT');
