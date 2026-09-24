/**
 * Edge Function « analyste » (AUTOMATISATIONS.md §2, IA.md) : question en langage naturel, requête SQL écrite par
 * le modèle et validée par les garde-fous, exécution sous analyste_ro (5 s, vues autorisées), rédaction par le
 * modèle à partir des lignes, contrôle que tout nombre de la réponse vient des lignes, quotas, budget, journal.
 * Sortie : { statut: 'ok' | 'refus' | 'quota' | 'repli' | 'erreur', sql?, colonnes?, lignes?, reponse?, sources?, nature?, cout_eur, duree_ms, motif?, motif_refus?, modele? }.
 * Relecture du 19 septembre : la journée publiée est transmise à la rédaction, les sources (vues, période, nature
 * simulée ou réelle) sont calculées par le programme, la limite de 200 lignes est imposée par une sous-requête,
 * le quota a son propre statut, le contexte de l'écran n'est plus transmis (la question se suffit).
 */
import { appelerModele, empreinte, ErreurRepli, extraireJson, journaliser, preflight, referentiels, reponseJson, rpcService, texteReferentiels, traduireLignes, verifierQuota } from "../_partage/commun.ts";
import { lireEnLectureSeule } from "../_partage/base.ts";
import { attributionsIncoherentes, nombresAutorises, nombresNonTraces, signesIncoherents } from "../_partage/nombres.ts";
import { LIMITE_LIGNES, sourcesCitees, validerSql } from "./garde-fous.ts";
import { messageRedaction, promptCorrection, promptRedaction, promptSql } from "./prompts.ts";

interface Catalogue {
  texte: string;
  vues: string[];
}
let catalogueCache: { valeur: Catalogue; expire: number } | null = null;

/** Catalogue des vues lisibles par analyste_ro, généré depuis les commentaires SQL (IA.md §2) ; cache 10 minutes. */
async function catalogue(): Promise<Catalogue> {
  if (catalogueCache && catalogueCache.expire > Date.now()) return catalogueCache.valeur;
  const brut = await rpcService<{ vue: string; description: string | null; colonnes: { nom: string; type: string; description: string | null }[] }[]>("catalogue_analyste", {});
  const vues = brut.map((v) => v.vue);
  const texte = brut.map((v) => `### ${v.vue}\n${v.description ?? ""}\nColonnes : ${v.colonnes.map((c) => `${c.nom} (${c.type})${c.description ? ` : ${c.description}` : ""}`).join(", ")}`).join("\n\n");
  catalogueCache = { valeur: { texte, vues }, expire: Date.now() + 10 * 60_000 };
  return catalogueCache.valeur;
}

