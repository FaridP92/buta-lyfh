-- 0006 : postgres (non superutilisateur sur Supabase) devient membre d'analyste_ro pour pouvoir
-- tester le role par SET ROLE (audit RLS). Sans effet sur les droits d'analyste_ro lui-meme.

grant analyste_ro to postgres;
