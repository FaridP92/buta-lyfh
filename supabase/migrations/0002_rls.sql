-- 0002 : RLS sur toutes les tables, lecture publique sur les tables autorisees,
-- aucune politique d'ecriture (role service uniquement), role analyste_ro.
-- DONNEES.md §4.8.

grant usage on schema buta to anon, authenticated;

-- RLS activee partout
alter table buta.dim_departement enable row level security;
alter table buta.dim_commune enable row level security;
alter table buta.dim_agence enable row level security;
alter table buta.dim_agence_territoire enable row level security;
alter table buta.dim_commercial enable row level security;
alter table buta.dim_technicien enable row level security;
alter table buta.dim_canal enable row level security;
alter table buta.dim_produit enable row level security;
alter table buta.dim_statut enable row level security;
alter table buta.dim_date enable row level security;
alter table buta.fait_dossier enable row level security;
alter table buta.fait_cout_canal enable row level security;
alter table buta.charge_agence enable row level security;
alter table buta.objectif enable row level security;
alter table buta.plan_action enable row level security;
alter table buta.revue_hebdo enable row level security;
alter table buta.marche_commune enable row level security;
alter table buta.marche_departement enable row level security;
alter table buta.rge_installateur enable row level security;
alter table buta.source_fraicheur enable row level security;
alter table buta.controle enable row level security;
alter table buta.controle_resultat enable row level security;
alter table buta.automatisation_run enable row level security;
alter table buta.ia_usage enable row level security;
alter table buta.analyste_question enable row level security;
alter table buta.visite enable row level security;

-- Lecture publique : dimensions, marche, exploitation visible, objectifs, charges.
-- fait_dossier, fait_cout_canal, analyste_question, ia_usage, visite : aucune politique,
-- aucun grant select ; seules les vues mart_ agregees les exposent.
create policy lecture_publique on buta.dim_departement for select to anon, authenticated using (true);
create policy lecture_publique on buta.dim_commune for select to anon, authenticated using (true);
create policy lecture_publique on buta.dim_agence for select to anon, authenticated using (true);
create policy lecture_publique on buta.dim_agence_territoire for select to anon, authenticated using (true);
create policy lecture_publique on buta.dim_commercial for select to anon, authenticated using (true);
create policy lecture_publique on buta.dim_technicien for select to anon, authenticated using (true);
create policy lecture_publique on buta.dim_canal for select to anon, authenticated using (true);
create policy lecture_publique on buta.dim_produit for select to anon, authenticated using (true);
create policy lecture_publique on buta.dim_statut for select to anon, authenticated using (true);
create policy lecture_publique on buta.dim_date for select to anon, authenticated using (true);
create policy lecture_publique on buta.charge_agence for select to anon, authenticated using (true);
create policy lecture_publique on buta.objectif for select to anon, authenticated using (true);
create policy lecture_publique on buta.plan_action for select to anon, authenticated using (true);
create policy lecture_publique on buta.revue_hebdo for select to anon, authenticated using (true);
create policy lecture_publique on buta.marche_commune for select to anon, authenticated using (true);
create policy lecture_publique on buta.marche_departement for select to anon, authenticated using (true);
create policy lecture_publique on buta.rge_installateur for select to anon, authenticated using (true);
create policy lecture_publique on buta.source_fraicheur for select to anon, authenticated using (true);
create policy lecture_publique on buta.controle for select to anon, authenticated using (true);
create policy lecture_publique on buta.controle_resultat for select to anon, authenticated using (true);
create policy lecture_publique on buta.automatisation_run for select to anon, authenticated using (true);

grant select on
  buta.dim_departement, buta.dim_commune, buta.dim_agence, buta.dim_agence_territoire,
  buta.dim_commercial, buta.dim_technicien, buta.dim_canal, buta.dim_produit, buta.dim_statut,
  buta.dim_date, buta.charge_agence, buta.objectif, buta.plan_action, buta.revue_hebdo,
  buta.marche_commune, buta.marche_departement, buta.rge_installateur, buta.source_fraicheur,
  buta.controle, buta.controle_resultat, buta.automatisation_run
to anon, authenticated;

-- Role de l'analyste : lecture seule, limite aux vues (grants poses avec les vues, 0003),
-- timeout et memoire fixes par alter role car le pooler en mode transaction ignore les SET de session.
-- Le mot de passe est pose hors migration (secret), au lot 4b.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'analyste_ro') then
    create role analyste_ro login;
  end if;
end
$$;
grant usage on schema buta to analyste_ro;
alter role analyste_ro set statement_timeout = '5s';
alter role analyste_ro set work_mem = '16MB';
alter role analyste_ro set search_path = buta;
