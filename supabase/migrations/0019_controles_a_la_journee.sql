-- 0019 : les contrôles portent sur les dossiers visibles à la journée contrôlée (lot 4a).
-- Depuis la publication d'avance (0017), `publie` couvre des dossiers dont le lead est postérieur à la
-- journée affichée. Les contrôles, qui lisent fait_dossier (état final du dossier, indispensable au
-- contrôle 3), doivent s'arrêter à la même journée que les vues, sinon le nombre d'anomalies de Nord
-- « augmente » d'un jour à l'autre alors que l'histoire H4 les fait décroître.
-- Le jeton $jour de chaque requête est remplacé par la journée contrôlée (littéral de date) au moment
-- de l'exécution : le planificateur connaît la constante, et une requête lancée à la main sans
-- substitution échoue plutôt que de passer en silence.

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
  requete text;
begin
  for c in select * from buta.controle order by ordre loop
    requete := replace(c.requete, '$jour', quote_literal(p_jour::text) || '::date');
    execute 'select count(*) from (' || requete || ') t' into nb;
    execute 'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (' || requete || ' limit 10) t' into echantillon;
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
comment on function buta.executer_controles(date) is 'Exécute les douze contrôles (requêtes de buta.controle, jeton $jour remplacé par la journée contrôlée), écrit controle_resultat pour le jour et renvoie la synthèse (score, contrôles bloquants en KO).';

update buta.controle set requete = 'select id, date_lead from buta.fait_dossier where publie and date_lead <= $jour and agence is null' where code = 'C01';
update buta.controle set requete = 'select id, date_lead from buta.fait_dossier where publie and date_lead <= $jour and canal is null' where code = 'C02';
update buta.controle set requete = 'select id, agence, statut, date_signature, date_pose, date_encaissement from buta.fait_dossier
     where publie and date_lead <= $jour and (
       (date_pose is not null and date_signature is null)
       or (date_encaissement is not null and date_pose is null)
       or statut is null
       or (statut = ''pose'' and date_pose is null)
       or (statut = ''signe'' and date_signature is null)
       or (statut = ''encaisse'' and date_encaissement is null))' where code = 'C03';
update buta.controle set requete = 'select id, agence, date_lead, date_rdv, date_devis, date_signature, date_pose, date_encaissement from buta.fait_dossier
     where publie and date_lead <= $jour and (
       date_rdv_planifie < date_lead or date_rdv < date_lead or date_devis < date_rdv
       or date_signature < date_devis or date_pose < date_signature
       or date_encaissement < date_pose or date_annulation < date_signature)' where code = 'C04';
update buta.controle set requete = 'select a.id, b.id as doublon, a.agence, a.date_lead from buta.fait_dossier a
     join buta.fait_dossier b on b.empreinte_contact = a.empreinte_contact and b.produit = a.produit and b.id > a.id
       and abs(b.date_lead - a.date_lead) <= 30
     where a.publie and b.publie and a.date_lead <= $jour and b.date_lead <= $jour' where code = 'C05';
update buta.controle set requete = 'select d.id, d.agence, d.produit, d.montant_ht, p.prix_catalogue from buta.fait_dossier d
     join buta.dim_produit p on p.code = d.produit
     where d.publie and d.date_lead <= $jour and d.montant_ht is not null
       and (d.montant_ht < p.prix_catalogue * 0.6 or d.montant_ht > p.prix_catalogue * 1.4)' where code = 'C06';
update buta.controle set requete = 'select id, agence, taux_remise from buta.fait_dossier where publie and date_lead <= $jour and taux_remise > 0.20' where code = 'C07';
update buta.controle set requete = 'select id, agence, produit, montant_ht, cout_materiel, cout_pose from buta.fait_dossier
     where publie and date_lead <= $jour and montant_ht is not null and montant_ht - cout_materiel - cout_pose < 0' where code = 'C08';
update buta.controle set requete = 'select id, agence, date_lead, produit_libelle_source from buta.fait_dossier
     where publie and date_lead <= $jour and produit_libelle_source is not null
       and produit_libelle_source not in (select libelle from buta.dim_produit)' where code = 'C09';
update buta.controle set requete = 'select distinct date_trunc(''month'', d.date_lead)::date as mois, d.agence from buta.fait_dossier d
     where d.publie and d.date_lead <= $jour and d.agence is not null
       and not exists (select 1 from buta.objectif o where o.mois = date_trunc(''month'', d.date_lead)::date and o.agence = d.agence)' where code = 'C10';
update buta.controle set requete = 'select agence, mois, leads, rdv, devis, signatures, poses from (
       select agence, date_trunc(''month'', date_lead)::date as mois,
         count(*) as leads, count(date_rdv) as rdv, count(date_devis) as devis,
         count(date_signature) as signatures, count(date_pose) as poses
       from buta.fait_dossier where publie and date_lead <= $jour group by 1, 2) t
     where not (leads >= rdv and rdv >= devis and devis >= signatures and signatures >= poses)' where code = 'C12';

-- Résultat du jour recalculé avec le bon périmètre (le résultat de la veille, avant publication d'avance, était déjà juste).
select buta.executer_controles(buta.journee_publiee());
