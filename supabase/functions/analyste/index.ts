/**
 * Edge Function « analyste » (AUTOMATISATIONS.md §2, IA.md) : question en langage naturel, requête SQL écrite par
 * le modèle et validée par les garde-fous, exécution sous analyste_ro (5 s, vues autorisées), rédaction par le
 * modèle à partir des lignes, contrôle que tout nombre de la réponse vient des lignes, quotas, budget, journal.
 * Sortie : { statut: 'ok' | 'refus' | 'repli' | 'erreur', sql?, colonnes?, lignes?, reponse?, sources?, cout_eur, duree_ms, motif_refus?, modele? }.
 */
import { appelerModele, empreinte, ErreurRepli, extraireJson, journaliser, preflight, referentiels, reponseJson, rpcService, texteReferentiels, verifierQuota } from "../_partage/commun.ts";
import { lireEnLectureSeule } from "../_partage/base.ts";
import { nombresAutorises, nombresNonTraces } from "../_partage/nombres.ts";
import { validerSql } from "./garde-fous.ts";
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

const MOTIFS: Record<string, string> = {
  conseil: "Le démonstrateur lit le marché et l'activité simulée, il ne recommande pas : cette question relève d'un conseil.",
  hors_perimetre: "Cette question sort du périmètre du cockpit (pilotage du réseau simulé et marché des territoires).",
  non_couvert: "Ces données ne sont pas couvertes : le cockpit ne contient ni chiffre réel d'entreprise, ni donnée par personne, ni MaPrimeRénov' par commune.",
};

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  const debut = Date.now();
  const duree = () => Date.now() - debut;
  if (req.method !== "POST") return reponseJson({ statut: "erreur", message: "méthode non prise en charge", cout_eur: 0, duree_ms: duree() }, 405);

  let corps: { question?: unknown; contexte?: unknown };
  try {
    corps = (await req.json()) as { question?: unknown; contexte?: unknown };
  } catch {
    return reponseJson({ statut: "erreur", message: "corps JSON attendu", cout_eur: 0, duree_ms: duree() }, 400);
  }
  const question = typeof corps.question === "string" ? corps.question.trim().replace(/\s+/g, " ") : "";
  if (question.length < 3 || question.length > 500) return reponseJson({ statut: "erreur", message: "question de 3 à 500 caractères attendue", cout_eur: 0, duree_ms: duree() }, 400);
  const contexte = corps.contexte && typeof corps.contexte === "object" ? (corps.contexte as { periode?: unknown; agence?: unknown }) : {};
  const contexteTexte = [typeof contexte.periode === "string" ? `période affichée : ${contexte.periode}` : "", typeof contexte.agence === "string" ? `agence affichée : ${contexte.agence}` : ""].filter(Boolean).join(", ");

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
      return reponseJson({ statut: "refus", motif_refus: quota.motif ?? "quota atteint", cout_eur: 0, duree_ms: duree(), budget_jour: quota.budget_jour });
    }

    const [cat, refs] = await Promise.all([catalogue(), referentiels()]);
    const refsTexte = texteReferentiels(refs);
    const systemeSql = promptSql(cat.texte, refsTexte, refs.journee);
    const messageQuestion = `Question : ${question}${contexteTexte ? `\nContexte de l'écran : ${contexteTexte}` : ""}`;

    let sortie: SortieSql;
    try {
      const r = await appelerModele(systemeSql, messageQuestion, 900);
      cumuler(r);
      sortie = extraireJson(r.texte) as SortieSql;
    } catch (erreur) {
      if (erreur instanceof ErreurRepli) {
        await journaliser("analyste", emp, question, null, "repli", 0, duree(), 0, 0);
        return reponseJson({ statut: "repli", motif_refus: "aucun modèle configuré", cout_eur: 0, duree_ms: duree() });
      }
      throw erreur;
    }

    if (sortie.statut === "refus" || typeof sortie.sql !== "string") {
      const motif = typeof sortie.motif === "string" && MOTIFS[sortie.motif] ? sortie.motif : "hors_perimetre";
      await journaliser("analyste", emp, question, null, `refus_${motif}`, cout, duree(), tokensEntree, tokensSortie);
      return reponseJson({ statut: "refus", motif_refus: `${MOTIFS[motif]}${sortie.explication_courte ? ` ${sortie.explication_courte}` : ""}`, cout_eur: cout, duree_ms: duree(), modele: modeleUtilise });
    }

    // Garde-fous, avec une seule correction possible par le modèle.
    let validation = validerSql(sortie.sql, cat.vues);
    if (!validation.ok) {
      const r = await appelerModele(systemeSql, `${messageQuestion}\n\n${promptCorrection(sortie.sql, validation.motif ?? "refus")}`, 900);
      cumuler(r);
      const corrigee = extraireJson(r.texte) as SortieSql;
      if (typeof corrigee.sql === "string") validation = validerSql(corrigee.sql, cat.vues);
      if (!validation.ok) {
        await journaliser("analyste", emp, question, validation.sql, "sql_refusee", cout, duree(), tokensEntree, tokensSortie);
        return reponseJson({ statut: "erreur", message: `La requête proposée a été refusée par les garde-fous (${validation.motif}). Reformulez la question.`, sql: validation.sql, cout_eur: cout, duree_ms: duree(), modele: modeleUtilise });
      }
    }
    const sql = validation.sql;

    let lecture;
    try {
      lecture = await lireEnLectureSeule(sql);
    } catch (erreur) {
      console.error("lecture", erreur instanceof Error ? erreur.message : erreur);
      await journaliser("analyste", emp, question, sql, "sql_erreur", cout, duree(), tokensEntree, tokensSortie);
      return reponseJson({ statut: "erreur", message: "La requête n'a pas pu être exécutée (délai de 5 secondes, vue non autorisée ou erreur de syntaxe). Reformulez la question.", sql, cout_eur: cout, duree_ms: duree(), modele: modeleUtilise });
    }

    const r2 = await appelerModele(promptRedaction(refsTexte), messageRedaction(question, sql, lecture.lignes, lecture.lignes.length), 700);
    cumuler(r2);
    const redaction = extraireJson(r2.texte) as { reponse?: unknown; sources?: unknown };
    let reponse = typeof redaction.reponse === "string" ? redaction.reponse : "";
    const sources = Array.isArray(redaction.sources) ? redaction.sources.filter((s): s is string => typeof s === "string") : [];
    const autorises = nombresAutorises(lecture.lignes, question, lecture.lignes.length);
    const nonTraces = nombresNonTraces(reponse, autorises);
    let statut = "ok";
    if (!reponse || nonTraces.length > 0) {
      statut = "ok_redaction_rejetee";
      reponse = `Je ne peux pas répondre de façon fiable à cette question : la rédaction contenait ${nonTraces.length ? `un nombre absent des lignes (${nonTraces.slice(0, 3).join(", ")})` : "aucune phrase exploitable"}. Les lignes ci-dessus sont exactes et restent la réponse.`;
    }
    await journaliser("analyste", emp, question, sql, statut, cout, duree(), tokensEntree, tokensSortie);
    return reponseJson({ statut: "ok", sql, colonnes: lecture.colonnes, lignes: lecture.lignes, reponse, sources, cout_eur: cout, duree_ms: duree(), modele: modeleUtilise, redaction_rejetee: statut !== "ok", budget_jour: quota.budget_jour });
  } catch (erreur) {
    console.error("analyste", erreur instanceof Error ? erreur.stack ?? erreur.message : erreur);
    await journaliser("analyste", emp, question, null, "erreur", cout, duree(), tokensEntree, tokensSortie);
    return reponseJson({ statut: "erreur", message: "Le service analyste est momentanément indisponible.", cout_eur: cout, duree_ms: duree() }, 500);
  }
});
