-- 0032 : search_path figé sur la surcharge round (advisor « function_search_path_mutable » après la migration 0031).
-- Le corps appelle déjà pg_catalog.round en nom qualifié ; la clause rend la chose explicite pour le linter.
alter function buta.round(double precision, integer) set search_path = pg_catalog;
