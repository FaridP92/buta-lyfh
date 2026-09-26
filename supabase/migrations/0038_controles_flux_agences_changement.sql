-- 0038 : flux d'anomalies, agences concernées et signal de changement dans les contrôles (26 septembre 2026).
-- Constat sur l'email de WF2 du 26 septembre (score 68/100, C03 45 lignes, C05 25, C09 83) : les contrôles comptent
-- un stock (tous les dossiers publiés depuis janvier 2025 jusqu'à la journée contrôlée). Un dossier du Nord sans
-- statut en juin reste en anomalie pour toujours, le score est figé à 68 depuis le 17 juin et WF2 envoyait chaque
-- matin le même email (huit envois identiques du 19 au 26 septembre), alors que H4 fait décroître le flux
-- (C09 : 42 lignes nées en juin, 23 en juillet, 16 en août, 2 en septembre).
-- 1. controle_resultat porte en plus le flux (lignes en anomalie dont le lead date des 30 jours précédant la journée
--    contrôlée) et la répartition par agence (jsonb, code d'agence vers nombre de lignes).
-- 2. executer_controles calcule les deux depuis les colonnes date_lead et agence renvoyées par chaque requête
--    (flux à null quand la requête ne renvoie pas date_lead : C10, C11, C12 ; agences vide quand elle ne renvoie pas
--    agence) et renvoie en plus `changement` (vrai si un contrôle a changé de statut ou de nombre de lignes depuis la
--    journée contrôlée précédente, ou s'il n'y en a aucune), `jour_precedent`, et par contrôle `nb_lignes_30j` et
--    `agences_texte` (« Nord 45 », assemblé ici pour que le nœud n8n ne calcule rien).
-- 3. mart_qualite expose nb_lignes_30j, agences et flux_30j_jour (somme du flux des douze contrôles du jour), vue
--    privée puis vue mince recréée (DONNEES.md §4.8 : le select * d'une vue mince est figé à sa création).
-- Le score ne change pas : il mesure toujours le stock, et l'écran Qualité montre désormais le flux à côté.

alter table buta.controle_resultat
  add column if not exists nb_lignes_30j integer,
  add column if not exists agences jsonb not null default '{}'::jsonb;
comment on column buta.controle_resultat.nb_lignes_30j is 'Lignes en anomalie dont le lead date des 30 jours précédant la journée contrôlée (flux) ; null quand le contrôle ne porte pas de date de lead.';
comment on column buta.controle_resultat.agences is 'Répartition des lignes en anomalie par code d''agence (objet JSON code vers nombre), vide quand le contrôle ne porte pas d''agence.';

create or replace function buta.executer_controles(p_jour date default buta.journee_publiee())
returns jsonb
language plpgsql
security definer
set search_path = buta, public
as $$
declare
  c record;
  nb integer;
  nb_30j integer;
  agences jsonb;
  agences_texte text;
  echantillon jsonb;
  statut text;
  synthese jsonb := '[]'::jsonb;
  poids_ok numeric := 0;
  poids_total numeric := 0;
  requete text;
  jour_precedent date;
  changement boolean;
begin
  for c in select * from buta.controle order by ordre loop
    requete := replace(c.requete, '$jour', quote_literal(p_jour::text) || '::date');
    execute 'with lignes as (select to_jsonb(t) as j from (' || requete || ') t)
      select count(*)::int,
        case when count(*) = 0 then 0
             when bool_or(j ? ''date_lead'') then (count(*) filter (where (j->>''date_lead'')::date > $1 - 30))::int
             else null end,
        (select coalesce(jsonb_object_agg(s.agence, s.n), ''{}''::jsonb)
           from (select j->>''agence'' as agence, count(*) as n from lignes where j->>''agence'' is not null group by 1) s),
        (select string_agg(coalesce(a.nom_bassin, s.agence) || '' '' || s.n, '', '' order by s.n desc, s.agence)
           from (select j->>''agence'' as agence, count(*) as n from lignes where j->>''agence'' is not null group by 1) s
           left join buta.dim_agence a on a.code = s.agence)
      from lignes'
      into nb, nb_30j, agences, agences_texte using p_jour;
    execute 'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (' || requete || ' limit 10) t' into echantillon;
    statut := case when nb = 0 then 'ok' when c.bloquant then 'ko' else 'alerte' end;
    insert into buta.controle_resultat (jour, controle, statut, nb_lignes, echantillon, nb_lignes_30j, agences)
    values (p_jour, c.code, statut, nb, echantillon, nb_30j, agences)
    on conflict (jour, controle) do update set statut = excluded.statut, nb_lignes = excluded.nb_lignes,
      echantillon = excluded.echantillon, nb_lignes_30j = excluded.nb_lignes_30j, agences = excluded.agences;
    poids_total := poids_total + case when c.bloquant then 3 else 1 end;
    if nb = 0 then poids_ok := poids_ok + case when c.bloquant then 3 else 1 end; end if;
    synthese := synthese || jsonb_build_object('controle', c.code, 'libelle', c.libelle, 'statut', statut, 'nb_lignes', nb,
      'bloquant', c.bloquant, 'nb_lignes_30j', nb_30j, 'agences_texte', agences_texte);
  end loop;

  select max(jour) into jour_precedent from buta.controle_resultat where jour < p_jour;
  if jour_precedent is null then
    changement := true;
  else
    select exists (
      select 1 from buta.controle_resultat n
      left join buta.controle_resultat v on v.controle = n.controle and v.jour = jour_precedent
      where n.jour = p_jour and (v.controle is null or v.statut <> n.statut or v.nb_lignes <> n.nb_lignes))
    into changement;
  end if;

  return jsonb_build_object(
    'jour', p_jour,
    'jour_precedent', jour_precedent,
    'score', round(100 * poids_ok / poids_total),
    'bloquant_ko', exists (select 1 from jsonb_array_elements(synthese) e where e->>'statut' = 'ko'),
    'changement', changement,
    'controles', synthese);
end;
$$;
comment on function buta.executer_controles(date) is 'Exécute les douze contrôles (requêtes de buta.controle, jeton $jour remplacé par la journée contrôlée), écrit controle_resultat pour le jour (statut, lignes, flux sur 30 jours, agences, échantillon) et renvoie la synthèse : score, contrôles bloquants en KO, changement depuis la journée contrôlée précédente.';

-- Vue privée : mêmes onze premières colonnes, trois colonnes ajoutées à la fin (create or replace l'exige).
create or replace view buta_prive.mart_qualite as
with resultats as (
  select r.jour, r.controle, c.ordre, c.libelle, c.regle, c.bloquant, r.statut, r.nb_lignes, r.echantillon,
    r.nb_lignes_30j, r.agences,
    case when c.bloquant then 3 else 1 end as poids
  from buta.controle_resultat r join buta.controle c on c.code = r.controle
),
scores as (
  select jour,
    round(100.0 * sum(poids) filter (where statut = 'ok') / sum(poids), 0) as score,
    sum(nb_lignes_30j)::int as flux_30j
  from resultats group by jour
)
select r.jour, r.controle, r.ordre, r.libelle, r.regle, r.bloquant, r.statut, r.nb_lignes, r.echantillon, s.score as score_jour,
  r.nb_lignes - lag(r.nb_lignes) over (partition by r.controle order by r.jour) as tendance,
  r.nb_lignes_30j, r.agences, s.flux_30j as flux_30j_jour
from resultats r join scores s on s.jour = r.jour;
comment on view buta_prive.mart_qualite is 'QUALITE : résultat quotidien des douze contrôles (statut ok, alerte, ko ; lignes concernées ; échantillon) et score du jour = 100 x somme pondérée des contrôles ok / somme des poids (3 pour un contrôle bloquant, 1 sinon). tendance : variation du nombre de lignes par rapport au jour précédent. nb_lignes_30j et flux_30j_jour : le flux (lignes en anomalie nées dans les 30 jours), là où nb_lignes et le score mesurent le stock. agences : répartition des lignes par code d''agence.';
comment on column buta_prive.mart_qualite.nb_lignes_30j is 'FLUX_QUALITE : lignes en anomalie dont le lead date des 30 jours précédant la journée contrôlée ; null pour un contrôle sans date de lead (C10, C11, C12).';
comment on column buta_prive.mart_qualite.agences is 'Répartition des lignes en anomalie par code d''agence (objet JSON code vers nombre) ; vide pour un contrôle sans agence.';
comment on column buta_prive.mart_qualite.flux_30j_jour is 'FLUX_QUALITE : somme de nb_lignes_30j sur les douze contrôles du jour, identique sur les douze lignes du jour.';

-- Vue mince recréée pour porter les trois colonnes ; droits et commentaires existants conservés par create or replace.
create or replace view buta.mart_qualite with (security_invoker = true) as select * from buta_prive.mart_qualite;
comment on view buta.mart_qualite is 'QUALITE : résultat quotidien des douze contrôles (statut ok, alerte, ko ; lignes concernées ; échantillon) et score du jour = 100 x somme pondérée des contrôles ok / somme des poids (3 pour un contrôle bloquant, 1 sinon). tendance : variation du nombre de lignes par rapport au jour précédent. nb_lignes_30j et flux_30j_jour : le flux (lignes en anomalie nées dans les 30 jours), là où nb_lignes et le score mesurent le stock. agences : répartition des lignes par code d''agence.';
comment on column buta.mart_qualite.nb_lignes_30j is 'FLUX_QUALITE : lignes en anomalie dont le lead date des 30 jours précédant la journée contrôlée ; null pour un contrôle sans date de lead (C10, C11, C12).';
comment on column buta.mart_qualite.agences is 'Répartition des lignes en anomalie par code d''agence (objet JSON code vers nombre) ; vide pour un contrôle sans agence.';
comment on column buta.mart_qualite.flux_30j_jour is 'FLUX_QUALITE : somme de nb_lignes_30j sur les douze contrôles du jour, identique sur les douze lignes du jour.';
grant select on buta.mart_qualite to anon, authenticated, analyste_ro;
grant select on buta_prive.mart_qualite to anon, authenticated, analyste_ro, service_role;

-- Les requêtes de C03, C06, C07 et C08 ne renvoyaient pas date_lead : le flux y restait null. Elles la portent
-- désormais (colonne ajoutée, périmètre inchangé) ; C10, C11 et C12 restent sans flux (grain mois ou source).
update buta.controle set requete = 'select id, agence, date_lead, statut, date_signature, date_pose, date_encaissement from buta.fait_dossier
     where publie and date_lead <= $jour and (
       (date_pose is not null and date_signature is null)
       or (date_encaissement is not null and date_pose is null)
       or statut is null
       or (statut = ''pose'' and date_pose is null)
       or (statut = ''signe'' and date_signature is null)
       or (statut = ''encaisse'' and date_encaissement is null))' where code = 'C03';
update buta.controle set requete = 'select d.id, d.agence, d.date_lead, d.produit, d.montant_ht, p.prix_catalogue from buta.fait_dossier d
     join buta.dim_produit p on p.code = d.produit
     where d.publie and d.date_lead <= $jour and d.montant_ht is not null
       and (d.montant_ht < p.prix_catalogue * 0.6 or d.montant_ht > p.prix_catalogue * 1.4)' where code = 'C06';
update buta.controle set requete = 'select id, agence, date_lead, taux_remise from buta.fait_dossier where publie and date_lead <= $jour and taux_remise > 0.20' where code = 'C07';
update buta.controle set requete = 'select id, agence, date_lead, produit, montant_ht, cout_materiel, cout_pose from buta.fait_dossier
     where publie and date_lead <= $jour and montant_ht is not null and montant_ht - cout_materiel - cout_pose < 0' where code = 'C08';

-- Les journées déjà contrôlées sont rejouées après cette migration, par tranches de trente jours
-- (`select buta.executer_controles(d) from generate_series(...)`, voir JOURNAL.md) : sans rejeu, nb_lignes_30j
-- reste null et agences vide sur l'historique.
