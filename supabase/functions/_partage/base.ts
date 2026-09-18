/**
 * Lecture de la base sous le rôle analyste_ro (IA.md §4, migration 0024) : connexion directe avec SUPABASE_DB_URL
 * (injectée dans l'environnement des Edge Functions, jamais dans le navigateur), puis, dans une même transaction,
 * « set local role analyste_ro », « set local statement_timeout = '5s' » et la requête. Le rôle ne lit que les
 * vues mart_ ; toute autre table répond « permission denied ». Repli sur le pooler Supavisor si l'hôte direct
 * (IPv6) n'est pas joignable.
 */
import postgres from "postgres";
import { env } from "./commun.ts";

type Client = ReturnType<typeof postgres>;
let client: Client | null = null;

function urlsCandidates(): string[] {
  const directe = env("SUPABASE_DB_URL");
  if (!directe) return [];
  const candidats = [directe];
  const m = /^(postgres(?:ql)?:\/\/)([^:]+):([^@]+)@db\.([a-z]+)\.supabase\.co(?::\d+)?(\/.*)?$/.exec(directe);
  if (m) {
    const [, schema, , motDePasse, ref, chemin] = m;
    const hote = env("SUPABASE_POOLER_HOTE") ?? "aws-1-eu-west-3.pooler.supabase.com";
    candidats.push(`${schema}postgres.${ref}:${motDePasse}@${hote}:6543${chemin ?? "/postgres"}`);
  }
  return candidats;
}

async function connexion(): Promise<Client> {
  if (client) return client;
  let derniere: unknown = null;
  for (const url of urlsCandidates()) {
    const essai = postgres(url, { max: 2, idle_timeout: 30, connect_timeout: 8, prepare: false, ssl: "require" });
    try {
      await essai`select 1`;
      client = essai;
      return essai;
    } catch (erreur) {
      derniere = erreur;
      await essai.end({ timeout: 1 }).catch(() => undefined);
    }
  }
  throw new Error(`connexion à la base impossible : ${derniere instanceof Error ? derniere.message : String(derniere)}`);
}

function valeurLisible(v: unknown): unknown {
  if (v instanceof Date) {
    const iso = v.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
  }
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

export interface Lecture {
  colonnes: string[];
  lignes: Record<string, unknown>[];
}

/** Exécute une requête validée sous analyste_ro avec le délai de 5 s ; les numériques reviennent en nombres, les dates en AAAA-MM-JJ. */
export async function lireEnLectureSeule(sql: string): Promise<Lecture> {
  const c = await connexion();
  return await c.begin(async (tx) => {
    await tx.unsafe("set local role analyste_ro");
    await tx.unsafe("set local statement_timeout = '5s'");
    await tx.unsafe("set local search_path = buta");
    const resultat = await tx.unsafe(sql);
    const colonnes = (resultat.columns ?? []).map((col) => col.name);
    const lignes = resultat.map((ligne) => Object.fromEntries(Object.entries(ligne as Record<string, unknown>).map(([k, v]) => [k, valeurLisible(v)])));
    return { colonnes: colonnes.length ? colonnes : Object.keys(lignes[0] ?? {}), lignes };
  }) as Lecture;
}
