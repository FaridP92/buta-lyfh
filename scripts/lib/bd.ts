import pg from "pg";

export function chargerEnv(): void {
  try {
    process.loadEnvFile(".env");
  } catch {
    // pas de .env : les variables viennent de l'environnement
  }
}

export function urlBase(): string | null {
  const url = process.env["SUPABASE_DB_URL"];
  return url && url.trim() !== "" ? url.trim() : null;
}

export function creerPool(url: string): pg.Pool {
  return new pg.Pool({
    connectionString: url,
    ssl: process.env["SUPABASE_DB_SSL_NON_VERIFIE"] === "1" ? { rejectUnauthorized: false } : { rejectUnauthorized: true },
    max: 4,
  });
}

export type Ligne = Record<string, unknown>;

/** Client connecte (a fermer avec client.end()). Echoue si SUPABASE_DB_URL est absent. */
export async function connexion(): Promise<pg.Client> {
  const url = urlBase();
  if (!url) throw new Error("SUPABASE_DB_URL absent de .env : connexion Postgres impossible");
  const client = new pg.Client({
    connectionString: url,
    ssl: process.env["SUPABASE_DB_SSL_NON_VERIFIE"] === "1" ? { rejectUnauthorized: false } : { rejectUnauthorized: true },
  });
  await client.connect();
  return client;
}

export function dateUTC(annee: number, mois: number, jour: number): Date {
  return new Date(Date.UTC(annee, mois - 1, jour));
}

export function ajouterJours(date: Date, jours: number): Date {
  return new Date(date.getTime() + Math.round(jours) * 86_400_000);
}

/** AAAA-MM-JJ a partir des composantes UTC. */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Insertion multi-lignes par lots (lignes en tableaux positionnels ou en objets indexes par colonne). */
export async function insererParLots(
  client: pg.Client | pg.PoolClient,
  table: string,
  colonnes: string[],
  lignes: Array<unknown[] | Ligne>,
  tailleLot = 500,
): Promise<number> {
  let total = 0;
  for (let debut = 0; debut < lignes.length; debut += tailleLot) {
    const lot = lignes.slice(debut, debut + tailleLot);
    const valeurs: unknown[] = [];
    const groupes = lot.map((ligne, i) => {
      const places = colonnes.map((c, j) => {
        valeurs.push(Array.isArray(ligne) ? (ligne[j] ?? null) : (ligne[c] ?? null));
        return `$${i * colonnes.length + j + 1}`;
      });
      return `(${places.join(", ")})`;
    });
    const resultat = await client.query(`insert into ${table} (${colonnes.join(", ")}) values ${groupes.join(", ")}`, valeurs);
    total += resultat.rowCount ?? 0;
  }
  return total;
}

/**
 * Upsert multi-lignes par lots ; les valeurs sont passees en parametres ($n).
 * colonnesMaj : colonnes mises a jour en cas de conflit (par defaut toutes hors cles).
 */
export async function upsertParLots(
  client: pg.PoolClient,
  table: string,
  colonnes: string[],
  cles: string[],
  lignes: Ligne[],
  tailleLot = 500,
): Promise<number> {
  if (lignes.length === 0) return 0;
  const colonnesMaj = colonnes.filter((c) => !cles.includes(c));
  const clauseMaj =
    colonnesMaj.length > 0
      ? `do update set ${colonnesMaj.map((c) => `${c} = excluded.${c}`).join(", ")}`
      : "do nothing";
  let total = 0;
  for (let debut = 0; debut < lignes.length; debut += tailleLot) {
    const lot = lignes.slice(debut, debut + tailleLot);
    const valeurs: unknown[] = [];
    const groupes = lot.map((ligne, i) => {
      const places = colonnes.map((c, j) => {
        valeurs.push(ligne[c] ?? null);
        return `$${i * colonnes.length + j + 1}`;
      });
      return `(${places.join(", ")})`;
    });
    const sql = `insert into ${table} (${colonnes.join(", ")}) values ${groupes.join(", ")} on conflict (${cles.join(", ")}) ${clauseMaj}`;
    const resultat = await client.query(sql, valeurs);
    total += resultat.rowCount ?? 0;
  }
  return total;
}
