/**
 * Publie la revue hebdomadaire rédigée par règles (src/lib/revue.ts) pour une ou plusieurs semaines :
 * `npm run revue -- --semaine 2026-09-07` (un lundi) ou `npm run revue -- --depuis 2026-08-17` (tous les lundis
 * jusqu'à la dernière semaine complète avant la journée publiée). Les faits viennent de buta.faits_revue_hebdo,
 * le texte est écrit par buta.publier_revue avec le modèle « règles » et un coût nul ; le workflow WF3 (modèle
 * de langage) remplace le texte de la semaine courante quand il tourne.
 */
import { chargerEnv, connexion } from "./lib/bd";
import { redigerRevue, versTexte, type FaitsRevue } from "../src/lib/revue";

function lireArgument(nom: string): string | undefined {
  const index = process.argv.indexOf(nom);
  return index === -1 ? undefined : process.argv[index + 1];
}

function lundiDe(jour: string): string {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function ajouterJours(jour: string, n: number): string {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function principal(): Promise<void> {
  chargerEnv();
  const client = await connexion();
  try {
    const { rows } = await client.query<{ journee: string }>("select to_char(buta.journee_publiee(), 'YYYY-MM-DD') as journee");
    const journee = rows[0]?.journee;
    if (!journee) throw new Error("journée publiée introuvable");
    // Dernière semaine complète : le lundi de la semaine précédant celle de la journée publiée.
    const derniereComplete = ajouterJours(lundiDe(journee), -7);
    const semaines: string[] = [];
    const unique = lireArgument("--semaine");
    const depuis = lireArgument("--depuis");
    if (unique) semaines.push(lundiDe(unique));
    else {
      let s = lundiDe(depuis ?? derniereComplete);
      while (s <= derniereComplete) { semaines.push(s); s = ajouterJours(s, 7); }
    }
    for (const semaine of semaines) {
      const faits = await client.query<{ faits: FaitsRevue }>("select buta.faits_revue_hebdo($1::date) as faits", [semaine]);
      const f = faits.rows[0]?.faits;
      if (!f) throw new Error(`faits absents pour la semaine ${semaine}`);
      const texte = versTexte(redigerRevue(f));
      await client.query("select buta.publier_revue($1::date, $2, $3, $4)", [semaine, texte, "règles", 0]);
      console.log(`revue publiée : semaine du ${semaine} (${texte.length} caractères, règles)`);
    }
  } finally {
    await client.end();
  }
}

principal().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});
