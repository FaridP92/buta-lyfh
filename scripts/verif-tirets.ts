/**
 * Aucun tiret long (cadratin, demi-cadratin, barre) dans src/, docs/,
 * supabase/, n8n/ (CLAUDE.md). Le tiret simple - est accepté.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Points de code plutôt que des caractères littéraux : ce fichier ne doit
// lui-même contenir aucun tiret long pour passer son propre contrôle.
const TIRETS_LONGS = [0x2014, 0x2013, 0x2015].map((point) => String.fromCodePoint(point));
const DOSSIERS = ["src", "docs", "supabase", "n8n", "scripts"];
const EXTENSIONS_IGNOREES = new Set([".png", ".jpg", ".jpeg", ".svg", ".woff", ".woff2", ".ico"]);
const RACINE = process.cwd();

function listerFichiers(dossier: string): string[] {
  const resultats: string[] = [];
  let entrees: string[];
  try {
    entrees = readdirSync(dossier);
  } catch {
    return resultats;
  }
  for (const entree of entrees) {
    const chemin = join(dossier, entree);
    const info = statSync(chemin);
    if (info.isDirectory()) {
      if (entree === "node_modules" || entree.startsWith(".")) continue;
      resultats.push(...listerFichiers(chemin));
    } else {
      const point = entree.lastIndexOf(".");
      const extension = point === -1 ? "" : entree.slice(point);
      if (!EXTENSIONS_IGNOREES.has(extension)) resultats.push(chemin);
    }
  }
  return resultats;
}

let nbErreurs = 0;

for (const dossier of DOSSIERS) {
  const fichiers = listerFichiers(join(RACINE, dossier));
  for (const fichier of fichiers) {
    const contenu = readFileSync(fichier, "utf-8");
    const lignes = contenu.split("\n");
    lignes.forEach((ligne, index) => {
      for (const tiret of TIRETS_LONGS) {
        if (ligne.includes(tiret)) {
          nbErreurs += 1;
          console.error(
            `${relative(RACINE, fichier)}:${index + 1} contient un tiret long (${JSON.stringify(tiret)})`,
          );
        }
      }
    });
  }
}

if (nbErreurs > 0) {
  console.error(`\nverif:tirets : ${nbErreurs} occurrence(s) à corriger.`);
  process.exit(1);
}

console.log("verif:tirets : aucun tiret long trouvé.");
