-- 0001 : schema buta, dimensions, faits d'activite (simules), marche (reel), exploitation.
-- DONNEES.md §4.1 a §4.4. Identifiants en francais sans accents.

create schema if not exists buta;
comment on schema buta is 'Buta.Lyfh : cockpit de pilotage d''un réseau d''installateurs simulé, calé sur le marché réel. Données d''activité simulées, données de marché publiques.';

-- ---------------------------------------------------------------------------
-- 4.1 Dimensions
-- ---------------------------------------------------------------------------

create table buta.dim_departement (
  code text primary key,
  nom text not null,
  region text not null
);
comment on table buta.dim_departement is 'Départements de France métropolitaine (code Insee, nom, région).';

create table buta.dim_commune (
  code_insee text primary key,
  nom text not null,
  departement text not null references buta.dim_departement(code),
  latitude double precision,
  longitude double precision
);
comment on table buta.dim_commune is 'Communes des onze départements du périmètre simulé, avec le centre géographique (geo.api.gouv.fr).';
create index dim_commune_departement_idx on buta.dim_commune(departement);

create table buta.dim_agence (
  code text primary key,
  nom_bassin text not null,
  departement text not null references buta.dim_departement(code),
  latitude double precision not null,
  longitude double precision not null,
  ouverture date not null,
  poses_par_technicien_semaine numeric not null default 5
);
comment on table buta.dim_agence is 'Agences simulées, nommées par bassin géographique et positionnées au centre de leur bassin. Aucune agence réelle.';
comment on column buta.dim_agence.ouverture is 'Ouverture simulée ; pour Nord, date d''intégration (historique repris depuis janvier 2025).';

create table buta.dim_agence_territoire (
  agence text not null references buta.dim_agence(code),
  departement text not null references buta.dim_departement(code),
  part numeric not null check (part > 0 and part <= 1),
  primary key (agence, departement)
);
comment on table buta.dim_agence_territoire is 'Part du territoire d''un département couverte par une agence simulée (somme par département inférieure ou égale à 1).';

create table buta.dim_commercial (
  code text primary key,
  agence text not null references buta.dim_agence(code),
  entree date not null,
  sortie date,
  responsable boolean not null default false
);
comment on table buta.dim_commercial is 'Commerciaux simulés, identifiés par un code (jamais un nom). Le responsable d''agence est un commercial porteur du drapeau.';

create table buta.dim_technicien (
  code text primary key,
  agence text not null references buta.dim_agence(code),
  entree date not null,
  sortie date
);
comment on table buta.dim_technicien is 'Techniciens de pose simulés, identifiés par un code.';

create table buta.dim_canal (
  code text primary key,
  libelle text not null,
  cout_modele text not null,
  mention_legale text
);
comment on table buta.dim_canal is 'Canaux d''acquisition simulés et leur modèle de coût (DONNEES.md §3.3).';

create table buta.dim_produit (
  code text primary key,
  libelle text not null,
  famille text not null,
  prix_catalogue numeric not null,
  taux_pose numeric not null,
  taux_marge_cible numeric not null,
  duree_pose_jt numeric not null,
  aide_moyenne numeric not null default 0,
  part_mix_base numeric not null,
  profil_saison text not null check (profil_saison in ('photovoltaique', 'chauffage', 'plat'))
);
comment on table buta.dim_produit is 'Produits simulés : prix catalogue HT moyen, part du prix pour la pose, marge brute cible, durée de pose en jours-technicien, aide moyenne (mandat financier). Ordres de grandeur à vérifier, pas des tarifs constatés.';
comment on column buta.dim_produit.duree_pose_jt is 'Durée de pose en jours-technicien, utilisée pour le carnet de pose (CARNET).';
comment on column buta.dim_produit.part_mix_base is 'Part du produit dans le tirage des leads avant saisonnalité.';

create table buta.dim_statut (
  code text primary key,
  libelle text not null,
  ordre integer not null
);
comment on table buta.dim_statut is 'Statuts d''un dossier, dans l''ordre du parcours (lead, RDV planifié, RDV tenu, devis, signé, posé, encaissé) et les sorties (sans suite, refus, annulé).';