interface SortieSql {
  statut?: string;
  sql?: string;
  motif?: string;
  explication_courte?: string;
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function moisLibelle(date: string): string {
  return `${MOIS[Number(date.slice(5, 7)) - 1] ?? date.slice(5, 7)} ${date.slice(0, 4)}`;
}

function jourLibelle(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/** Nature des données lues : marché réel (vues mart_marche_*), activité simulée (les autres), ou les deux. */
function natureDesSources(vues: readonly string[]): "simule" | "reel" | "mixte" {
  const reelles = vues.filter((v) => v.startsWith("mart_marche_")).length;
  if (reelles === 0) return "simule";
  return reelles === vues.length ? "reel" : "mixte";
}

/** Période couverte par les lignes (dates AAAA-MM ou AAAA-MM-JJ trouvées dans les valeurs), bornée à la journée publiée. */
function periodeDesLignes(lignes: readonly Record<string, unknown>[], journee: string | null): string {
  const dates: string[] = [];
  for (const l of lignes) for (const v of Object.values(l)) if (typeof v === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(v)) dates.push(v);
  const reference = journee ? `journée publiée du ${jourLibelle(journee)}` : "journée publiée";
  if (dates.length === 0) return reference;
  dates.sort();
  const min = dates[0]!;
  const max = dates[dates.length - 1]!;
  const enCours = journee ? max.slice(0, 7) >= journee.slice(0, 7) : false;
  const debut = min.slice(0, 7) === max.slice(0, 7) ? moisLibelle(min) : `${moisLibelle(min)} à ${moisLibelle(max)}`;
  return enCours ? `${debut} (à date, ${reference})` : debut;
}

/** Espaces insécables entre les milliers et avant %, € et leurs multiples, dans la prose du modèle. */
function typographie(texte: string): string {
  return texte.replace(/(\d) (?=\d{3}(?!\d))/g, "$1\u00A0").replace(/(\d) (?=%|€|k€|M€)/g, "$1\u00A0");
}

const MOTIFS: Record<string, string> = {
  conseil: "Le démonstrateur lit le marché et l'activité simulée, il ne recommande pas : cette question relève d'un conseil.",
  hors_perimetre: "Cette question sort du périmètre du cockpit (pilotage du réseau simulé et marché des territoires).",
  non_couvert: "Ces données ne sont pas couvertes : le cockpit ne contient ni chiffre réel d'entreprise, ni donnée par personne, ni MaPrimeRénov' par commune.",
  ecriture: "Le cockpit est en lecture seule : aucune écriture, suppression ou modification n'est possible.",
};

Deno.serve(async (req: Request) => {
  // Réponses avec l'en-tête CORS calculé pour l'origine de la requête (commun.ts).
  const repondre = (corps: unknown, statut = 200) => reponseJson(corps, statut, req);
  const pre = preflight(req);
  if (pre) return pre;
  const debut = Date.now();
  const duree = () => Date.now() - debut;
  if (req.method !== "POST") return repondre({ statut: "erreur", message: "méthode non prise en charge", cout_eur: 0, duree_ms: duree() }, 405);

  let corps: { question?: unknown };
  try {
    corps = (await req.json()) as { question?: unknown };
  } catch {
    return repondre({ statut: "erreur", message: "corps JSON attendu", cout_eur: 0, duree_ms: duree() }, 400);
  }
  const question = typeof corps.question === "string" ? corps.question.trim().replace(/\s+/g, " ") : "";
  if (question.length < 3 || question.length > 500) return repondre({ statut: "erreur", message: "question de 3 à 500 caractères attendue", cout_eur: 0, duree_ms: duree() }, 400);

  const emp = await empreinte(req);
  let tokensEntree = 0;
  let tokensSortie = 0;
  let cout = 0;
  let modeleUtilise: string | null = null;
  const cumuler = (r: { tokensEntree: number; tokensSortie: number; coutEur: number; modele: string }) => {
    tokensEntree += r.tokensEntree;
    tokensSortie += r.tokensSortie;
    cout = Math.round((cout + r.coutEur) * 1_000_000) / 1_000_000;
    modeleUtilise = r.modele;
  };

  try {
    const quota = await verifierQuota(emp);
    if (!quota.autorise) {
      await journaliser("analyste", emp, question, null, "quota", 0, duree(), 0, 0);
      return repondre({ statut: "quota", motif_refus: quota.motif ?? "quota atteint", cout_eur: 0, duree_ms: duree(), budget_jour: quota.budget_jour, cout_jour: quota.cout_jour });
    }

    const [cat, refs] = await Promise.all([catalogue(), referentiels()]);
    const refsTexte = texteReferentiels(refs);
    const systemeSql = promptSql(cat.texte, refsTexte, refs.journee);
    const messageQuestion = `Question : ${question}`;

    let sortie: SortieSql;
    try {
      const r = await appelerModele(systemeSql, messageQuestion, 3000);
      cumuler(r);
      try {
        sortie = extraireJson(r.texte) as SortieSql;
      } catch (erreur) {
        console.error("analyste : requête non JSON", r.texte.slice(0, 300).replace(/\s+/g, " "));
        throw erreur;
      }
    } catch (erreur) {
      if (erreur instanceof ErreurRepli) {
        await journaliser("analyste", emp, question, null, "repli", 0, duree(), 0, 0);
        return repondre({ statut: "repli", motif_refus: "aucun modèle configuré", cout_eur: 0, duree_ms: duree() });
      }
      throw erreur;
    }

    if (sortie.statut === "refus" || typeof sortie.sql !== "string") {
      const motif = typeof sortie.motif === "string" && MOTIFS[sortie.motif] ? sortie.motif : "hors_perimetre";
      await journaliser("analyste", emp, question, null, `refus_${motif}`, cout, duree(), tokensEntree, tokensSortie);
      return repondre({ statut: "refus", motif, motif_refus: MOTIFS[motif], explication_courte: typeof sortie.explication_courte === "string" ? sortie.explication_courte : null, cout_eur: cout, duree_ms: duree(), modele: modeleUtilise, budget_jour: quota.budget_jour, cout_jour: quota.cout_jour });
    }

    // Garde-fous, avec une seule correction possible par le modèle.
    let validation = validerSql(sortie.sql, cat.vues);
    if (!validation.ok) {
      const r = await appelerModele(systemeSql, `${messageQuestion}\n\n${promptCorrection(sortie.sql, validation.motif ?? "refus")}`, 3000);
      cumuler(r);
      const corrigee = extraireJson(r.texte) as SortieSql;
      if (typeof corrigee.sql === "string") validation = validerSql(corrigee.sql, cat.vues);
      if (!validation.ok) {
        await journaliser("analyste", emp, question, validation.sql, "sql_refusee", cout, duree(), tokensEntree, tokensSortie);
        return repondre({ statut: "erreur", message: `La requête proposée a été refusée par les garde-fous (${validation.motif}). Reformulez la question.`, sql: validation.sql, cout_eur: cout, duree_ms: duree(), modele: modeleUtilise });
      }
    }
    const sql = validation.sql;
    // 200 lignes au plus quoi qu'il arrive : le LIMIT du modèle peut être dans une sous-requête ou une CTE.
    const sqlExecute = `select * from (${sql}) as requete_analyste limit ${LIMITE_LIGNES}`;

    let lecture;
    try {
      const lue = await lireEnLectureSeule(sqlExecute);
      // Codes traduits en libellés avant tout : le modèle recopie des noms, le navigateur affiche des noms.
      lecture = { colonnes: lue.colonnes, lignes: traduireLignes(lue.lignes, refs) };
    } catch (erreur) {
      console.error("lecture", erreur instanceof Error ? erreur.message : erreur);
      await journaliser("analyste", emp, question, sql, "sql_erreur", cout, duree(), tokensEntree, tokensSortie);
      return repondre({ statut: "erreur", message: "La requête n'a pas pu être exécutée (délai de 5 secondes, vue non autorisée ou erreur de syntaxe). Reformulez la question.", sql, cout_eur: cout, duree_ms: duree(), modele: modeleUtilise });
    }

    const r2 = await appelerModele(promptRedaction(refsTexte, refs.journee ? jourLibelle(refs.journee) : null), messageRedaction(question, sql, lecture.lignes, lecture.lignes.length), 2500);
    cumuler(r2);
    // Le modèle répond en JSON ; s'il rend la prose nue, elle vaut réponse (le contrôle des nombres s'applique de même).
    let brut = "";
    try {
      const redaction = extraireJson(r2.texte) as { reponse?: unknown };
      brut = typeof redaction.reponse === "string" ? redaction.reponse : "";
    } catch {
      console.warn("analyste : rédaction hors JSON, texte pris tel quel", r2.texte.slice(0, 120).replace(/\s+/g, " "));
      brut = r2.texte.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    }
    let reponse = typographie(brut.trim());
    // Sources calculées par le programme, pas par le modèle : vues citées par la requête validée, période des lignes
    // bornée à la journée publiée, nature des données (simulées, marché réel, ou les deux).
    const vues = [...new Set(sourcesCitees(sql).tables.map((t) => (t.startsWith("buta.") ? t.slice(5) : t)).filter((t) => cat.vues.includes(t)))];
    const nature = natureDesSources(vues);
    const sources = [
      `vues : ${vues.join(", ") || "aucune"}`,
      `période : ${periodeDesLignes(lecture.lignes, refs.journee)}`,
      nature === "reel" ? "marché réel (Insee 2022, ADEME, RTE)" : nature === "mixte" ? "données d'activité simulées et marché réel (Insee 2022, ADEME, RTE)" : "données d'activité simulées",
    ];
    // Les référentiels et la journée publiée sont versés en chiffres bruts : un numéro de département ou une année
    // cités dans la réponse sont des faits, pas des inventions ; un signe contraire aux lignes est un défaut.
    // Faits du référentiel transmis en prose au modèle : départements du périmètre, historique repris depuis janvier 2025.
    // Les 96 codes de département n'en font pas partie (ils autoriseraient tous les nombres de 1 à 95) : seuls ceux du périmètre.
    const { departements: _departements, ...refsSansDepartements } = refs;
    const faitsReferentiels = { ...refsSansDepartements, departements_perimetre: ["16", "17", "79", "85", "24", "33", "47", "32", "40", "64", "59"], historique_depuis: "2025-01" };
    const autorises = nombresAutorises(lecture.lignes, question, lecture.lignes.length, faitsReferentiels);
    const horsLignes = nombresAutorises([], question, lecture.lignes.length, faitsReferentiels);
    const nonTraces = [...nombresNonTraces(reponse, autorises), ...signesIncoherents(reponse, lecture.lignes)];
    // Attribution : une phrase qui nomme une ligne ne cite que ses nombres (« Le Born (123 994 €) » avec la valeur du Marensin est rejeté).
    const malAttribues = attributionsIncoherentes(reponse, lecture.lignes, horsLignes);
    let statut = "ok";
    if (!reponse || nonTraces.length > 0 || malAttribues.length > 0) {
      statut = "ok_redaction_rejetee";
      const motif = nonTraces.length ? `un nombre absent des lignes ou au signe contraire (${nonTraces.slice(0, 3).join(", ")})` : malAttribues.length ? `un nombre attribué à une autre ligne que la sienne (${malAttribues.slice(0, 3).join(", ")})` : "aucune phrase exploitable";
      console.warn("analyste : rédaction rejetée", motif);
      reponse = `Je ne peux pas répondre de façon fiable à cette question : la rédaction contenait ${motif}. Les lignes ci-dessous sont exactes et restent la réponse.`;
    }
    await journaliser("analyste", emp, question, sql, statut, cout, duree(), tokensEntree, tokensSortie);
    return repondre({ statut: "ok", sql, colonnes: lecture.colonnes, lignes: lecture.lignes, reponse, sources, nature, cout_eur: cout, duree_ms: duree(), modele: modeleUtilise, redaction_rejetee: statut !== "ok", budget_jour: quota.budget_jour, cout_jour: quota.cout_jour });
  } catch (erreur) {
    console.error("analyste", erreur instanceof Error ? erreur.stack ?? erreur.message : erreur);
    await journaliser("analyste", emp, question, null, "erreur", cout, duree(), tokensEntree, tokensSortie);
    return repondre({ statut: "erreur", message: "Le service analyste est momentanément indisponible.", cout_eur: cout, duree_ms: duree() }, 500);
  }
});
