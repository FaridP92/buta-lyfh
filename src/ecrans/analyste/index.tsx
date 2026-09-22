import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { AGENCES, useFiltres } from "@/app/filtres";
import { useVue } from "@/donnees/useVue";
import { poserQuestion, type ReponseIa } from "@/donnees/ia";
import { Carte } from "@/composants/Carte";
import { Tableau, type Colonne } from "@/composants/Tableau";
import { Badge } from "@/composants/Badge";
import { Pastille, type Statut } from "@/composants/Pastille";
import { LigneSources } from "@/composants/LigneSources";
import { Squelette } from "@/composants/Squelette";
import { formatDateCourte, formatDuree, formatMontantUnite, formatNombre } from "@/lib/format";
import { formaterSql, jourParis, libelleCode, libelleNature, totalDuJour, type Referentiel } from "@/lib/analyste";

/** Six suggestions (IA.md §5, jeu d'évaluation) : les histoires du jeu et le marché réel, sans superlatif. */
const SUGGESTIONS = [
  "Quelle agence a le résultat d'agence le plus élevé sur 2026 ?",
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

/** Valeur d'une cellule telle que renvoyée par la vue : nombre à la française, code traduit en libellé, JSON sérialisé, vide pour null. */
function afficher(v: unknown, referentiels: readonly Referentiel[]): string {
  if (v === null || v === undefined) return "n. d.";
  if (typeof v === "number") return Number.isInteger(v) ? formatNombre(v) : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v);
  if (typeof v === "boolean") return v ? "oui" : "non";
  if (typeof v === "object") return JSON.stringify(v);
  return libelleCode(String(v), referentiels);
}

function statutHistorique(r: ReponseIa): { statut: Statut; texte: string } {
  if (r.statut === "ok") return r.redaction_rejetee ? { statut: "attention", texte: "lignes seules" } : { statut: "succes", texte: "répondu" };
  if (r.statut === "refus") return { statut: "attention", texte: "refusé" };
  if (r.statut === "quota") return { statut: "neutre", texte: "en pause" };
  return { statut: "neutre", texte: r.statut === "repli" ? "indisponible" : "sans réponse" };
}

function heureDe(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(iso));
}