create table buta.dim_date (
  jour date primary key,
  mois date not null,
  trimestre text not null,
  annee integer not null,
  semaine_iso integer not null,
  jour_ouvre boolean not null
);
comment on table buta.dim_date is 'Calendrier du 1er janvier 2025 au 31 décembre 2026. jour_ouvre : lundi à vendredi (jours fériés non retranchés).';

-- ---------------------------------------------------------------------------
-- 4.2 Faits d'activite (simules)
-- ---------------------------------------------------------------------------

create table buta.fait_dossier (
  id bigint generated always as identity primary key,
  agence text references buta.dim_agence(code),
  commercial text references buta.dim_commercial(code),
  canal text references buta.dim_canal(code),
  produit text not null references buta.dim_produit(code),
  produit_libelle_source text,
  commune text references buta.dim_commune(code_insee),
  departement text not null references buta.dim_departement(code),
  empreinte_contact text not null,
  date_lead date not null,
  date_rdv_planifie date,
  date_rdv date,
  date_devis date,
  montant_devis numeric,
  date_signature date,
  date_pose date,
  date_encaissement date,
  date_annulation date,
  motif_annulation text,
  statut text references buta.dim_statut(code),
  prix_catalogue numeric not null,
  taux_remise numeric not null default 0,
  montant_ht numeric,
  cout_materiel numeric,
  cout_pose numeric,
  commission numeric,
  aide_montant numeric not null default 0,
  aide_versee_le date,
  technicien text references buta.dim_technicien(code),
  publie boolean not null default false,
  lot_generation text not null
);
comment on table buta.fait_dossier is 'Dossiers simulés du lead à l''encaissement. Jamais exposés ligne à ligne : seules les vues mart_ agrégées le sont.';
comment on column buta.fait_dossier.produit_libelle_source is 'Libellé produit tel que reçu du système source simulé ; divergent du référentiel pendant l''intégration de l''agence Nord (H4).';
comment on column buta.fait_dossier.empreinte_contact is 'Empreinte simulée du contact, pour le contrôle des doublons.';
comment on column buta.fait_dossier.taux_remise is 'Taux de remise accordé, entre 0 et 1.';
comment on column buta.fait_dossier.montant_ht is 'Montant HT net de remise du devis signé.';
comment on column buta.fait_dossier.aide_montant is 'Aide simulée portée en mandat financier : l''installateur avance l''aide et la porte en créance.';
comment on column buta.fait_dossier.publie is 'Vrai quand la journée du lead a été publiée par buta.publier_journee.';
create index fait_dossier_agence_date_lead_idx on buta.fait_dossier(agence, date_lead);
create index fait_dossier_statut_idx on buta.fait_dossier(statut);
create index fait_dossier_publie_idx on buta.fait_dossier(publie);
create index fait_dossier_date_signature_idx on buta.fait_dossier(date_signature);
create index fait_dossier_date_pose_idx on buta.fait_dossier(date_pose);
create index fait_dossier_canal_idx on buta.fait_dossier(canal);

create table buta.fait_cout_canal (
  mois date not null,
  agence text not null references buta.dim_agence(code),
  canal text not null references buta.dim_canal(code),
  montant numeric not null,
  primary key (mois, agence, canal)
);
comment on table buta.fait_cout_canal is 'Coûts d''acquisition simulés par mois, agence et canal (hors commissions commerciales).';

create table buta.charge_agence (
  mois date not null,
  agence text not null references buta.dim_agence(code),
  salaires_commerciaux numeric not null,
  salaires_techniciens numeric not null,
  structure numeric not null,
  vehicules numeric not null,
  primary key (mois, agence)
);
comment on table buta.charge_agence is 'Charges d''agence simulées par mois : masse salariale hors commissions, structure et local, véhicules. Ordres de grandeur chargés, à vérifier.';

create table buta.objectif (
  mois date not null,
  agence text not null references buta.dim_agence(code),
  produit text not null references buta.dim_produit(code),
  ventes numeric not null,
  prix_catalogue_cible numeric not null,
  taux_remise_cible numeric not null,
  primary key (mois, agence, produit)
);
comment on table buta.objectif is 'Objectifs simulés au grain mois, agence, produit : ventes, prix catalogue cible, taux de remise cible (base de la comparaison « objectif » et de la décomposition d''écart).';

