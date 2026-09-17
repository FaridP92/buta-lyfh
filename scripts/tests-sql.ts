/**
 * Tests SQL (VERIFICATION.md §2) : execute chaque fichier de supabase/tests/ sur la base et
 * exige une colonne `ok` vraie sur chaque ligne renvoyee. `npm run test:sql`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chargerEnv, connexion } from "./lib/bd";

const DOSSIER = join(process.cwd(), "supabase", "tests");

interface Resultat {
  rows: Record<string, unknown>[];
}

async function principal(): Promise<void> {
  chargerEnv();
  const client = await connexion();
  let echecs = 0;
  let total = 0;
  try {
    const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".sql")).sort();
    for (const fichier of fichiers) {
      const sql = readFileSync(join(DOSSIER, fichier), "utf-8");
      const resultats = (await client.query(sql)) as unknown as Resultat | Resultat[];
      const liste = Array.isArray(resultats) ? resultats : [resultats];
      console.log(`\n== ${fichier}`);
      for (const resultat of liste) {
        for (const ligne of resultat.rows ?? []) {
          if (!("ok" in ligne)) continue;
          total += 1;
          const ok = ligne["ok"] === true;
          if (!ok) echecs += 1;
          const details = Object.entries(ligne)
            .filter(([cle]) => cle !== "test" && cle !== "ok")
            .map(([cle, valeur]) => `${cle}=${String(valeur)}`)
            .join("  ");
          console.log(`${ok ? "OK " : "KO "} ${String(ligne["test"])}\n     ${details}`);
        }
      }
    }
  } finally {
    await client.end();
  }
  console.log(`\n${total - echecs}/${total} tests SQL verts`);
  if (echecs > 0) process.exit(1);
}

principal().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});
