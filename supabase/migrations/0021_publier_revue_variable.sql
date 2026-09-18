-- 0021 : buta.publier_revue plantait (« column reference semaine is ambiguous ») : la variable plpgsql
-- portait le même nom que la colonne visée par on conflict. Variable renommée, comportement inchangé.

create or replace function buta.publier_revue(p_semaine date, p_texte text, p_modele text, p_cout numeric)
returns date
language plpgsql
security definer
set search_path = buta, public
as $$
declare
  v_semaine date := date_trunc('week', p_semaine)::date;
begin
  insert into buta.revue_hebdo (semaine, faits, texte, modele, cout, publie_le)
  values (v_semaine, buta.faits_revue_hebdo(v_semaine), p_texte, p_modele, p_cout, now())
  on conflict (semaine) do update set faits = excluded.faits, texte = excluded.texte, modele = excluded.modele, cout = excluded.cout, publie_le = now();
  return v_semaine;
end;
$$;
comment on function buta.publier_revue(date, text, text, numeric) is 'Enregistre la revue hebdomadaire rédigée (texte, modèle, coût) avec les faits recalculés ; rejouer la même semaine remplace la revue.';
