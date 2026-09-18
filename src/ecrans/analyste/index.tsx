import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Copy, Send } from "lucide-react";
import { useFiltres } from "@/app/filtres";
import { useVue } from "@/donnees/useVue";
import { poserQuestion, type ReponseIa } from "@/donnees/ia";
import { Carte } from "@/composants/Carte";
import { Tableau, type Colonne } from "@/composants/Tableau";
import { Badge } from "@/composants/Badge";
import { Pastille } from "@/composants/Pastille";
import { LigneSources } from "@/composants/LigneSources";
import { formatDateCourte, formatMontant, formatNombre } from "@/lib/format";

/** Six suggestions (IA.md §5, jeu d'évaluation) : les histoires du jeu et le marché réel. */
const SUGGESTIONS = [
  "Quelle agence a le meilleur résultat d'agence sur 2026 ?",
  "Le taux de marge de la Saintonge a-t-il baissé depuis avril 2026 ?",
  "Quelle agence a le coût par vente le plus élevé sur les cohortes de mars à mai 2026 ?",
  "Combien de résidences principales sont chauffées au fioul en Charente-Maritime ?",
  "Quel est l'atterrissage 2026 du réseau et sa probabilité d'atteinte ?",
  "Combien de dossiers sont à qualifier dans l'agence Nord ?",
];
const CLE_HISTORIQUE = "buta.analyste.historique";
const HISTORIQUE_MAX = 10;

interface Echange {
  question: string;
  reponse: ReponseIa;
  a: string;
}

function lireHistorique(): Echange[] {
  try {
    const brut = window.localStorage.getItem(CLE_HISTORIQUE);
    return brut ? (JSON.parse(brut) as Echange[]) : [];
  } catch {
    return [];
  }
}

function ecrireHistorique(h: Echange[]): void {
  try {
    window.localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(h.slice(0, HISTORIQUE_MAX)));
  } catch {
    // Stockage indisponible (navigation privée) : l'historique reste en mémoire.
  }
}

/** Valeur d'une cellule telle que renvoyée par la vue : nombre formaté à la française, texte tel quel, vide pour null. */
function afficher(v: unknown): string {
  if (v === null || v === undefined) return "n. d.";
  if (typeof v === "number") return Number.isInteger(v) ? formatNombre(v) : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v);
  if (typeof v === "boolean") return v ? "oui" : "non";
  return String(v);
}

