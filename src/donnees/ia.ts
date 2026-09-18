import { z } from "zod";
import { supabase } from "./client";

/**
 * Appel des Edge Functions IA (AUTOMATISATIONS.md §2) avec la clé anon, réponse validée par Zod : le front
 * n'embarque aucun secret et n'affiche jamais un chiffre qui ne viendrait pas des lignes ou des faits SQL.
 */
const Cause = z.object({ texte: z.string(), fait: z.string().optional(), source: z.string().optional() });

export const SchemaReponseIa = z.object({
  statut: z.enum(["ok", "refus", "repli", "erreur"]),
  sql: z.string().nullable().optional(),
  colonnes: z.array(z.string()).optional(),
  lignes: z.array(z.record(z.string(), z.unknown())).optional(),
  reponse: z.string().nullable().optional(),
  sources: z.array(z.string()).optional(),
  explication: z.object({ constat: z.string(), causes: z.array(Cause), action: z.string() }).optional(),
  cout_eur: z.number().optional(),
  duree_ms: z.number().optional(),
  motif_refus: z.string().nullable().optional(),
  message: z.string().optional(),
  modele: z.string().nullable().optional(),
  cache: z.boolean().optional(),
  redaction_rejetee: z.boolean().optional(),
  budget_jour: z.number().optional(),
});
export type ReponseIa = z.infer<typeof SchemaReponseIa>;

export interface ContexteAnalyste {
  periode?: string;
  agence?: string;
}

async function appeler(nom: "analyste" | "expliquer-ecart", corps: Record<string, unknown>): Promise<ReponseIa> {
  if (!supabase) return { statut: "repli", motif_refus: "Supabase non configuré" };
  const { data, error } = await supabase.functions.invoke(nom, { body: corps });
  if (error) {
    // Réponse non 2xx : le corps porte notre statut (erreur ou refus) ; sinon message générique.
    const contexte = (error as { context?: Response }).context;
    if (contexte && typeof contexte.json === "function") {
      try {
        return SchemaReponseIa.parse(await contexte.json());
      } catch {
        // Corps illisible : message générique ci-dessous.
      }
    }
    return { statut: "erreur", message: "Le service est momentanément indisponible." };
  }
  return SchemaReponseIa.parse(data);
}

export function poserQuestion(question: string, contexte: ContexteAnalyste): Promise<ReponseIa> {
  return appeler("analyste", { question, contexte });
}

export function expliquerEcartIa(perimetre: string, mois: string, indicateur: "CA" | "MARGE" | "CONVERSION"): Promise<ReponseIa> {
  return appeler("expliquer-ecart", { perimetre, mois, indicateur });
}
