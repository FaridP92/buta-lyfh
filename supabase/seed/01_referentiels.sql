-- Referentiels du reseau simule (DONNEES.md §3.1 et §3.2). Rejouable (upsert).
-- Aucune agence, personne ou entite reelle : noms de bassins, effectifs codes.

insert into buta.dim_departement (code, nom, region) values
  ('16', 'Charente', 'Nouvelle-Aquitaine'),
  ('17', 'Charente-Maritime', 'Nouvelle-Aquitaine'),
  ('24', 'Dordogne', 'Nouvelle-Aquitaine'),
  ('32', 'Gers', 'Occitanie'),
  ('33', 'Gironde', 'Nouvelle-Aquitaine'),
  ('40', 'Landes', 'Nouvelle-Aquitaine'),
  ('47', 'Lot-et-Garonne', 'Nouvelle-Aquitaine'),
  ('59', 'Nord', 'Hauts-de-France'),
  ('64', 'Pyrenees-Atlantiques', 'Nouvelle-Aquitaine'),
  ('79', 'Deux-Sevres', 'Nouvelle-Aquitaine'),
  ('85', 'Vendee', 'Pays de la Loire')
on conflict (code) do update set nom = excluded.nom, region = excluded.region;

-- Coordonnees : centre approximatif du bassin, pas une adresse.
insert into buta.dim_agence (code, nom_bassin, departement, latitude, longitude, ouverture, poses_par_technicien_semaine) values
  ('SAI', 'Saintonge', '17', 45.745, -0.630, '2019-01-01', 5),
  ('ANG', 'Angoumois', '16', 45.650, 0.160, '2020-01-01', 5),
  ('MAR', 'Marensin', '40', 43.830, -1.330, '2010-01-01', 5),
  ('BOR', 'Born', '40', 44.200, -1.170, '2021-01-01', 5),
  ('MSN', 'Marsan', '40', 43.890, -0.500, '2022-01-01', 5),
  ('BDX', 'Bordeaux Metropole', '33', 44.840, -0.580, '2021-01-01', 5),
  ('HGI', 'Haute Gironde', '33', 45.130, -0.470, '2023-01-01', 5),
  ('ARC', 'Bassin d''Arcachon', '33', 44.660, -1.100, '2022-01-01', 5),
  ('NOR', 'Nord', '59', 50.370, 3.080, '2026-06-01', 5)
on conflict (code) do update set
  nom_bassin = excluded.nom_bassin, departement = excluded.departement,
  latitude = excluded.latitude, longitude = excluded.longitude,
  ouverture = excluded.ouverture, poses_par_technicien_semaine = excluded.poses_par_technicien_semaine;

insert into buta.dim_agence_territoire (agence, departement, part) values
  ('SAI', '17', 1.00), ('SAI', '79', 1.00), ('SAI', '85', 1.00),
  ('ANG', '16', 1.00), ('ANG', '24', 0.50),
  ('MAR', '40', 0.40), ('MAR', '64', 1.00),
  ('BOR', '40', 0.30), ('BOR', '33', 0.20),
  ('MSN', '40', 0.30), ('MSN', '32', 1.00), ('MSN', '47', 0.50),
  ('BDX', '33', 0.45),
  ('HGI', '33', 0.20), ('HGI', '24', 0.50), ('HGI', '47', 0.50),
  ('ARC', '33', 0.15),
  ('NOR', '59', 1.00)
on conflict (agence, departement) do update set part = excluded.part;

-- Effectifs codes : C-XXX-nn commerciaux (le 01 porte le drapeau responsable), T-XXX-nn techniciens.
-- Entree : ouverture de l'agence, ou 1er janvier 2025 pour Nord (historique repris).
with effectifs (agence, commerciaux, techniciens, entree) as (
  values
    ('SAI', 6, 7, date '2019-01-01'), ('ANG', 4, 4, date '2020-01-01'), ('MAR', 5, 7, date '2010-01-01'),
    ('BOR', 4, 5, date '2021-01-01'), ('MSN', 4, 4, date '2022-01-01'), ('BDX', 8, 9, date '2021-01-01'),
    ('HGI', 4, 5, date '2023-01-01'), ('ARC', 4, 5, date '2022-01-01'), ('NOR', 5, 6, date '2025-01-01')
),
commerciaux as (
  select agence, 'C-' || agence || '-' || lpad(n::text, 2, '0') as code, entree, n = 1 as responsable
  from effectifs, generate_series(1, commerciaux) as n
),
techniciens as (
  select agence, 'T-' || agence || '-' || lpad(n::text, 2, '0') as code, entree
  from effectifs, generate_series(1, techniciens) as n
),
ins_c as (
  insert into buta.dim_commercial (code, agence, entree, responsable)
  select code, agence, entree, responsable from commerciaux
  on conflict (code) do update set agence = excluded.agence, entree = excluded.entree, responsable = excluded.responsable
  returning 1
)
insert into buta.dim_technicien (code, agence, entree)
select code, agence, entree from techniciens
on conflict (code) do update set agence = excluded.agence, entree = excluded.entree;

