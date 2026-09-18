-- 0030 : le rôle analyste_ro lisait « permission denied for table source_fraicheur » sur toutes les vues mart_ :
-- buta.journee_publiee() (fonction SQL stable, non security definer) est évaluée avec les droits de l'appelant
-- et lit source_fraicheur. Lecture seule accordée sur cette table de métadonnées (déjà exposée par mart_fraicheur).
grant select on buta.source_fraicheur to analyste_ro;