create table buta.plan_action (
  id bigint generated always as identity primary key,
  agence text references buta.dim_agence(code),
  levier text not null,
  proprietaire_code text not null,
  gain_attendu numeric not null,
  statut text not null,
  echeance date not null,
  avancement numeric not null default 0 check (avancement >= 0 and avancement <= 100),
  indicateur_code text not null
);
comment on table buta.plan_action is 'Plans d''action simulés, cohérents avec les sept histoires ; propriétaire désigné par un code.';

create table buta.revue_hebdo (
  semaine date primary key,
  faits jsonb not null,
  texte text,
  modele text,
  cout numeric,
  publie_le timestamptz
);
comment on table buta.revue_hebdo is 'Revue hebdomadaire : faits calculés en SQL (jsonb) et texte rédigé par le modèle (WF3).';

-- ---------------------------------------------------------------------------
-- 4.3 Marche (reel)
-- ---------------------------------------------------------------------------

create table buta.marche_commune (
  code_insee text primary key,
  departement text not null,
  rp integer,
  maisons integer,
  proprietaires integer,
  fioul integer,
  gaz_citerne integer,
  gaz_ville integer,
  electricite integer,
  maisons_fg integer,
  maisons_diag integer,
  maisons_fioul_dpe integer,
  maisons_gpl_dpe integer,
  solaire_nb integer,
  solaire_kw numeric,
  solaire_nb_36 integer,
  rge_pac integer,
  rge_pv integer,
  rge_cet integer,
  date_reference jsonb not null default '{}'::jsonb
);
comment on table buta.marche_commune is 'Marché réel à la commune (onze départements) : Insee Logement 2022, ADEME DPE, RTE registre solaire, ADEME RGE. Licence Ouverte 2.0.';
comment on column buta.marche_commune.rp is 'Résidences principales (Insee P22_RP).';
comment on column buta.marche_commune.maisons is 'Résidences principales en maison (Insee P22_RPMAISON).';
comment on column buta.marche_commune.proprietaires is 'Résidences principales occupées par leur propriétaire (Insee P22_RP_PROP).';
comment on column buta.marche_commune.fioul is 'Résidences principales chauffées au fioul (Insee P22_RP_CFIOUL).';
comment on column buta.marche_commune.gaz_citerne is 'Résidences principales chauffées au gaz en bouteilles ou citerne (Insee P22_RP_CGAZB).';
comment on column buta.marche_commune.gaz_ville is 'Résidences principales chauffées au gaz de ville (Insee P22_RP_CGAZV).';
comment on column buta.marche_commune.electricite is 'Résidences principales chauffées à l''électricité (Insee P22_RP_CELEC).';
comment on column buta.marche_commune.maisons_fg is 'Maisons diagnostiquées en étiquette F ou G (ADEME DPE logements existants).';
comment on column buta.marche_commune.maisons_diag is 'Maisons diagnostiquées, toutes étiquettes (ADEME DPE).';
comment on column buta.marche_commune.solaire_nb is 'Installations solaires raccordées (RTE, filière SOLAI).';
comment on column buta.marche_commune.solaire_kw is 'Puissance solaire installée en kW (RTE).';
comment on column buta.marche_commune.solaire_nb_36 is 'Installations solaires de 36 kW ou moins (RTE), quand la puissance le permet.';
comment on column buta.marche_commune.rge_pac is 'Qualifications RGE pompe à chaleur en cours de validité (ADEME).';
comment on column buta.marche_commune.rge_pv is 'Qualifications RGE photovoltaïque en cours de validité (ADEME).';
comment on column buta.marche_commune.rge_cet is 'Qualifications RGE chauffe-eau thermodynamique en cours de validité (ADEME).';
create index marche_commune_departement_idx on buta.marche_commune(departement);