export function EcranAnalyste() {
  const { periode, agence, journeePubliee } = useFiltres();
  const usage = useVue("mart_ia_usage", { ordre: "-jour", limite: 10 });
  const [question, setQuestion] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [courant, setCourant] = useState<Echange | null>(null);
  const [historique, setHistorique] = useState<Echange[]>([]);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    setHistorique(lireHistorique());
  }, []);

  const aujourdHui = new Date().toISOString().slice(0, 10);
  const coutDuJour = (usage.donnees ?? []).filter((u) => u.jour === aujourdHui).reduce((s, u) => s + u.cout_eur, 0);
  const appelsDuJour = (usage.donnees ?? []).filter((u) => u.jour === aujourdHui).reduce((s, u) => s + u.appels, 0);
  const budget = courant?.reponse.budget_jour ?? historique.find((h) => h.reponse.budget_jour)?.reponse.budget_jour ?? null;

  async function poser(texte: string) {
    const q = texte.trim();
    if (q.length < 3 || enCours) return;
    setEnCours(true);
    setQuestion(q);
    try {
      const reponse = await poserQuestion(q, { periode: periode.param, agence });
      const echange = { question: q, reponse, a: new Date().toISOString() };
      setCourant(echange);
      const suivant = [echange, ...historique.filter((h) => h.question !== q)].slice(0, HISTORIQUE_MAX);
      setHistorique(suivant);
      ecrireHistorique(suivant);
    } finally {
      setEnCours(false);
    }
  }

  function soumettre(e: FormEvent) {
    e.preventDefault();
    void poser(question);
  }

  async function copierRequete() {
    if (!courant?.reponse.sql) return;
    try {
      await navigator.clipboard.writeText(courant.reponse.sql);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers indisponible : rien à faire, la requête reste visible.
    }
  }

  const r = courant?.reponse ?? null;
  const colonnes = useMemo<Colonne<Record<string, unknown>>[]>(() => (r?.colonnes ?? []).map((c) => ({
    cle: c, libelle: c.replace(/_/g, " "), numerique: (r?.lignes ?? []).some((l) => typeof l[c] === "number"), valeur: (l) => (l[c] as string | number | null | undefined) ?? null, rendu: (l) => afficher(l[c]),
  })), [r]);
  const lignes = useMemo(() => (r?.lignes ?? []).map((l, i) => ({ ...l, __i: i })), [r]);

  return (
    <div className="flex flex-col gap-[var(--esp-5)]">
      <header className="flex flex-wrap items-end justify-between gap-[var(--esp-3)]">
        <div>
          <h1 className="font-serif-titre text-[32px] leading-[1.1] text-texte max-md:text-[26px]">Posez la question au cockpit</h1>
          <p className="mt-1 text-[13px] text-texte-2">Le modèle écrit la requête SQL sur les vues autorisées, la base répond, le modèle rédige sans jamais calculer · <Badge variante="simule">simulé</Badge></p>
        </div>
        <p className="text-[12px] text-texte-3">
          Coût du jour : {formatMontant(coutDuJour).replace(/^0 €$/, "0 €")}{budget ? ` sur ${formatMontant(budget)}` : ""} · {formatNombre(appelsDuJour)} appel{appelsDuJour > 1 ? "s" : ""}
        </p>
      </header>

      <Carte>
        <form onSubmit={soumettre} className="flex flex-col gap-[var(--esp-3)]">
          <label htmlFor="question-analyste" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">Votre question (500 caractères au plus)</label>
          <div className="flex flex-col gap-[var(--esp-2)] sm:flex-row">
            <textarea id="question-analyste" value={question} onChange={(e) => setQuestion(e.target.value.slice(0, 500))} rows={2} disabled={enCours}
              placeholder="Quelle agence a le pire coût par vente en août 2026 ?"
              className="min-h-[56px] flex-1 resize-y rounded-[10px] border border-bordure bg-surface-2 px-[var(--esp-3)] py-[10px] text-[15px] text-texte outline-none placeholder:text-texte-3 focus:border-ambre" />
            <button type="submit" disabled={enCours || question.trim().length < 3}
              className="inline-flex h-[44px] items-center justify-center gap-[8px] rounded-[10px] bg-ambre px-[var(--esp-4)] text-[14px] font-semibold text-fond transition-opacity disabled:opacity-50">
              <Send size={15} strokeWidth={1.5} aria-hidden="true" />{enCours ? "Le cockpit cherche…" : "Demander"}
            </button>
          </div>
          <div className="flex flex-wrap gap-[6px]">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" disabled={enCours} onClick={() => void poser(s)}
                className="rounded-full border border-bordure px-[10px] py-[4px] text-[12px] text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte disabled:opacity-50">{s}</button>
            ))}
          </div>
        </form>
      </Carte>

      {r && courant && (
        <div className="flex flex-col gap-[var(--esp-3)]">
          {r.statut === "ok" && (
            <>
              <Carte titre="La réponse" sousTitre={`« ${courant.question} »`} actions={<Pastille statut={r.redaction_rejetee ? "attention" : "succes"} texte={r.redaction_rejetee ? "rédaction rejetée, lignes exactes" : "chaque nombre vérifié dans les lignes"} />}>
                <p className="text-[15px] leading-relaxed text-texte">{r.reponse}</p>
                {(r.sources ?? []).length > 0 && <p className="mt-[var(--esp-2)] text-[12px] text-texte-3">Sources : {(r.sources ?? []).join(" · ")}</p>}
                <p className="mt-[var(--esp-2)] text-[12px] text-texte-3">
                  {r.modele ?? "modèle"} · {formatNombre(r.duree_ms ?? 0)} ms · coût {r.cout_eur && r.cout_eur >= 0.005 ? formatMontant(r.cout_eur) : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(r.cout_eur ?? 0)} €`}
                </p>
              </Carte>
              <Carte titre="Les chiffres" sousTitre={`${formatNombre(lignes.length)} ligne${lignes.length > 1 ? "s" : ""} renvoyée${lignes.length > 1 ? "s" : ""} par la base (200 au plus), lecture seule sous le rôle analyste_ro`} nu>
                {lignes.length > 0 ? (
                  <Tableau colonnes={colonnes} lignes={lignes} cleLigne={(l) => String(l.__i)} compact nomExport="analyste-lignes" />
                ) : <p className="px-[var(--esp-4)] py-[var(--esp-3)] text-[13px] text-texte-3">Aucune ligne ne correspond.</p>}
              </Carte>
              <details className="rounded-[var(--rayon-carte)] border border-bordure bg-surface p-[var(--esp-3)]">
                <summary className="cursor-pointer text-[13px] text-texte-2">La requête SQL exécutée</summary>
                <div className="mt-[var(--esp-2)] flex flex-col gap-[var(--esp-2)]">
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-[10px] bg-surface-2 p-[var(--esp-3)] font-mono text-[12px] leading-[1.5] text-texte">{r.sql}</pre>
                  <button type="button" onClick={() => void copierRequete()} className="inline-flex w-fit items-center gap-[6px] rounded-[8px] border border-bordure px-[10px] py-[6px] text-[12px] text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte">
                    <Copy size={13} strokeWidth={1.5} aria-hidden="true" />{copie ? "Copiée" : "Copier la requête"}
                  </button>
                </div>
              </details>
            </>
          )}
          {r.statut === "refus" && (
            <Carte titre="Question refusée" sousTitre={`« ${courant.question} »`}>
              <p className="text-[15px] leading-relaxed text-texte">{r.motif_refus}</p>
              <p className="mt-[var(--esp-2)] text-[12px] text-texte-3">L'analyste lit les vues du cockpit ; il ne conseille pas, n'invente pas et ne sort pas de son périmètre.</p>
            </Carte>
          )}
          {r.statut === "repli" && (
            <Carte titre="Analyste en repli" sousTitre={`« ${courant.question} »`}>
              <p className="text-[15px] leading-relaxed text-texte">Le modèle n'est pas disponible ({r.motif_refus ?? "repli"}). Les écrans du cockpit restent la source : chaque chiffre y a sa fiche et sa requête.</p>
            </Carte>
          )}
          {r.statut === "erreur" && (
            <Carte titre="Pas de réponse" sousTitre={`« ${courant.question} »`}>
              <p className="text-[15px] leading-relaxed text-texte">{r.message ?? "Le service est momentanément indisponible."}</p>
              {r.sql && <pre className="mt-[var(--esp-2)] overflow-x-auto whitespace-pre-wrap rounded-[10px] bg-surface-2 p-[var(--esp-3)] font-mono text-[12px] text-texte-2">{r.sql}</pre>}
            </Carte>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-[var(--esp-3)] lg:grid-cols-12">
        <Carte className="lg:col-span-7" titre="Historique de la session" sousTitre="Dix dernières questions, conservées dans ce navigateur seulement">
          {historique.length === 0 ? <p className="text-[13px] text-texte-3">Aucune question posée pour l'instant.</p> : (
            <ul className="flex flex-col gap-[6px]">
              {historique.map((h) => (
                <li key={h.a} className="flex items-center justify-between gap-[var(--esp-2)]">
                  <button type="button" onClick={() => { setCourant(h); setQuestion(h.question); }} className="truncate text-left text-[13px] text-texte-2 hover:text-texte">{h.question}</button>
                  <Pastille statut={h.reponse.statut === "ok" ? "succes" : h.reponse.statut === "refus" ? "attention" : "neutre"} texte={h.reponse.statut === "ok" ? "répondu" : h.reponse.statut === "refus" ? "refusé" : h.reponse.statut} />
                </li>
              ))}
            </ul>
          )}
        </Carte>
        <Carte className="lg:col-span-5" titre="Garde-fous" sousTitre="Ce que l'analyste ne peut pas faire, par construction">
          <ul className="flex flex-col gap-[6px] text-[13px] leading-[1.45] text-texte-2">
            <li>· Lecture seule : rôle SQL limité aux vues mart_, délai de 5 secondes, 200 lignes au plus.</li>
            <li>· Une seule requête SELECT, validée avant exécution : mots interdits, vues hors liste, schémas système sont refusés.</li>
            <li>· Le modèle ne calcule rien : tout nombre de la réponse est vérifié dans les lignes, sinon la rédaction est rejetée et les lignes restent la réponse.</li>
            <li>· Refus explicites : conseil, hors périmètre, données non couvertes (chiffres réels, personnes, MaPrimeRénov' par commune).</li>
            <li>· Quotas : 5 questions par minute et 20 par jour par adresse hachée, 400 par jour au total, budget quotidien en euros.</li>
          </ul>
        </Carte>
      </div>

      <LigneSources simule sources={[{ nom: "Edge Function analyste, vues mart_ (catalogue généré depuis les commentaires SQL), journal ia_usage", ...(journeePubliee ? { reference: `journée publiée du ${formatDateCourte(journeePubliee)}` } : {}) }]}
        hypotheses="Coût estimé depuis les jetons consommés et un tarif indicatif versionné ; le journal ne conserve qu'une empreinte hachée de l'adresse." />
    </div>
  );
}
