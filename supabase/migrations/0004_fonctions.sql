-- 0004 : fonctions et RPC appelees par n8n avec la cle service (DONNEES.md §4.7).
-- Les fonctions qui ecrivent sont retirees de public, anon et authenticated : seul service_role
-- (et postgres) peut les appeler par PostgREST.

create or replace function buta.publier_journee(p_jour date)
returns integer
language plpgsql
security definer
set search_path = buta, public
as $$
declare
  n integer;
begin
  update buta.fait_dossier set publie = true where date_lead <= p_jour and not publie;
  get diagnostics n = row_count;
  insert into buta.source_fraicheur (source, date_reference, ingere_le, prochaine)
  values ('journee_simulee', p_jour, now(), p_jour + 1)
  on conflict (source) do update set
    date_reference = greatest(buta.source_fraicheur.date_reference, excluded.date_reference),
    ingere_le = now(),
    prochaine = greatest(buta.source_fraicheur.date_reference, excluded.date_reference) + 1;
  return n;
end;
$$;
comment on function buta.publier_journee(date) is 'Publie les dossiers dont le lead date au plus de ce jour (idempotent : zéro ligne si déjà publié) et met à jour la fraîcheur journee_simulee, sans jamais reculer.';

create or replace function buta.executer_controles(p_jour date default buta.journee_publiee())
returns jsonb
language plpgsql
security definer
set search_path = buta, public
as $$
declare
  c record;
  nb integer;
  echantillon jsonb;
  statut text;
  synthese jsonb := '[]'::jsonb;
  poids_ok numeric := 0;
  poids_total numeric := 0;
begin
  for c in select * from buta.controle order by ordre loop
    execute 'select count(*) from (' || c.requete || ') t' into nb;
    execute 'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (' || c.requete || ' limit 10) t' into echantillon;
    statut := case when nb = 0 then 'ok' when c.bloquant then 'ko' else 'alerte' end;
    insert into buta.controle_resultat (jour, controle, statut, nb_lignes, echantillon)
    values (p_jour, c.code, statut, nb, echantillon)
    on conflict (jour, controle) do update set statut = excluded.statut, nb_lignes = excluded.nb_lignes, echantillon = excluded.echantillon;
    poids_total := poids_total + case when c.bloquant then 3 else 1 end;
    if nb = 0 then poids_ok := poids_ok + case when c.bloquant then 3 else 1 end; end if;
    synthese := synthese || jsonb_build_object('controle', c.code, 'libelle', c.libelle, 'statut', statut, 'nb_lignes', nb, 'bloquant', c.bloquant);
  end loop;
  return jsonb_build_object(
    'jour', p_jour,
    'score', round(100 * poids_ok / poids_total),
    'bloquant_ko', exists (select 1 from jsonb_array_elements(synthese) e where e->>'statut' = 'ko'),
    'controles', synthese);
end;
$$;
comment on function buta.executer_controles(date) is 'Exécute les douze contrôles (requêtes de buta.controle), écrit controle_resultat pour le jour et renvoie la synthèse (score, contrôles bloquants en KO).';

create or replace function buta.faits_revue_hebdo(p_semaine date)
returns jsonb
language sql
stable
security definer
set search_path = buta, public
as $$
  with s as (select date_trunc('week', p_semaine)::date as debut, date_trunc('week', p_semaine)::date + 6 as fin),
  d as (select * from buta.dossier_a_date),
  reseau as (
    select
      count(*) filter (where date_lead between s.debut and s.fin) as leads,
      count(*) filter (where date_rdv between s.debut and s.fin) as rdv_tenus,
      count(*) filter (where date_signature between s.debut and s.fin and date_annulation is null) as signatures,
      coalesce(sum(montant_ht) filter (where date_signature between s.debut and s.fin and date_annulation is null), 0) as ca_signe,
      count(*) filter (where date_pose between s.debut and s.fin) as poses,
      coalesce(sum(montant_ht) filter (where date_encaissement between s.debut and s.fin), 0) as encaisse,
      count(*) filter (where date_lead between s.debut - 7 and s.fin - 7) as leads_semaine_precedente,
      count(*) filter (where date_signature between s.debut - 7 and s.fin - 7 and date_annulation is null) as signatures_semaine_precedente,
      coalesce(sum(montant_ht) filter (where date_signature between s.debut - 7 and s.fin - 7 and date_annulation is null), 0) as ca_signe_semaine_precedente
    from d, s
  ),
  agences as (
    select d.agence, a.nom_bassin,
      count(*) filter (where date_lead between s.debut and s.fin) as leads,
      count(*) filter (where date_signature between s.debut and s.fin and date_annulation is null) as signatures,
      coalesce(sum(montant_ht) filter (where date_signature between s.debut and s.fin and date_annulation is null), 0) as ca_signe,
      count(*) filter (where date_pose between s.debut and s.fin) as poses
    from d join buta.dim_agence a on a.code = d.agence, s
    group by d.agence, a.nom_bassin
  )
  select jsonb_build_object(
    'semaine', (select debut from s),
    'reseau', (select to_jsonb(r) from reseau r),
    'agences', (select jsonb_agg(to_jsonb(a) order by a.agence) from agences a),
    'ecarts_mois', (select coalesce(jsonb_agg(to_jsonb(e) order by e.agence), '[]'::jsonb) from buta.mart_ecarts e, s
      where e.mois = date_trunc('month', s.debut)::date and e.comparaison = 'objectif'),
    'alertes', (select coalesce(jsonb_agg(to_jsonb(al)), '[]'::jsonb) from buta.mart_alertes al),
    'mention', 'donnees d''activite simulees');
