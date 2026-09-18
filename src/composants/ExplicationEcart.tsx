import { useState } from "react";
import { expliquerEcartIa, type ReponseIa } from "@/donnees/ia";
import { formatMontant } from "@/lib/format";
import { libelleMois } from "@/lib/periode";

/**
 * Bouton « Expliquer » (ECRANS.md §1 et §4) : les phrases par règles s'affichent tout de suite (src/lib/phrases.ts),
 * puis l'Edge Function expliquer-ecart les remplace par le constat, les causes et l'action rédigés par le modèle
 * à partir des faits SQL ; si le modèle est absent ou si un nombre ne vient pas des faits, les règles restent.
 */
export interface ExplicationRegles {
  constat: string;
  causes: string[];
  action: string;
  sources: string;
}

interface ExplicationEcartProps {
  perimetre: string;
  mois: string;
  indicateur: "CA" | "MARGE" | "CONVERSION";
  repli: ExplicationRegles | null;
  libelleBouton?: string;
}

const CLASSE_TERME = "text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3";

export function ExplicationEcart({ perimetre, mois, indicateur, repli, libelleBouton = "Expliquer" }: ExplicationEcartProps) {
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [reponse, setReponse] = useState<ReponseIa | null>(null);
  const [cleChargee, setCleChargee] = useState<string | null>(null);
  const cle = `${perimetre}|${mois}|${indicateur}`;

  async function basculer() {
    const suivant = !ouvert;
    setOuvert(suivant);
    if (!suivant || cleChargee === cle || chargement) return;
    setChargement(true);
    try {
      const r = await expliquerEcartIa(perimetre, mois, indicateur);
      setReponse(r);
      setCleChargee(cle);
    } catch {
      setReponse({ statut: "erreur", message: "service indisponible" });
      setCleChargee(cle);
    } finally {
      setChargement(false);
    }
  }

  const modele = reponse?.statut === "ok" && reponse.explication ? reponse : null;
  const motifRepli = reponse && reponse.statut !== "ok" ? (reponse.motif_refus ?? reponse.message ?? reponse.statut) : null;

  return (
    <div className="flex flex-col gap-[var(--esp-2)]">
      <div className="flex justify-end">
        <button type="button" onClick={() => void basculer()} aria-expanded={ouvert}
          className="inline-flex h-8 shrink-0 items-center gap-[6px] rounded-[10px] border border-bordure px-[var(--esp-2)] text-[12px] text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte">
          {ouvert ? "Masquer" : libelleBouton}
          {chargement && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ambre" aria-hidden="true" />}
        </button>
      </div>
      {ouvert && (modele || repli) && (
        <dl className="grid gap-x-[var(--esp-4)] gap-y-[var(--esp-2)] rounded-[10px] bg-surface-2 p-[var(--esp-3)] text-[13px] leading-relaxed sm:grid-cols-[96px_1fr]">
          <dt className={CLASSE_TERME}>Constat</dt><dd className="text-texte">{modele ? modele.explication?.constat : repli?.constat}</dd>
          <dt className={CLASSE_TERME}>Causes</dt>
          <dd>
            <ol className="flex flex-col gap-1 text-texte-2">
              {modele
                ? modele.explication?.causes.map((c, i) => (
                  <li key={i} className="flex gap-[var(--esp-2)]"><span className="chiffre text-[11px] text-ambre-texte">{i + 1}</span><span>{c.texte}{c.fait ? <span className="text-texte-3"> · {c.fait}{c.source ? ` (${c.source})` : ""}</span> : null}</span></li>
                ))
                : repli?.causes.map((c, i) => <li key={i} className="flex gap-[var(--esp-2)]"><span className="chiffre text-[11px] text-ambre-texte">{i + 1}</span><span>{c}</span></li>)}
            </ol>
          </dd>
          <dt className={CLASSE_TERME}>Action</dt><dd className="text-texte-2">{modele ? modele.explication?.action : repli?.action}</dd>
          <dt className={CLASSE_TERME}>Sources</dt>
          <dd className="text-[12px] text-texte-3">
            {modele ? (modele.sources ?? []).join(" · ") : repli?.sources}
            <span className="mt-1 block">
              {modele
                ? `Rédigé par le modèle${modele.modele ? ` (${modele.modele})` : ""} à partir des faits SQL du mois de ${libelleMois(mois)}, chaque nombre vérifié dans les faits${modele.cache ? ", réponse en cache" : modele.cout_eur ? `, coût ${formatMontant(modele.cout_eur)}`.replace(/0 €$/, "moins d'un centime") : ""}.`
                : chargement
                  ? "Phrases par règles ; le modèle rédige…"
                  : motifRepli
                    ? `Phrases par règles (modèle indisponible : ${motifRepli}).`
                    : "Phrases par règles."}
            </span>
          </dd>
        </dl>
      )}
      {ouvert && !modele && !repli && (
        <p className="rounded-[10px] bg-surface-2 p-[var(--esp-3)] text-[13px] text-texte-3">
          {chargement ? "Le modèle rédige l'explication à partir des faits SQL…" : motifRepli ? `Le modèle n'est pas disponible (${motifRepli}) : les phrases par règles ci-dessus restent la lecture du mois.` : "Aucune explication disponible."}
        </p>
      )}
    </div>
  );
}
