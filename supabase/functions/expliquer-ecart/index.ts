/**
 * Edge Function « expliquer-ecart » (AUTOMATISATIONS.md §2, IA.md §3) : lit les faits d'un périmètre et d'un mois
 * dans mart_ecarts, mart_kpi_mensuel, mart_funnel, mart_ventes_produit et mart_alertes, demande au modèle constat,
 * causes, action et sources, vérifie que tout nombre vient des faits, met en cache 24 h, journalise.
 * Repli (statut « repli ») : le front affiche les phrases par règles (src/lib/phrases.ts).
 */
import { appelerModele, budgetJour, ecrireTable, empreinte, ErreurRepli, extraireJson, journaliser, lireVue, preflight, referentiels, reponseJson, rpcService, texteReferentiels } from "../_partage/commun.ts";
import { nombresAutorises, nombresNonTraces } from "../_partage/nombres.ts";
import { messageExplication, promptExplication } from "./prompts.ts";

interface Cause {
  texte: string;
  fait: string;
  source: string;
}
interface Explication {
  constat: string;
  causes: Cause[];
  action: string;
  sources: string[];
}

function moisPrecedentAnnee(mois: string): string {
  return `${Number(mois.slice(0, 4)) - 1}${mois.slice(4)}`;
}

async function faitsDe(agence: string, mois: string): Promise<Record<string, unknown>> {
  const m = `${mois}-01`;
  const m1 = `${moisPrecedentAnnee(mois)}-01`;
  const [ecarts, kpi, kpiN1, funnel, funnelN1, produits, alertes] = await Promise.all([
    lireVue<Record<string, unknown>>("mart_ecarts", `agence=eq.${agence}&mois=eq.${m}&select=comparaison,ca_realise,ca_comparaison,ecart_total,effet_volume,effet_mix,effet_prix,effet_remise,residuel,ventes,ventes_comparaison,taux_remise,taux_remise_comparaison,prorata,comparaison_disponible`),
    lireVue<Record<string, unknown>>("mart_kpi_mensuel", `agence=eq.${agence}&mois=eq.${m}&select=ventes,ca_signe,ca_pose,taux_marge,marge_brute,panier_moyen,taux_remise,taux_annulation,couts_acquisition,marge_apres_acquisition,resultat,objectif_ca,ecart_objectif_pct,prorata,jours_publies,jours_mois,leads`),
    lireVue<Record<string, unknown>>("mart_kpi_mensuel", `agence=eq.${agence}&mois=eq.${m1}&select=ventes,ca_signe,taux_marge,panier_moyen,taux_remise,taux_annulation,leads`),
    lireVue<Record<string, unknown>>("mart_funnel", `agence=eq.${agence}&canal=eq.TOUS&mois=eq.${m}&select=leads,rdv_tenus,devis,signatures,taux_rdv,taux_devis,taux_signature,taux_conversion,cohorte_mature`),
    lireVue<Record<string, unknown>>("mart_funnel", `agence=eq.${agence}&canal=eq.TOUS&mois=eq.${m1}&select=leads,rdv_tenus,devis,signatures,taux_rdv,taux_devis,taux_signature,taux_conversion,cohorte_mature`),
    lireVue<Record<string, unknown>>("mart_ventes_produit", `agence=eq.${agence}&mois=eq.${m}&produit=neq.TOUS&order=ca_signe.desc&limit=8&select=produit,ventes,ca_signe,taux_marge,taux_remise`),
    lireVue<Record<string, unknown>>("mart_alertes", agence === "RESEAU" ? "select=code,agence,nom_bassin,gravite,valeur,texte" : `agence=eq.${agence}&select=code,agence,nom_bassin,gravite,valeur,texte`),
  ]);
  return { agence, mois, ecarts, indicateurs_mois: kpi[0] ?? null, indicateurs_mois_n1: kpiN1[0] ?? null, funnel_cohorte_mois: funnel[0] ?? null, funnel_cohorte_mois_n1: funnelN1[0] ?? null, ventes_par_produit: produits, alertes };
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  const debut = Date.now();
  const duree = () => Date.now() - debut;
  if (req.method !== "POST") return reponseJson({ statut: "erreur", message: "méthode non prise en charge", cout_eur: 0, duree_ms: duree() }, 405);

  let corps: { perimetre?: unknown; mois?: unknown; indicateur?: unknown };
  try {
    corps = (await req.json()) as typeof corps;
  } catch {
    return reponseJson({ statut: "erreur", message: "corps JSON attendu", cout_eur: 0, duree_ms: duree() }, 400);
  }
  const perimetre = typeof corps.perimetre === "string" ? corps.perimetre : "";
  const mois = typeof corps.mois === "string" ? corps.mois : "";
  const indicateur = typeof corps.indicateur === "string" ? corps.indicateur : "";
  if (!/^(reseau|[A-Z]{3})$/.test(perimetre) || !/^\d{4}-\d{2}$/.test(mois) || !["CA", "MARGE", "CONVERSION"].includes(indicateur)) {
    return reponseJson({ statut: "erreur", message: "paramètres attendus : perimetre ('reseau' ou code agence), mois (AAAA-MM), indicateur (CA, MARGE, CONVERSION)", cout_eur: 0, duree_ms: duree() }, 400);
  }
  const agence = perimetre === "reseau" ? "RESEAU" : perimetre;
  const emp = await empreinte(req);

  try {
    const refs = await referentiels();
    const cle = `${agence}|${mois}|${indicateur}|${refs.journee ?? "sans-journee"}`;
    const enCache = await lireVue<{ reponse: Explication }>("explication_cache", `cle=eq.${encodeURIComponent(cle)}&expire_le=gt.${encodeURIComponent(new Date().toISOString())}&select=reponse`);
    const cache = enCache[0]?.reponse;
    if (cache) {
      return reponseJson({ statut: "ok", explication: { constat: cache.constat, causes: cache.causes, action: cache.action }, sources: cache.sources, cout_eur: 0, duree_ms: duree(), cache: true });
    }

    const quota = await rpcService<{ autorise: boolean; motif: string | null }>("verifier_quota", { p_empreinte: emp, p_budget_jour: budgetJour() });
    if (!quota.autorise) return reponseJson({ statut: "repli", motif_refus: quota.motif ?? "quota atteint", cout_eur: 0, duree_ms: duree() });

    const faits = await faitsDe(agence, mois);
    const perimetreLibelle = agence === "RESEAU" ? "le réseau" : refs.agences.find((a) => a.code === agence)?.nom_bassin ?? agence;
    let r;
    try {
      r = await appelerModele(promptExplication(texteReferentiels(refs)), messageExplication(perimetreLibelle, mois, indicateur, faits), 900);
    } catch (erreur) {
      if (erreur instanceof ErreurRepli) return reponseJson({ statut: "repli", motif_refus: "aucun modèle configuré", cout_eur: 0, duree_ms: duree() });
      throw erreur;
    }
    const sortie = extraireJson(r.texte) as Partial<Explication>;
    const explication: Explication = {
      constat: typeof sortie.constat === "string" ? sortie.constat : "",
      causes: Array.isArray(sortie.causes) ? sortie.causes.filter((c): c is Cause => !!c && typeof c === "object" && typeof (c as Cause).texte === "string").slice(0, 3).map((c) => ({ texte: c.texte, fait: String(c.fait ?? ""), source: String(c.source ?? "") })) : [],
      action: typeof sortie.action === "string" ? sortie.action : "",
      sources: Array.isArray(sortie.sources) ? sortie.sources.filter((s): s is string => typeof s === "string") : [],
    };
    const texteComplet = [explication.constat, ...explication.causes.map((c) => `${c.texte} ${c.fait}`), explication.action].join("\n");
    const nonTraces = nombresNonTraces(texteComplet, nombresAutorises(faits, `${mois}`));
    await journaliser("expliquer-ecart", emp, null, null, nonTraces.length || !explication.constat ? "repli_nombres" : "ok", r.coutEur, duree(), r.tokensEntree, r.tokensSortie);
    if (!explication.constat || nonTraces.length > 0) {
      console.warn("explication rejetée", nonTraces.join(", "));
      return reponseJson({ statut: "repli", motif_refus: `nombre absent des faits : ${nonTraces.slice(0, 3).join(", ") || "réponse vide"}`, cout_eur: r.coutEur, duree_ms: duree(), modele: r.modele });
    }
    await ecrireTable("explication_cache", { cle, reponse: explication, expire_le: new Date(Date.now() + 24 * 3_600_000).toISOString() }).catch((e) => console.error("cache", e instanceof Error ? e.message : e));
    return reponseJson({ statut: "ok", explication: { constat: explication.constat, causes: explication.causes, action: explication.action }, sources: explication.sources, cout_eur: r.coutEur, duree_ms: duree(), modele: r.modele, cache: false });
  } catch (erreur) {
    console.error("expliquer-ecart", erreur instanceof Error ? erreur.stack ?? erreur.message : erreur);
    return reponseJson({ statut: "repli", motif_refus: "service momentanément indisponible", cout_eur: 0, duree_ms: duree() });
  }
});
