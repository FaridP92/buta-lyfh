/**
 * Copie les exports JSON des workflows n8n (dossier n8n/ du dépôt, sans secret) dans dist/n8n/
 * pour que l'écran Automatisations les serve en téléchargement. Appelé par `npm run build`.
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SOURCE = join(process.cwd(), "n8n");
const CIBLE = join(process.cwd(), "dist", "n8n");

mkdirSync(CIBLE, { recursive: true });
const fichiers = existsSync(SOURCE) ? readdirSync(SOURCE).filter((f) => f.endsWith(".json")) : [];
for (const f of fichiers) cpSync(join(SOURCE, f), join(CIBLE, f));
console.log(`exports n8n copiés : ${fichiers.length} fichier(s).`);
