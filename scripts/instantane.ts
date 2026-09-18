/**
 * Instantané statique de secours (ARCHITECTURE.md §1) : chaque vue mart_ est lue par
 * PostgREST avec la clé anon (exactement comme le front) et écrite dans
 * public/data/instantane/{vue}.json, plus _meta.json (date, journée publiée, lignes).
 * Tolère l'absence de vues ou de schéma exposé : avertissement et code 0
 * (DEPLOIEMENT_VPS.md §2) tant que le lot 1 n'est pas en ligne.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chargerEnv } from "./lib/bd";

/** Vues partitionnées en plusieurs fichiers par valeur d'une colonne (ARCHITECTURE.md §3). */
const PARTITIONS: Record<string, string> = { mart_marche_commune: "departement" };

const VUES = [
  "mart_kpi_mensuel", "mart_funnel", "mart_ventes_produit", "mart_ecarts", "mart_couts_acquisition",
  "mart_delais", "mart_pose", "mart_encaissement", "mart_forecast", "mart_qualite",
  "mart_marche_departement", "mart_marche_commune", "mart_automatisation", "mart_alertes",
  "mart_plans_action", "mart_revue_hebdo", "mart_remises", "mart_objectif_mensuel", "mart_reconciliation_libelles", "mart_fraicheur", "mart_ia_usage",
] as const;

const DOSSIER = join(process.cwd(), "public", "data", "instantane");
const TAILLE_PAGE = 1000;

async function lireVue(url: string, cle: string, vue: string): Promise<unknown[]> {
  const lignes: unknown[] = [];
  for (let debut = 0; ; debut += TAILLE_PAGE) {
    const reponse = await fetch(`${url}/rest/v1/${vue}?select=*`, {
      headers: {
        apikey: cle,
        Authorization: `Bearer ${cle}`,
        "Accept-Profile": "buta",
        Range: `${debut}-${debut + TAILLE_PAGE - 1}`,
        Prefer: "count=none",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!reponse.ok) {
      throw new Error(`${vue} : HTTP ${reponse.status} ${(await reponse.text()).slice(0, 200)}`);
    }
    const page = (await reponse.json()) as unknown[];
    lignes.push(...page);
    if (page.length < TAILLE_PAGE) break;
  }
  return lignes;
}

async function principal(): Promise<void> {
  chargerEnv();
  const url = process.env["VITE_SUPABASE_URL"];
  const cle = process.env["VITE_SUPABASE_ANON_KEY"];
  if (!url || !cle) {
    console.warn("instantané : VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY absent, instantané ignoré.");
    return;
  }
  mkdirSync(DOSSIER, { recursive: true });
  const meta: Record<string, number> = {};
  let echecs = 0;
  for (const vue of VUES) {
    try {
      const lignes = await lireVue(url, cle, vue);
      const partition = PARTITIONS[vue];
      if (partition) {
        // Vue volumineuse : un fichier par valeur de la colonne de partition (le front ne charge que la sienne).
        const groupes = new Map<string, unknown[]>();
        for (const l of lignes) {
          const valeur = String((l as Record<string, unknown>)[partition]);
          const groupe = groupes.get(valeur) ?? [];
          groupe.push(l);
          groupes.set(valeur, groupe);
        }
        for (const [valeur, groupe] of groupes) writeFileSync(join(DOSSIER, `${vue}-${valeur}.json`), JSON.stringify(groupe));
        rmSync(join(DOSSIER, `${vue}.json`), { force: true });
      } else {
        writeFileSync(join(DOSSIER, `${vue}.json`), JSON.stringify(lignes));
      }
      meta[vue] = lignes.length;
      console.log(`${vue} : ${lignes.length} ligne(s)${partition ? `, partitionnée par ${partition}` : ""}`);
    } catch (erreur) {
      echecs += 1;
      console.warn(`${vue} : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
    }
  }
  const cheminMeta = join(DOSSIER, "_meta.json");
  if (echecs === VUES.length) {
    // Base injoignable (projet en pause, réseau) : l'instantané précédent et sa méta restent tels quels,
    // le site continue de servir la dernière journée publiée connue.
    console.warn("instantané : aucune vue accessible (base injoignable ou vues absentes), instantané précédent conservé.");
    return;
  }
  // _meta.json existe toujours dans le bundle : le front le lit sans erreur console, même vide.
  const precedente = existsSync(cheminMeta) ? (JSON.parse(readFileSync(cheminMeta, "utf-8")) as { journee_publiee?: string | null }).journee_publiee ?? null : null;
  const journee = (meta["mart_kpi_mensuel"] ?? 0) > 0 ? (await journeePubliee(url, cle)) ?? precedente : precedente;
  writeFileSync(cheminMeta, JSON.stringify({ genere_le: new Date().toISOString(), journee_publiee: journee, lignes: meta }, null, 2));
  console.log(`instantané écrit dans public/data/instantane (${VUES.length - echecs} vue(s)).`);
}

async function journeePubliee(url: string, cle: string): Promise<string | null> {
  try {
    const reponse = await fetch(`${url}/rest/v1/mart_fraicheur?select=date_reference&source=eq.journee_simulee`, {
      headers: { apikey: cle, Authorization: `Bearer ${cle}`, "Accept-Profile": "buta" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!reponse.ok) return null;
    const lignes = (await reponse.json()) as { date_reference: string | null }[];
    return lignes[0]?.date_reference ?? null;
  } catch {
    return null;
  }
}

principal().catch((erreur: unknown) => {
  console.warn(`instantané ignoré : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
});
