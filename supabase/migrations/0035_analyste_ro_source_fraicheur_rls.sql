-- 0035 : analyste_ro lisait 0 ligne de source_fraicheur (audit du 23 septembre 2026). La migration 0030 lui a donné
-- le grant select, mais la politique lecture_publique (0002) ne visait que anon et authenticated : la RLS masquait
-- toutes les lignes, sans erreur. buta.journee_publiee(), évaluée avec les droits de l'appelant, retombait alors sur la
-- veille pour l'analyste au lieu de la journée publiée : même date tant que WF1 publie à l'heure, décalage sinon.
alter policy lecture_publique on buta.source_fraicheur to anon, authenticated, analyste_ro;