$$;
comment on function buta.faits_revue_hebdo(date) is 'Faits calculés en SQL pour la revue hebdomadaire de la semaine donnée (réseau, agences, écarts du mois, alertes) ; le modèle rédige, il ne calcule rien.';

create or replace function buta.publier_revue(p_semaine date, p_texte text, p_modele text, p_cout numeric)
returns date
language plpgsql
security definer
set search_path = buta, public
as $$
declare
  semaine date := date_trunc('week', p_semaine)::date;
begin
  insert into buta.revue_hebdo (semaine, faits, texte, modele, cout, publie_le)
  values (semaine, buta.faits_revue_hebdo(semaine), p_texte, p_modele, p_cout, now())
  on conflict (semaine) do update set texte = excluded.texte, modele = excluded.modele, cout = excluded.cout, publie_le = now();
  return semaine;
end;
$$;
comment on function buta.publier_revue(date, text, text, numeric) is 'Enregistre la revue hebdomadaire rédigée (texte, modèle, coût) avec les faits recalculés.';

create or replace function buta.journal_run(p_workflow text, p_statut text, p_message text default null, p_lignes integer default null, p_debute_le timestamptz default now())
returns bigint
language plpgsql
security definer
set search_path = buta, public
as $$
declare
  nouvel_id bigint;
begin
  insert into buta.automatisation_run (workflow, debute_le, fini_le, statut, message, lignes)
  values (p_workflow, p_debute_le, now(), p_statut, p_message, p_lignes)
  returning id into nouvel_id;
  return nouvel_id;
end;
$$;
comment on function buta.journal_run(text, text, text, integer, timestamptz) is 'Journalise une exécution n8n (workflow, statut, message, lignes, début).';

create or replace function buta.recalculer_indices()
returns integer
language plpgsql
security definer
set search_path = buta, public
as $$
declare
  n integer;
begin
  with c as (
    select code,
      100.0 * percent_rank() over (order by proprietaires) as c_volume,
      100.0 * percent_rank() over (order by (fioul + gaz_citerne)::numeric / nullif(rp, 0)) as c_intensite_fioul,
      100.0 * percent_rank() over (order by maisons_fg::numeric / nullif(maisons_diag, 0)) as c_intensite_fg,
      100.0 * percent_rank() over (order by 10000.0 * (rge_pac + rge_pv) / nullif(maisons, 0)) as c_frein,
      100.0 * percent_rank() over (order by 1000.0 * solaire_nb / nullif(maisons, 0)) as c_saturation
    from buta.marche_departement
  )
  update buta.marche_departement m set
    c_volume = round(c.c_volume, 1), c_intensite_fioul = round(c.c_intensite_fioul, 1), c_intensite_fg = round(c.c_intensite_fg, 1),
    c_frein = round(c.c_frein, 1), c_saturation = round(c.c_saturation, 1),
    indice = round((0.4 * c.c_volume + 0.3 * c.c_intensite_fioul + 0.3 * c.c_intensite_fg) * (1 - 0.3 * c.c_frein / 100) * (1 - 0.3 * c.c_saturation / 100), 1)
  from c where c.code = m.code;
  get diagnostics n = row_count;
  return n;
end;
$$;
comment on function buta.recalculer_indices() is 'Recalcule les rangs centiles et l''indice de potentiel de tous les départements (INDICATEURS.md INDICE).';

create or replace function buta.upsert_marche_departement(p_lignes jsonb)
returns integer
language plpgsql
security definer
set search_path = buta, public
as $$
declare
  n integer;
