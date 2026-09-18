import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "./client";
import { VUES, type Ligne, type NomVue } from "./vues";

export interface FiltresVue {
  /** Égalités : { agence: "SAI", canal: "TOUS" } */
  egal?: Record<string, string | number | boolean>;
  /** Intervalle inclusif sur une colonne (dates AAAA-MM-JJ ou nombres). */
  entre?: { colonne: string; de: string | number; a: string | number };
  /** Colonne de tri, préfixée de - pour un ordre décroissant. */
  ordre?: string;
  limite?: number;
  /** Vue partitionnée dans l'instantané (un fichier par valeur de cette colonne) : la valeur est lue dans `egal`. */
  partition?: string;
}

export type SourceVue = "supabase" | "instantane" | "aucune";

interface ResultatVue<N extends NomVue> {
  donnees: Ligne<N>[] | undefined;
  source: SourceVue;
  chargement: boolean;
  erreur: unknown;
}

function cle(nom: string, filtres: FiltresVue | undefined): unknown[] {
  return [nom, filtres ?? {}];
}

/** PostgREST tronque silencieusement à 1 000 lignes (HTTP 200, en-tête content-range) : on lit page par page. */
const PAGE = 1000;

async function lireSupabase<N extends NomVue>(nom: N, filtres: FiltresVue | undefined): Promise<Ligne<N>[]> {
  if (!supabase) throw new Error("Supabase non configuré");
  const lignes: unknown[] = [];
  for (let debut = 0; ; debut += PAGE) {
    let requete = supabase.from(nom).select("*");
    for (const [colonne, valeur] of Object.entries(filtres?.egal ?? {})) requete = requete.eq(colonne, valeur);
    if (filtres?.entre) requete = requete.gte(filtres.entre.colonne, filtres.entre.de).lte(filtres.entre.colonne, filtres.entre.a);
    if (filtres?.ordre) {
      const descendant = filtres.ordre.startsWith("-");
      requete = requete.order(descendant ? filtres.ordre.slice(1) : filtres.ordre, { ascending: !descendant });
    }
    const fin = filtres?.limite ? Math.min(debut + PAGE, filtres.limite) - 1 : debut + PAGE - 1;
    const { data, error } = await requete.range(debut, fin);
    if (error) throw error;
    lignes.push(...(data ?? []));
    const pageEntiere = (data ?? []).length === fin - debut + 1;
    if (!pageEntiere || (filtres?.limite !== undefined && lignes.length >= filtres.limite)) break;
  }
  return z.array(VUES[nom]).parse(lignes) as Ligne<N>[];
}

function filtrerLocalement<N extends NomVue>(lignes: Ligne<N>[], filtres: FiltresVue | undefined): Ligne<N>[] {
  let resultat = lignes as Record<string, unknown>[];
  for (const [colonne, valeur] of Object.entries(filtres?.egal ?? {})) resultat = resultat.filter((l) => l[colonne] === valeur);
  if (filtres?.entre) {
    const { colonne, de, a } = filtres.entre;
    resultat = resultat.filter((l) => {
      const v = l[colonne];
      return (typeof v === "string" || typeof v === "number") && v >= de && v <= a;
    });
  }
  if (filtres?.ordre) {
    const descendant = filtres.ordre.startsWith("-");
    const colonne = descendant ? filtres.ordre.slice(1) : filtres.ordre;
    resultat = [...resultat].sort((x, y) => {
      const a = x[colonne] as string | number;
      const b = y[colonne] as string | number;
      return (a < b ? -1 : a > b ? 1 : 0) * (descendant ? -1 : 1);
    });
  }
  if (filtres?.limite) resultat = resultat.slice(0, filtres.limite);
  return resultat as Ligne<N>[];
}

async function lireInstantane<N extends NomVue>(nom: N, fichier: string): Promise<Ligne<N>[]> {
  const reponse = await fetch(`/data/instantane/${fichier}.json`);
  if (!reponse.ok) throw new Error(`instantane ${fichier} absent`);
  return z.array(VUES[nom]).parse(await reponse.json()) as Ligne<N>[];
}

/** Nom du fichier d'instantané : la vue, ou la vue suivie de la valeur de partition. */
function fichierInstantane(nom: string, filtres: FiltresVue | undefined): string | null {
  if (!filtres?.partition) return nom;
  const valeur = filtres.egal?.[filtres.partition];
  return valeur === undefined ? null : `${nom}-${String(valeur)}`;
}

/**
 * Lecture d'une vue mart_ (ARCHITECTURE.md §3) : l'instantané statique s'affiche d'abord,
 * Supabase remplace dès qu'il répond ; si Supabase échoue, l'instantané reste avec sa source.
 * Aucun calcul ici : les filtres locaux ne font que restreindre les lignes de l'instantané.
 */
export function useVue<N extends NomVue>(nom: N, filtres?: FiltresVue): ResultatVue<N> {
  const distant = useQuery({
    queryKey: ["supabase", ...cle(nom, filtres)],
    queryFn: () => lireSupabase(nom, filtres),
    enabled: supabase !== null,
    staleTime: 60_000,
    retry: 1,
  });
  const fichier = fichierInstantane(nom, filtres);
  const local = useQuery({
    queryKey: ["instantane", fichier],
    queryFn: () => lireInstantane(nom, fichier as string),
    enabled: fichier !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  if (distant.data) return { donnees: distant.data, source: "supabase", chargement: false, erreur: null };
  if (local.data) {
    return { donnees: filtrerLocalement(local.data, filtres), source: "instantane", chargement: distant.isFetching, erreur: distant.error };
  }
  return {
    donnees: undefined,
    source: "aucune",
    chargement: distant.isFetching || local.isFetching,
    erreur: distant.error ?? local.error,
  };
}
