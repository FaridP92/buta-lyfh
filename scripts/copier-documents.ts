/**
 * Copie dans dist/ les documents générés du dossier docs/ qui sont servis à une adresse stable
 * (fiche de présentation : /fiche.pdf, synthèse d'une page : /synthese.pdf). Appelé par `npm run build`, après le bundle : un document
 * absent est signalé sans faire échouer la construction.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DOCUMENTS: ReadonlyArray<{ source: string; cible: string }> = [
  { source: join("docs", "FICHE.pdf"), cible: "fiche.pdf" },
  { source: join("docs", "SYNTHESE.pdf"), cible: "synthese.pdf" },
];

const DIST = join(process.cwd(), "dist");
mkdirSync(DIST, { recursive: true });
for (const document of DOCUMENTS) {
  const source = join(process.cwd(), document.source);
  if (!existsSync(source)) {
    console.warn(`document absent, non copié : ${document.source}`);
    continue;
  }
  copyFileSync(source, join(DIST, document.cible));
  const ko = Math.round(statSync(source).size / 1024).toLocaleString("fr-FR");
  console.log(`${document.source} copié vers dist/${document.cible} (${ko} Ko).`);
}
