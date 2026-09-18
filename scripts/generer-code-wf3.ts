/**
 * Génère le code du nœud « Rédiger par règles » du workflow WF3 (revue hebdomadaire) : la bibliothèque
 * src/lib/revue.ts est empaquetée en un seul script (esbuild, format iife) pour que n8n exécute exactement
 * la même rédaction par règles que l'application. Sortie : n8n/wf3-code-regles.js, à coller dans le nœud
 * Code après toute modification de src/lib/revue.ts (`npm run n8n:wf3`).
 */
import { buildSync } from "esbuild";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const resultat = buildSync({
  entryPoints: [join(process.cwd(), "src", "lib", "revue.ts")],
  bundle: true, write: false, format: "iife", globalName: "revue", platform: "node", target: "es2022", minifySyntax: true,
  alias: { "@": join(process.cwd(), "src") },
});
const bibliotheque = resultat.outputFiles[0]?.text ?? "";
if (!bibliotheque) throw new Error("empaquetage vide");

const usage = `
// Faits de la semaine (RPC buta.faits_revue_hebdo, réponse complète : le JSON est dans body).
const faits = $input.first().json.body;
if (!faits || !faits.reseau) throw new Error("faits de la revue absents");
const r = revue.redigerRevue(faits);
const texteRegles = revue.versTexte(r);
// Nombres autorisés pour le modèle : ceux qui figurent dans la rédaction par règles (mêmes formats).
const jetons = (s) => (String(s).match(/\\d[\\d\\u202f\\u00a0 ]*(?:[.,]\\d+)?/g) || []).map((t) => t.replace(/[\\s\\u202f\\u00a0]/g, "").replace(/[.,]$/, ""));
const autorises = [...new Set(jetons(texteRegles))];
return [{ json: {
  semaine: faits.semaine,
  faits: r.faits,
  lecture_regles: r.lecture,
  decisions: r.decisions,
  texte_regles: texteRegles,
  faits_texte: r.faits.map((f) => "- " + f).join("\\n"),
  autorises,
} }];
`;
const code = `${bibliotheque}\n${usage}`;
writeFileSync(join(process.cwd(), "n8n", "wf3-code-regles.js"), code);
console.log(`n8n/wf3-code-regles.js écrit (${code.length} caractères).`);
