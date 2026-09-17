import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "./client";

const SchemaFraicheur = z.object({ date_reference: z.string().nullable(), ingere_le: z.string() });
const SchemaMeta = z.object({ genere_le: z.string(), journee_publiee: z.string().nullable() });

export interface Fraicheur {
  source: "supabase" | "instantane";
  journee: string | null;
  integreeLe: string;
}

async function lireFraicheur(): Promise<Fraicheur> {
  if (supabase) {
    const { data, error } = await supabase
      .from("source_fraicheur")
      .select("date_reference, ingere_le")
      .eq("source", "journee_simulee")
      .maybeSingle();
    if (!error && data) {
      const ligne = SchemaFraicheur.parse(data);
      return { source: "supabase", journee: ligne.date_reference, integreeLe: ligne.ingere_le };
    }
  }
  const reponse = await fetch("/data/instantane/_meta.json");
  if (!reponse.ok) throw new Error("aucune fraicheur disponible");
  const meta = SchemaMeta.parse(await reponse.json());
  return { source: "instantane", journee: meta.journee_publiee, integreeLe: meta.genere_le };
}

/** Journee simulee publiee et heure d'integration (badge de fraicheur), rafraichie au retour d'onglet. */
export function useFraicheur() {
  return useQuery({ queryKey: ["fraicheur"], queryFn: lireFraicheur, staleTime: 60_000, retry: 1, refetchOnWindowFocus: true });
}