create table buta.marche_departement (
  code text primary key references buta.dim_departement(code),
  rp integer,
  maisons integer,
  proprietaires integer,
  fioul integer,
  gaz_citerne integer,
  gaz_ville integer,
  electricite integer,
  maisons_fg integer,
  maisons_diag integer,
  maisons_fioul_dpe integer,
  maisons_gpl_dpe integer,
  solaire_nb integer,
  solaire_kw numeric,
  solaire_nb_36 integer,
  rge_pac integer,
  rge_pv integer,
  rge_cet integer,
  c_volume numeric,
  c_intensite_fioul numeric,
  c_intensite_fg numeric,
  c_frein numeric,
  c_saturation numeric,
  indice numeric,
  date_reference jsonb not null default '{}'::jsonb
);
comment on table buta.marche_departement is 'Marché réel par département (France métropolitaine) : mêmes colonnes que marche_commune, plus les composantes en rang centile et l''indice de potentiel (INDICATEURS.md INDICE). Ce n''est pas une recommandation d''implantation.';
comment on column buta.marche_departement.c_volume is 'Rang centile (0 à 100) des propriétaires occupants.';
comment on column buta.marche_departement.c_intensite_fioul is 'Rang centile de la part des résidences principales au fioul ou au gaz citerne.';
comment on column buta.marche_departement.c_intensite_fg is 'Rang centile de la part des maisons F ou G parmi les maisons diagnostiquées.';
comment on column buta.marche_departement.c_frein is 'Rang centile des installateurs RGE PAC ou PV pour 10 000 maisons (concurrence).';
comment on column buta.marche_departement.c_saturation is 'Rang centile des installations solaires pour 1 000 maisons.';
comment on column buta.marche_departement.indice is 'Indice de potentiel = (0,4 volume + 0,3 intensité fioul et citerne + 0,3 intensité F ou G) × (1 - 0,3 frein/100) × (1 - 0,3 saturation/100).';

create table buta.rge_installateur (
  siret text primary key,
  nom text not null,
  commune text,
  code_insee text,
  latitude double precision,
  longitude double precision,
  domaines text[] not null default '{}',
  departement text not null
);
comment on table buta.rge_installateur is 'Installateurs RGE géolocalisés des onze départements (ADEME), affichés en points fins sans mise en avant d''aucun nom.';
create index rge_installateur_departement_idx on buta.rge_installateur(departement);

create table buta.source_fraicheur (
  source text primary key,
  date_reference date,
  ingere_le timestamptz not null default now(),
  prochaine date
);
comment on table buta.source_fraicheur is 'Fraîcheur de chaque source : date de référence, date d''ingestion, prochaine mise à jour. La ligne journee_simulee porte la dernière journée publiée.';

-- ---------------------------------------------------------------------------
-- 4.4 Exploitation
-- ---------------------------------------------------------------------------

create table buta.controle (
  code text primary key,
  libelle text not null,
  regle text not null,
  bloquant boolean not null default false,
  requete text not null,
  ordre integer not null
);
comment on table buta.controle is 'Les douze contrôles de cohérence (DONNEES.md §4.6). requete : SQL exécuté par buta.executer_controles, qui renvoie les lignes en anomalie.';

create table buta.controle_resultat (
  jour date not null,
  controle text not null references buta.controle(code),
  statut text not null check (statut in ('ok', 'alerte', 'ko')),
  nb_lignes integer not null default 0,
  echantillon jsonb not null default '[]'::jsonb,
  primary key (jour, controle)
);
comment on table buta.controle_resultat is 'Résultat quotidien de chaque contrôle : statut, nombre de lignes concernées, échantillon.';

create table buta.automatisation_run (
  id bigint generated always as identity primary key,
  workflow text not null,
  debute_le timestamptz not null default now(),
  fini_le timestamptz,
  statut text not null,
  message text,
  lignes integer
);
comment on table buta.automatisation_run is 'Journal des exécutions n8n : workflow, début, fin, statut, message, lignes traitées.';

create table buta.ia_usage (
  jour date not null,
  fonction text not null,
  appels integer not null default 0,
  tokens_entree bigint not null default 0,
  tokens_sortie bigint not null default 0,
  cout_eur numeric not null default 0,
  primary key (jour, fonction)
);
comment on table buta.ia_usage is 'Consommation quotidienne des fonctions IA (appels, tokens, coût en euros).';

create table buta.analyste_question (
  id bigint generated always as identity primary key,
  pose_le timestamptz not null default now(),
  empreinte text not null,
  question text not null,
  sql text,
  statut text not null,
  cout_eur numeric,
  duree_ms integer
);
comment on table buta.analyste_question is 'Journal des questions posées à l''analyste (empreinte hachée, question, requête générée, statut, coût, durée).';

create table buta.visite (
  jour date not null,
  route text not null,
  famille_navigateur text not null,
  nb integer not null default 0,
  primary key (jour, route, famille_navigateur)
);
comment on table buta.visite is 'Journal des visites anonymisé (palier C) : jour, route, famille de navigateur, nombre.';
