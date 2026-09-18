/**
 * Socle des Edge Functions IA (ARCHITECTURE.md §3 et §4, IA.md §4) : CORS, empreinte hachée, appels REST
 * avec la clé service (jamais transmise au navigateur), appel du modèle (Anthropic si la clé existe, sinon
 * Mistral, sinon repli), coût en euros, quotas et journal. Aucun chiffre métier n'est calculé ici.
 */

export const ENTETES_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function reponseJson(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), { status: statut, headers: { ...ENTETES_CORS, "Content-Type": "application/json; charset=utf-8" } });
}

export function preflight(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response("ok", { headers: ENTETES_CORS }) : null;
}

export function env(nom: string): string | undefined {
  const v = Deno.env.get(nom)?.trim();
  return v ? v : undefined;
}

/** Budget quotidien en euros (IA.md §4) : 5 la semaine de l'entretien, 1,5 ensuite ; 1,5 par défaut. */
export function budgetJour(): number {
  const v = Number(env("IA_BUDGET_JOUR_EUR"));
  return Number.isFinite(v) && v > 0 ? v : 1.5;
}

/** Empreinte d'adresse hachée (SHA-256 de l'adresse, du navigateur et d'un sel) : jamais l'adresse en clair. */
export async function empreinte(req: Request): Promise<string> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "inconnue";
  const navigateur = req.headers.get("user-agent") ?? "";
  const sel = env("IA_SEL") ?? "buta-lyfh";
  const hache = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${sel}|${ip}|${navigateur}`));
  return [...new Uint8Array(hache)].map((o) => o.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function urlSupabase(): string {
  return env("SUPABASE_URL") ?? "";
}

function cleService(): string {
  return env("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function entetesService(profil: "Accept-Profile" | "Content-Profile"): Record<string, string> {
  return { apikey: cleService(), Authorization: `Bearer ${cleService()}`, "Content-Type": "application/json", [profil]: "buta" };
}

/** Appel d'une fonction SQL du schéma buta avec la clé service. */
export async function rpcService<T>(nom: string, corps: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${urlSupabase()}/rest/v1/rpc/${nom}`, { method: "POST", headers: entetesService("Content-Profile"), body: JSON.stringify(corps), signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`rpc ${nom} : HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  // Une fonction « returns void » répond avec un corps vide.
  const texte = await r.text();
  return (texte ? JSON.parse(texte) : undefined) as T;
}

/** Lecture d'une vue ou table du schéma buta (paramètres PostgREST) avec la clé service. */
export async function lireVue<T>(vue: string, parametres = ""): Promise<T[]> {
  const r = await fetch(`${urlSupabase()}/rest/v1/${vue}${parametres ? `?${parametres}` : ""}`, { headers: entetesService("Accept-Profile"), signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`lecture ${vue} : HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as T[];
}

