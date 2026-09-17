/**
 * Chaque vue mart_ definie dans les migrations Supabase doit avoir sa fiche
 * dans docs/INDICATEURS.md (DONNEES.md §4.5). Tant que le lot 1 n'a pas livre
 * de migrations, le controle est un avertissement, pas un echec (US-006,
 * DEPLOIEMENT_VPS.md §2).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();
const DOSSIER_MIGRATIONS = join(RACINE, "supabase", "migrations");
const FICHIER_INDICATEURS = join(RACINE, "docs", "INDICATEURS.md");

function listerMigrations(): string[] {
  try {
    return readdirSync(DOSSIER_MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => join(DOSSIER_MIGRATIONS, f));
  } catch {
    return [];
  }
}

function extraireVues(contenuSQL: string): string[] {
  const regex = /CREATE\s+(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:buta\.)?(mart_\w+)/gi;
  const vues = new Set<string>();
  let correspondance: RegExpExecArray | null;
  while ((correspondance = regex.exec(contenuSQL)) !== null) {
    const nom = correspondance[1];
    if (nom) vues.add(nom);
  }
  return [...vues];
}

const migrations = listerMigrations();

if (migrations.length === 0) {
  console.warn("verif:sources : aucune migration Supabase pour l'instant (attendu avant le lot 1).");
  process.exit(0);
}

const vues = new Set<string>();
for (const fichier of migrations) {
  const contenu = readFileSync(fichier, "utf-8");
  for (const vue of extraireVues(contenu)) vues.add(vue);
}

if (vues.size === 0) {
  console.warn("verif:sources : aucune vue mart_ trouvee dans les migrations pour l'instant.");
  process.exit(0);
}

const indicateurs = readFileSync(FICHIER_INDICATEURS, "utf-8");
const manquantes = [...vues].filter((vue) => !indicateurs.includes(vue));

if (manquantes.length > 0) {
  console.error("verif:sources : vues sans fiche dans docs/INDICATEURS.md :");
  for (const vue of manquantes) console.error(`  - ${vue}`);
  process.exit(1);
}

console.log(`verif:sources : ${vues.size} vue(s) mart_ toutes documentees dans INDICATEURS.md.`);