begin
  insert into buta.marche_departement (code, rp, maisons, proprietaires, fioul, gaz_citerne, gaz_ville, electricite,
    maisons_fg, maisons_diag, maisons_fioul_dpe, maisons_gpl_dpe, solaire_nb, solaire_kw, solaire_nb_36, rge_pac, rge_pv, rge_cet, date_reference)
  select r.code, r.rp, r.maisons, r.proprietaires, r.fioul, r.gaz_citerne, r.gaz_ville, r.electricite,
    r.maisons_fg, r.maisons_diag, r.maisons_fioul_dpe, r.maisons_gpl_dpe, r.solaire_nb, r.solaire_kw, r.solaire_nb_36, r.rge_pac, r.rge_pv, r.rge_cet,
    coalesce(r.date_reference, '{}'::jsonb)
  from jsonb_to_recordset(p_lignes) as r(code text, rp integer, maisons integer, proprietaires integer, fioul integer, gaz_citerne integer,
    gaz_ville integer, electricite integer, maisons_fg integer, maisons_diag integer, maisons_fioul_dpe integer, maisons_gpl_dpe integer,
    solaire_nb integer, solaire_kw numeric, solaire_nb_36 integer, rge_pac integer, rge_pv integer, rge_cet integer, date_reference jsonb)
  on conflict (code) do update set
    rp = coalesce(excluded.rp, buta.marche_departement.rp), maisons = coalesce(excluded.maisons, buta.marche_departement.maisons),
    proprietaires = coalesce(excluded.proprietaires, buta.marche_departement.proprietaires), fioul = coalesce(excluded.fioul, buta.marche_departement.fioul),
    gaz_citerne = coalesce(excluded.gaz_citerne, buta.marche_departement.gaz_citerne), gaz_ville = coalesce(excluded.gaz_ville, buta.marche_departement.gaz_ville),
    electricite = coalesce(excluded.electricite, buta.marche_departement.electricite), maisons_fg = coalesce(excluded.maisons_fg, buta.marche_departement.maisons_fg),
    maisons_diag = coalesce(excluded.maisons_diag, buta.marche_departement.maisons_diag), maisons_fioul_dpe = coalesce(excluded.maisons_fioul_dpe, buta.marche_departement.maisons_fioul_dpe),
    maisons_gpl_dpe = coalesce(excluded.maisons_gpl_dpe, buta.marche_departement.maisons_gpl_dpe), solaire_nb = coalesce(excluded.solaire_nb, buta.marche_departement.solaire_nb),
    solaire_kw = coalesce(excluded.solaire_kw, buta.marche_departement.solaire_kw), solaire_nb_36 = coalesce(excluded.solaire_nb_36, buta.marche_departement.solaire_nb_36),
    rge_pac = coalesce(excluded.rge_pac, buta.marche_departement.rge_pac), rge_pv = coalesce(excluded.rge_pv, buta.marche_departement.rge_pv),
    rge_cet = coalesce(excluded.rge_cet, buta.marche_departement.rge_cet),
    date_reference = buta.marche_departement.date_reference || excluded.date_reference;
  get diagnostics n = row_count;
  perform buta.recalculer_indices();
  return n;
end;
$$;
comment on function buta.upsert_marche_departement(jsonb) is 'Upsert des lignes de marché par département depuis un tableau JSON (WF4 mensuel : RGE, RTE, DPE) puis recalcul des centiles et de l''indice ; les colonnes absentes ou nulles conservent leur valeur.';

-- Droits : les fonctions d'ecriture ne sont pas appelables par anon ni authenticated.
revoke execute on function buta.publier_journee(date) from public, anon, authenticated;
revoke execute on function buta.executer_controles(date) from public, anon, authenticated;
revoke execute on function buta.faits_revue_hebdo(date) from public, anon, authenticated;
revoke execute on function buta.publier_revue(date, text, text, numeric) from public, anon, authenticated;
revoke execute on function buta.journal_run(text, text, text, integer, timestamptz) from public, anon, authenticated;
revoke execute on function buta.recalculer_indices() from public, anon, authenticated;
revoke execute on function buta.upsert_marche_departement(jsonb) from public, anon, authenticated;
revoke execute on function buta.rafraichir_marts() from public, anon, authenticated;
grant execute on function buta.publier_journee(date), buta.executer_controles(date), buta.faits_revue_hebdo(date),
  buta.publier_revue(date, text, text, numeric), buta.journal_run(text, text, text, integer, timestamptz),
  buta.recalculer_indices(), buta.upsert_marche_departement(jsonb), buta.rafraichir_marts()
to service_role;
grant execute on function buta.journee_publiee(), buta.phi(double precision) to anon, authenticated, analyste_ro;