/** Écriture (upsert) dans une table du schéma buta avec la clé service. */
export async function ecrireTable(table: string, ligne: Record<string, unknown>): Promise<void> {
  const r = await fetch(`${urlSupabase()}/rest/v1/${table}`, {
    method: "POST", headers: { ...entetesService("Content-Profile"), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(ligne), signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`écriture ${table} : HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
}

export interface ResultatModele {
  texte: string;
  tokensEntree: number;
  tokensSortie: number;
  coutEur: number;
  modele: string;
}

/** Levée quand aucune clé de modèle n'est configurée : la fonction répond « repli » et le front affiche les phrases par règles. */
export class ErreurRepli extends Error {}

/** Tarifs indicatifs en euros par million de jetons (constante versionnée, à vérifier sur les grilles publiques). */
const TARIFS: Record<string, { entree: number; sortie: number }> = {
  "claude-sonnet-5": { entree: 2.76, sortie: 13.8 },
  "mistral-large-latest": { entree: 1.85, sortie: 5.5 },
};

export function coutEur(modele: string, tokensEntree: number, tokensSortie: number): number {
  const t = TARIFS[modele] ?? { entree: 3, sortie: 15 };
  return Math.round(((tokensEntree * t.entree + tokensSortie * t.sortie) / 1_000_000) * 1_000_000) / 1_000_000;
}

/** Appelle le modèle (réponse JSON attendue) : Anthropic si ANTHROPIC_API_KEY existe, sinon Mistral si MISTRAL_API_KEY, sinon ErreurRepli. */
export async function appelerModele(systeme: string, utilisateur: string, maxTokens = 1200): Promise<ResultatModele> {
  const cleAnthropic = env("ANTHROPIC_API_KEY");
  if (cleAnthropic) {
    const modele = env("IA_MODELE") ?? "claude-sonnet-5";
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": cleAnthropic, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      // Pas de `temperature` : l'API la refuse pour cette génération de modèles (HTTP 400 « deprecated for this model »).
      body: JSON.stringify({ model: modele, max_tokens: maxTokens, system: systeme, messages: [{ role: "user", content: utilisateur }] }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!r.ok) throw new Error(`Anthropic : HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = (await r.json()) as { content: { type: string; text?: string }[]; stop_reason?: string; usage: { input_tokens: number; output_tokens: number } };
    const texte = j.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
    // Réponse sans texte (arrêt sur max_tokens, refus, bloc d'un autre type) : on trace la forme brute pour comprendre.
    if (!texte.trim()) console.error("modèle : réponse sans texte", JSON.stringify({ stop_reason: j.stop_reason, blocs: j.content.map((c) => c.type), usage: j.usage }).slice(0, 400));
    return { texte, tokensEntree: j.usage.input_tokens, tokensSortie: j.usage.output_tokens, coutEur: coutEur(modele, j.usage.input_tokens, j.usage.output_tokens), modele };
  }
  const cleMistral = env("MISTRAL_API_KEY");
  if (cleMistral) {
    const modele = env("IA_MODELE_REPLI") ?? "mistral-large-latest";
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${cleMistral}`, "content-type": "application/json" },
      body: JSON.stringify({ model: modele, temperature: 0.1, max_tokens: maxTokens, response_format: { type: "json_object" }, messages: [{ role: "system", content: systeme }, { role: "user", content: utilisateur }] }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!r.ok) throw new Error(`Mistral : HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = (await r.json()) as { choices: { message: { content: string } }[]; usage: { prompt_tokens: number; completion_tokens: number } };
    const texte = j.choices[0]?.message.content ?? "";
    return { texte, tokensEntree: j.usage.prompt_tokens, tokensSortie: j.usage.completion_tokens, coutEur: coutEur(modele, j.usage.prompt_tokens, j.usage.completion_tokens), modele };
  }
  throw new ErreurRepli("aucune clé de modèle configurée");
}

/** Extrait l'objet JSON d'une réponse de modèle (clôtures ``` tolérées). */
export function extraireJson(texte: string): unknown {
  const sans = texte.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(sans);
  } catch {
    const debut = sans.indexOf("{");
    const fin = sans.lastIndexOf("}");
    if (debut >= 0 && fin > debut) return JSON.parse(sans.slice(debut, fin + 1));
    throw new Error("réponse du modèle non JSON");
  }
}

export interface Quota {
  autorise: boolean;
  motif: string | null;
  cout_jour: number;
  budget_jour: number;
}

export function verifierQuota(emp: string): Promise<Quota> {
  return rpcService<Quota>("verifier_quota", { p_empreinte: emp, p_budget_jour: budgetJour() });
}

/** Journal analyste_question et ia_usage ; une erreur de journal n'empêche pas la réponse (elle est tracée). */
export async function journaliser(fonction: "analyste" | "expliquer-ecart", emp: string, question: string | null, sql: string | null, statut: string, cout: number, dureeMs: number, tokensEntree: number, tokensSortie: number): Promise<void> {
  try {
    await rpcService("journaliser_ia", { p_fonction: fonction, p_empreinte: emp, p_question: question ?? "", p_sql: sql, p_statut: statut, p_cout: cout, p_duree_ms: dureeMs, p_tokens_entree: tokensEntree, p_tokens_sortie: tokensSortie });
  } catch (erreur) {
    console.error("journal", erreur instanceof Error ? erreur.message : erreur);
  }
}

interface Referentiels {
  agences: { code: string; nom_bassin: string; departement: string; ouverture: string }[];
  canaux: { code: string; libelle: string }[];
  produits: { code: string; libelle: string; famille: string }[];
  journee: string | null;
}

let referentielsCache: { valeur: Referentiels; expire: number } | null = null;

/** Référentiels (agences, canaux, produits) et journée publiée, transmis au modèle pour traduire les codes ; cache 10 minutes. */
export async function referentiels(): Promise<Referentiels> {
  if (referentielsCache && referentielsCache.expire > Date.now()) return referentielsCache.valeur;
  const [agences, canaux, produits, fraicheur] = await Promise.all([
    lireVue<Referentiels["agences"][number]>("dim_agence", "select=code,nom_bassin,departement,ouverture&order=code"),
    lireVue<Referentiels["canaux"][number]>("dim_canal", "select=code,libelle&order=code"),
    lireVue<Referentiels["produits"][number]>("dim_produit", "select=code,libelle,famille&order=code"),
    lireVue<{ date_reference: string | null }>("mart_fraicheur", "select=date_reference&source=eq.journee_simulee"),
  ]);
  const valeur = { agences, canaux, produits, journee: fraicheur[0]?.date_reference ?? null };
  referentielsCache = { valeur, expire: Date.now() + 10 * 60_000 };
  return valeur;
}

export function texteReferentiels(r: Referentiels): string {
  return [
    `Agences (code : bassin, département principal, ouverture) : ${r.agences.map((a) => `${a.code} : ${a.nom_bassin}, ${a.departement}, ${a.ouverture.slice(0, 4)}`).join(" ; ")}. RESEAU = total du réseau.`,
    `Canaux (code : libellé) : ${r.canaux.map((c) => `${c.code} : ${c.libelle}`).join(" ; ")}. TOUS = tous canaux.`,
    `Produits (code : libellé, famille) : ${r.produits.map((p) => `${p.code} : ${p.libelle}, ${p.famille}`).join(" ; ")}. TOUS = tous produits.`,
    `Départements du périmètre : 16, 17, 79, 85, 24, 33, 47, 32, 40, 64 (Sud-Ouest) et 59 (Nord) ; ceux sans agence (79, 85, 24, 47, 32, 64) sont couverts à distance.`,
  ].join("\n");
}
