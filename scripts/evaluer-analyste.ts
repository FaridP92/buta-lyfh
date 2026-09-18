/**
 * Évaluation de l'analyste (IA.md §5) : joue les questions de supabase/functions/analyste/eval.md contre la
 * fonction déployée avec la clé anon, vérifie le statut attendu et les termes attendus, imprime le taux de réussite.
 * `npm run evaluer:analyste` ; sortie non nulle sous 90 %. Chaque question porte un agent utilisateur distinct
 * pour ne pas déclencher le quota par empreinte (cinq par minute), et les appels sont espacés de deux secondes.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chargerEnv } from "./lib/bd";

interface Cas {
  n: number;
  question: string;
  statut: "ok" | "refus";
  contient: string[];
}

function normaliser(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s  ]/g, "").toLowerCase();
}

function lireCas(): Cas[] {
  const md = readFileSync(join(process.cwd(), "supabase", "functions", "analyste", "eval.md"), "utf-8");
  const cas: Cas[] = [];
  for (const ligne of md.split("\n")) {
    const m = /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(ok|refus)\s*\|\s*(.*?)\s*\|/.exec(ligne);
    if (!m) continue;
    cas.push({ n: Number(m[1]), question: m[2] ?? "", statut: m[3] as "ok" | "refus", contient: (m[4] ?? "").split(";").map((t) => t.trim()).filter(Boolean) });
  }
  return cas;
}

async function principal(): Promise<void> {
  chargerEnv();
  const url = process.env["VITE_SUPABASE_URL"];
  const cle = process.env["VITE_SUPABASE_ANON_KEY"];
  if (!url || !cle) throw new Error("VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requis");
  const cas = lireCas();
  let reussites = 0;
  let coutTotal = 0;
  for (const c of cas) {
    const debut = Date.now();
    const r = await fetch(`${url}/functions/v1/analyste`, {
      method: "POST",
      headers: { apikey: cle, Authorization: `Bearer ${cle}`, "Content-Type": "application/json", "User-Agent": `evaluation-analyste/${c.n}` },
      body: JSON.stringify({ question: c.question }),
      signal: AbortSignal.timeout(120_000),
    });
    const corps = (await r.json()) as { statut: string; reponse?: string; lignes?: unknown[]; motif_refus?: string; message?: string; cout_eur?: number; sql?: string; redaction_rejetee?: boolean };
    coutTotal += corps.cout_eur ?? 0;
    const statutOk = corps.statut === c.statut && (c.statut !== "ok" || ((corps.lignes?.length ?? 0) > 0 && !corps.redaction_rejetee));
    const texte = normaliser(`${corps.reponse ?? ""} ${JSON.stringify(corps.lignes ?? [])}`);
    const manquants = c.contient.filter((t) => !texte.includes(normaliser(t)));
    const ok = statutOk && manquants.length === 0;
    if (ok) reussites += 1;
    console.log(`${ok ? "OK " : "KO "} ${c.n.toString().padStart(2)} ${c.question}`);
    console.log(`     statut ${corps.statut} (attendu ${c.statut})${manquants.length ? `, manquants : ${manquants.join(", ")}` : ""}, ${Date.now() - debut} ms, ${(corps.cout_eur ?? 0).toFixed(4)} €`);
    if (corps.statut === "ok") console.log(`     ${corps.sql ?? ""}\n     ${(corps.reponse ?? "").slice(0, 300)}`);
    else console.log(`     ${corps.motif_refus ?? corps.message ?? ""}`);
    await new Promise((resoudre) => setTimeout(resoudre, 2000));
  }
  const taux = Math.round((100 * reussites) / cas.length);
  console.log(`\n${reussites}/${cas.length} réussites (${taux} %), coût ${coutTotal.toFixed(4)} €`);
  if (taux < 90) {
    console.error("taux sous 90 % : l'écran Analyste doit rester hors navigation (IA.md §5).");
    process.exit(1);
  }
}

principal().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});
