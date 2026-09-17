-- 0005 : search_path fixe sur les deux fonctions SQL utilisees par les vues
-- (advisor function_search_path_mutable).

alter function buta.journee_publiee() set search_path = buta, public;
alter function buta.phi(double precision) set search_path = buta, public;