export function EcranAnalyste() {
  const { journeePubliee } = useFiltres();
  const usage = useVue("mart_ia_usage", { ordre: "-jour", limite: 10 });
  const canaux = useVue("dim_canal");
  const produits = useVue("dim_produit");
  const [question, setQuestion] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [courant, setCourant] = useState<Echange | null>(null);
  const [historique, setHistorique] = useState<Echange[]>([]);
  const [copie, setCopie] = useState(false);
  const [sqlOuverte, setSqlOuverte] = useState(false);
  const [annonce, setAnnonce] = useState("");
  const champRef = useRef<HTMLTextAreaElement>(null);
  const reponseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistorique(lireHistorique());
  }, []);

  const referentiels = useMemo<Referentiel[]>(() => [
    ...AGENCES.map((a) => ({ code: a.code, libelle: a.nom })),
    ...(canaux.donnees ?? []).map((c) => ({ code: c.code, libelle: c.libelle })),
    ...(produits.donnees ?? []).map((p) => ({ code: p.code, libelle: p.libelle })),
  ], [canaux.donnees, produits.donnees]);

  // Le journal IA compte les jours en heure de Paris ; le total vient de src/lib/analyste.ts (rien n'est additionné ici).
  const total = totalDuJour(usage.donnees, jourParis());
  const coutDuJour = courant?.reponse.cout_jour ?? total.cout;
  const budget = courant?.reponse.budget_jour ?? historique.find((h) => h.reponse.budget_jour)?.reponse.budget_jour ?? null;

  async function poser(texte: string) {
    const q = texte.trim();
    if (q.length < 3 || enCours) return;
    setEnCours(true);
    setQuestion(q);
    setSqlOuverte(false);
    setAnnonce("Requête en cours");
    try {
      const reponse = await poserQuestion(q);
      const echange = { question: q, reponse, a: new Date().toISOString() };
      setCourant(echange);
      const suivant = [echange, ...historique.filter((h) => h.question !== q)].slice(0, HISTORIQUE_MAX);
      setHistorique(suivant);
      ecrireHistorique(suivant);
      const nb = reponse.lignes?.length ?? 0;
      setAnnonce(reponse.statut === "ok" ? `Réponse reçue, ${formatNombre(nb)} ligne${nb > 1 ? "s" : ""}` : reponse.statut === "refus" ? "Question refusée" : reponse.statut === "quota" ? "Analyste en pause" : "Pas de réponse");
      window.setTimeout(() => reponseRef.current?.focus(), 50);
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
      setAnnonce("Requête copiée");
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers indisponible : rien à faire, la requête reste visible.
    }
  }

  const r = courant?.reponse ?? null;
  const colonnes = useMemo<Colonne<Record<string, unknown>>[]>(() => (r?.colonnes ?? []).map((c) => ({
    cle: c, libelle: c, enTeteBrut: true, numerique: (r?.lignes ?? []).some((l) => typeof l[c] === "number"), valeur: (l) => (l[c] as string | number | null | undefined) ?? null, rendu: (l) => afficher(l[c], referentiels),
  })), [r, referentiels]);
  const lignes = useMemo(() => (r?.lignes ?? []).map((l, i) => ({ ...l, __i: i })), [r]);
  const natureCourante = r?.statut === "ok" ? (r.nature ?? "simule") : "simule";

  return (
    <div className="flex flex-col gap-[var(--esp-5)]">
      <header>
        <h1 className="font-serif-titre text-[32px] leading-[1.1] text-texte max-md:text-[26px]">Vérifier un chiffre avant de décider</h1>
        <p className="mt-1 max-w-[80ch] text-[13px] text-texte-2">
          Questions de fait sur les indicateurs, les agences, les canaux, les produits, les périodes, la qualité et le marché des territoires. Pour le pourquoi d'un écart, le bouton Expliquer de Ventes et marge.{" "}
          <span className="whitespace-nowrap">· <Badge variante="simule">simulé</Badge></span>
        </p>
      </header>

      <p role="status" aria-live="polite" className="sr-only">{annonce}</p>

      <Carte>
        <form onSubmit={soumettre} className="flex flex-col gap-[var(--esp-3)]">
          <label htmlFor="question-analyste" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">Votre question (500 caractères au plus)</label>
          <div className="flex flex-col gap-[var(--esp-2)] sm:flex-row">
            <textarea id="question-analyste" ref={champRef} value={question} onChange={(e) => setQuestion(e.target.value.slice(0, 500))} rows={2} disabled={enCours}
              placeholder="Quel canal a le coût par vente le plus élevé sur les cohortes de mars à mai 2026 ?"
              className="min-h-[56px] flex-1 resize-none rounded-[10px] max-sm:min-h-[84px] border border-bordure bg-surface-2 px-[var(--esp-3)] py-[10px] text-[15px] text-texte placeholder:text-texte-3 focus:border-accent" />
            <button type="submit" disabled={enCours || question.trim().length < 3}
              className="bouton-primaire inline-flex h-9 min-w-[168px] items-center justify-center rounded-[10px] px-[var(--esp-4)] text-[14px] font-semibold transition-opacity max-md:h-10">
              {enCours ? "Réponse en cours…" : "Demander"}
            </button>
          </div>
          <div className="flex flex-wrap gap-[6px]">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" disabled={enCours} onClick={() => void poser(s)}
                className="rounded-full border border-bordure px-[10px] py-[4px] text-[12px] text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte disabled:opacity-50">{s}</button>
            ))}
          </div>
          <p className="text-[12px] text-texte-3">La question se suffit : les filtres de la barre haute ne s'appliquent pas ici, précisez la période et l'agence dans la question.</p>
        </form>
      </Carte>

      {enCours && (
        <div className="flex flex-col gap-[var(--esp-3)]" aria-hidden="true">
          <Squelette hauteur={150} className="rounded-[var(--rayon-carte)]" />
          <Squelette hauteur={220} className="rounded-[var(--rayon-carte)]" />
          <Squelette hauteur={72} className="rounded-[var(--rayon-carte)]" />
        </div>
      )}

      {r && courant && !enCours && (
        <div ref={reponseRef} tabIndex={-1} className="flex flex-col gap-[var(--esp-3)] outline-none">
          {r.statut === "ok" && (
            <>
              <Carte titre="La réponse" sousTitre={`« ${courant.question} »`}
                actions={<><Badge variante={r.nature === "reel" ? "reel" : "simule"}>{libelleNature(r.nature)}</Badge><Pastille statut={r.redaction_rejetee ? "attention" : "succes"} texte={r.redaction_rejetee ? "rédaction rejetée, lignes exactes" : "chaque nombre retrouvé dans sa ligne"} /></>}>
                <p className="max-w-[72ch] text-[15px] leading-relaxed text-texte">{r.reponse}</p>
                {(r.sources ?? []).length > 0 && <p className="mt-[var(--esp-2)] max-w-[72ch] text-[12px] text-texte-3">Sources : {(r.sources ?? []).join(" · ")}</p>}
                <p className="mt-[var(--esp-2)] text-[12px] text-texte-3">
                  {r.modele ?? "modèle"} · {formatDuree(r.duree_ms)} · coût {formatMontantUnite(r.cout_eur ?? 0, "eur", (r.cout_eur ?? 0) >= 1 ? 2 : 3)}
                </p>
              </Carte>
              <Carte titre="Les chiffres" sousTitre={`${formatNombre(lignes.length)} ligne${lignes.length > 1 ? "s" : ""} renvoyée${lignes.length > 1 ? "s" : ""} par la base (200 au plus), lecture seule sous un rôle limité aux vues · montants en € HT, taux en %`} nu>
                {lignes.length > 0 ? (
                  <div className="px-[var(--esp-2)] pb-[var(--esp-3)]">
                    <Tableau colonnes={colonnes} lignes={lignes} cleLigne={(l) => String(l.__i)} compact nomExport="analyste-lignes" />
                  </div>
                ) : <p className="px-[var(--esp-4)] pb-[var(--esp-4)] text-[13px] text-texte-3">Aucune ligne ne correspond.</p>}
              </Carte>
              <Carte titre="La requête SQL exécutée" sousTitre="validée par les garde-fous, exécutée en lecture seule, 200 lignes au plus"
                actions={<button type="button" onClick={() => setSqlOuverte((o) => !o)} aria-expanded={sqlOuverte} className="inline-flex h-9 items-center gap-[6px] rounded-[10px] border border-bordure px-[var(--esp-2)] text-[12px] text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte">
                  {sqlOuverte ? <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" /> : <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />}
                  {sqlOuverte ? "Masquer" : "Afficher"}
                </button>}>
                {sqlOuverte && (
                  <div className="flex flex-col gap-[var(--esp-2)]">
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-[10px] bg-surface-2 p-[var(--esp-3)] font-mono text-[12px] leading-[1.5] text-texte">{formaterSql(r.sql ?? "")}</pre>
                    <button type="button" onClick={() => void copierRequete()} className="inline-flex h-9 w-fit items-center gap-[6px] rounded-[10px] border border-bordure px-[var(--esp-2)] text-[12px] text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte">
                      <Copy size={13} strokeWidth={1.5} aria-hidden="true" />{copie ? "Copiée" : "Copier la requête"}
                    </button>
                  </div>
                )}
              </Carte>
            </>
          )}
          {r.statut === "refus" && (
            <Carte titre="Question refusée" sousTitre={`« ${courant.question} »`}>
              <p className="max-w-[72ch] text-[15px] leading-relaxed text-texte">{r.motif_refus}</p>
              {r.motif === "conseil" && <p className="mt-[var(--esp-2)] text-[13px] text-texte-2">Le marché d'un département se lit sur l'écran <Link to="/territoires" viewTransition className="underline underline-offset-2">Territoires</Link> ; la décision reste à celui qui pilote.</p>}
              {r.motif === "non_couvert" && <p className="mt-[var(--esp-2)] text-[13px] text-texte-2">Ce que le cockpit contient et ne contient pas : page <Link to="/methode" viewTransition className="underline underline-offset-2">Méthode</Link>.</p>}
              <p className="mt-[var(--esp-2)] text-[12px] text-texte-3">{formatDuree(r.duree_ms)} · coût {formatMontantUnite(r.cout_eur ?? 0, "eur", 3)}</p>
            </Carte>
          )}
          {r.statut === "quota" && (
            <Carte titre="Analyste en pause" sousTitre={`« ${courant.question} »`}>
              <p className="max-w-[72ch] text-[15px] leading-relaxed text-texte">Limite atteinte : {r.motif_refus}. Le compteur repart à minuit ; les écrans du cockpit restent la source, chaque chiffre y a sa fiche et sa requête.</p>
            </Carte>
          )}
          {r.statut === "repli" && (
            <Carte titre="Analyste indisponible" sousTitre={`« ${courant.question} »`}>
              <p className="max-w-[72ch] text-[15px] leading-relaxed text-texte">Le modèle ne répond pas pour l'instant. Les écrans du cockpit restent la source : chaque chiffre y a sa fiche et sa requête.</p>
            </Carte>
          )}
          {r.statut === "erreur" && (
            <Carte titre="Pas de réponse" sousTitre={`« ${courant.question} »`}>
              <p className="max-w-[72ch] text-[15px] leading-relaxed text-texte">{r.message ?? "Le service est momentanément indisponible."}</p>
              {r.sql && <pre className="mt-[var(--esp-2)] overflow-x-auto whitespace-pre-wrap rounded-[10px] bg-surface-2 p-[var(--esp-3)] font-mono text-[12px] text-texte-2">{formaterSql(r.sql)}</pre>}
            </Carte>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-[var(--esp-3)] lg:grid-cols-12">
        <Carte className="lg:col-span-7" titre="Historique de la session" sousTitre="Dix dernières questions, conservées dans ce navigateur seulement">
          {historique.length === 0 ? (
            <p className="text-[13px] text-texte-3">
              Aucune question pour l'instant : <button type="button" onClick={() => champRef.current?.focus()} className="underline underline-offset-2 hover:text-texte">écrivez la vôtre</button> ou choisissez une suggestion ci-dessus.
            </p>
          ) : (
            <ul className="flex flex-col gap-[6px]">
              {historique.map((h) => {
                const s = statutHistorique(h.reponse);
                return (
                  <li key={h.a} className="flex items-center justify-between gap-[var(--esp-2)]">
                    <button type="button" onClick={() => { setCourant(h); setQuestion(h.question); setSqlOuverte(false); }} title={h.question} className="flex min-w-0 items-center gap-[6px] text-left text-[13px] text-texte-2 hover:text-texte">
                      <ChevronRight size={13} strokeWidth={1.5} className="shrink-0 text-texte-3" aria-hidden="true" />
                      <span className="truncate">{h.question}</span>
                    </button>
                    <span className="flex shrink-0 items-center gap-[var(--esp-2)]">
                      <span className="chiffre text-[11px] text-texte-3">{heureDe(h.a)}</span>
                      <Pastille statut={s.statut} texte={s.texte} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Carte>
        <Carte className="lg:col-span-5" titre="Garde-fous" sousTitre="Ce que l'analyste ne peut pas faire, par construction">
          <ul className="flex flex-col gap-[6px] text-[13px] leading-[1.45] text-texte-2">
            {[
              "Le modèle écrit la requête SQL, la base répond, le modèle rédige sans jamais calculer.",
              "Lecture seule : rôle SQL limité aux vues mart_ et à la table de fraîcheur, délai de 5 secondes, 200 lignes au plus.",
              "Une seule requête SELECT, validée avant exécution : mots interdits, vues hors liste, schémas système sont refusés.",
              "Aucun nombre inventé ni déplacé : tout nombre de la réponse, en chiffres ou en lettres, signe compris, est retrouvé dans les lignes, et dans la ligne que la phrase nomme ; sinon la rédaction est rejetée et les lignes restent la réponse.",
              "Refus explicites : conseil, hors périmètre, données non couvertes (chiffres réels, personnes, MaPrimeRénov' par commune), écriture.",
              "Quotas : 5 questions par minute et 20 par jour par adresse et navigateur hachés, 400 par jour au total, budget quotidien en euros.",
            ].map((texte) => (
              <li key={texte} className="relative pl-[14px] before:absolute before:left-0 before:top-[9px] before:h-1 before:w-1 before:rounded-full before:bg-texte-3 before:content-['']">{texte}</li>
            ))}
          </ul>
          <p className="mt-[var(--esp-3)] border-t border-bordure pt-[var(--esp-2)] text-[12px] text-texte-3">
            Budget du jour : {formatMontantUnite(coutDuJour, "eur", 2)}{budget ? ` sur ${formatMontantUnite(budget, "eur", 2)}` : ""} · {formatNombre(total.appels)} appel{total.appels > 1 ? "s" : ""} IA, toutes fonctions
          </p>
        </Carte>
      </div>

      <LigneSources simule={natureCourante !== "reel"} sources={[{ nom: "Edge Function analyste, vues mart_ (catalogue généré depuis les commentaires SQL), journal ia_usage", ...(journeePubliee ? { reference: `journée publiée du ${formatDateCourte(journeePubliee)}` } : {}) }]}
        hypotheses="Coût estimé depuis les jetons consommés et un tarif indicatif versionné ; le journal conserve la question, sa requête et une empreinte hachée de l'adresse et du navigateur, jamais l'adresse." />
    </div>
  );
}
