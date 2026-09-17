import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const cle = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

/** Client Supabase (cle anon, bornee par la RLS), schema buta. Null si la configuration manque. */
export const supabase =
  url && cle ? createClient(url, cle, { db: { schema: "buta" }, auth: { persistSession: false } }) : null;