insert into buta.dim_canal (code, libelle, cout_modele, mention_legale) values
  ('site_web', 'Site web', 'forfait 4 500 € par mois et par agence', null),
  ('appels_entrants', 'Appels entrants', 'aucun coût direct', null),
  ('parrainage', 'Parrainage', '300 € par vente', null),
  ('partenaires', 'Partenaires (artisans, courtiers)', '8 % du chiffre d''affaires apporté', null),
  ('terrain', 'Prospection terrain', 'forfait 12 000 € par mois et par agence', null),
  ('salons', 'Salons', '6 000 € les mois de salon', null),
  ('leads_achetes', 'Leads achetés (plateformes)', '65 € par lead', null),
  ('base_clients', 'Base clients', 'aucun coût direct', 'Toute réutilisation d''une base clients suppose une base légale et une information des personnes.')
on conflict (code) do update set libelle = excluded.libelle, cout_modele = excluded.cout_modele, mention_legale = excluded.mention_legale;

insert into buta.dim_produit (code, libelle, famille, prix_catalogue, taux_pose, taux_marge_cible, duree_pose_jt, aide_moyenne, part_mix_base, profil_saison) values
  ('PV3', 'Photovoltaïque 3 kWc', 'photovoltaique', 7900, 0.12, 0.30, 2.0, 0, 0.18, 'photovoltaique'),
  ('PV6', 'Photovoltaïque 6 kWc', 'photovoltaique', 12500, 0.12, 0.32, 3.0, 0, 0.14, 'photovoltaique'),
  ('PVB', 'Photovoltaïque avec batterie', 'photovoltaique', 16800, 0.12, 0.31, 3.5, 0, 0.08, 'photovoltaique'),
  ('PACAE', 'Pompe à chaleur air-eau', 'pompe a chaleur', 13900, 0.15, 0.28, 4.0, 4000, 0.22, 'chauffage'),
  ('PACAA', 'Pompe à chaleur air-air', 'pompe a chaleur', 6200, 0.14, 0.33, 2.0, 0, 0.12, 'chauffage'),
  ('CET', 'Chauffe-eau thermodynamique', 'eau chaude', 3400, 0.14, 0.35, 1.0, 900, 0.12, 'plat'),
  ('POELE', 'Poêle à granulés', 'bois', 5600, 0.13, 0.32, 1.5, 1800, 0.08, 'chauffage'),
  ('BORNE', 'Borne de recharge', 'mobilite', 1600, 0.15, 0.36, 0.5, 0, 0.06, 'plat')
on conflict (code) do update set
  libelle = excluded.libelle, famille = excluded.famille, prix_catalogue = excluded.prix_catalogue,
  taux_pose = excluded.taux_pose, taux_marge_cible = excluded.taux_marge_cible, duree_pose_jt = excluded.duree_pose_jt,
  aide_moyenne = excluded.aide_moyenne, part_mix_base = excluded.part_mix_base, profil_saison = excluded.profil_saison;

insert into buta.dim_statut (code, libelle, ordre) values
  ('lead', 'Lead', 1),
  ('rdv_planifie', 'RDV planifié', 2),
  ('rdv_tenu', 'RDV tenu', 3),
  ('devis', 'Devis émis', 4),
  ('signe', 'Signé', 5),
  ('pose', 'Posé', 6),
  ('encaisse', 'Encaissé', 7),
  ('sans_suite', 'Sans suite', 8),
  ('refus', 'Devis refusé', 9),
  ('annule', 'Annulé après signature', 10)
on conflict (code) do update set libelle = excluded.libelle, ordre = excluded.ordre;

insert into buta.dim_date (jour, mois, trimestre, annee, semaine_iso, jour_ouvre)
select
  d::date,
  date_trunc('month', d)::date,
  'T' || extract(quarter from d)::int || ' ' || extract(year from d)::int,
  extract(year from d)::int,
  extract(week from d)::int,
  extract(isodow from d) between 1 and 5
from generate_series(date '2025-01-01', date '2026-12-31', interval '1 day') as d
on conflict (jour) do nothing;
