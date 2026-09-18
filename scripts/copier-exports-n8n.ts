/**
 * Copie les exports JSON des workflows n8n (dossier n8n/ du dépôt, sans secret) dans dist/n8n/
 * pour que l'écran Automatisations les serve en téléchargement, et écrit dist/n8n/index.json,
 * la liste des fichiers réellement présents : l'écran n'active un bouton d'export que pour ceux-là
 * (la réécriture SPA du serveur renverrait sinon la page HTML sous un nom .json). Appelé par `npm run build`.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = join(process.cwd(), "n8n");
const CIBLE = join(process.cwd(), "dist", "n8n");

mkdirSync(CIBLE, { recursive: true });
const fichiers = existsSync(SOURCE) ? readdirSync(SOURCE).filter((f) => f.endsWith(".json")).sort() : [];
for (const f of fichiers) cpSync(join(SOURCE, f), join(CIBLE, f));
writeFileSync(join(CIBLE, "index.json"), `${JSON.stringify(fichiers)}\n`);
console.log(`exports n8n copiés : ${fichiers.length} fichier(s), index.json écrit.`);
