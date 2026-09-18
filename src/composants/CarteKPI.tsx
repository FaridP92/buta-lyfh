import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { BoutonFiche } from "@/composants/FicheIndicateur";
import { formatDelaiJours, formatMontant, formatNombre, formatTaux, formatVariationPoints } from "@/lib/format";
import { cn } from "@/lib/cn";

export type FormatKpi = "eur" | "pct" | "nombre" | "jours";

export interface VariationKpi {
  /** Écart en pourcentage (montants, volumes) ou en points (taux). */
  valeur: number | null;
  unite: "pct" | "pts";
  libelle: string;
  plusBasMieux?: boolean;
}

interface CarteKPIProps {
  libelle: string;
  sousLibelle?: string;
  valeur: number | null | undefined;
  format: FormatKpi;
  variation?: VariationKpi;
  /** Douze derniers mois, du plus ancien au plus récent, pour la mini courbe. */
  serie?: readonly (number | null)[];
  code: string;
  /** Change de valeur à chaque nouvelle période : le compteur ne rejoue qu'à la première apparition. */
  clePeriode: string;
  decalageMs?: number;
  grise?: boolean;
  motifNd?: string;
}

function formater(valeur: number, format: FormatKpi): string {
  if (format === "eur") return formatMontant(valeur);
  if (format === "pct") return formatTaux(valeur);
  if (format === "jours") return formatDelaiJours(valeur);
  return formatNombre(valeur);
}

const compteursJoues = new Set<string>();

/**
 * Carte KPI (DESIGN.md §3 et §4) : libellé, valeur mono, variation sémantique, mini courbe
 * douze mois, bouton « i », hauteur fixe 132 px ; compteur 700 ms ease-out une seule fois par période.
 */
export function CarteKPI({ libelle, sousLibelle, valeur, format, variation, serie, code, clePeriode, decalageMs = 0, grise = false, motifNd }: CarteKPIProps) {
  const cle = `${code}|${clePeriode}`;
  const [affiche, setAffiche] = useState<number | null>(() => (compteursJoues.has(cle) ? (valeur ?? null) : null));
  const animation = useRef<number | null>(null);

  useEffect(() => {
    if (valeur === null || valeur === undefined) {
      setAffiche(null);
      return;
    }
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduit || compteursJoues.has(cle)) {
      compteursJoues.add(cle);
      setAffiche(valeur);
      return;
    }
    compteursJoues.add(cle);
    const debut = performance.now() + decalageMs;
    const duree = 700;
    const pas = (t: number) => {
      const x = Math.min(1, Math.max(0, (t - debut) / duree));
      const ease = 1 - Math.pow(1 - x, 3);
      setAffiche(valeur * ease);
      if (x < 1) animation.current = requestAnimationFrame(pas);
    };
    animation.current = requestAnimationFrame(pas);
    return () => {
      if (animation.current) cancelAnimationFrame(animation.current);
    };
  }, [valeur, cle, decalageMs]);

  const nd = valeur === null || valeur === undefined;
  const tendance = variation?.valeur === null || variation?.valeur === undefined ? null : variation.valeur;
  const favorable = tendance === null ? null : variation?.plusBasMieux ? tendance <= 0 : tendance >= 0;

  return (
    <article className={cn("relative flex min-h-[132px] flex-col justify-between gap-[var(--esp-2)] rounded-[var(--rayon-carte)] border border-bordure bg-surface p-[var(--esp-4)] shadow-[var(--ombre-carte)]", grise && "opacity-70")}>
      <div className="flex items-start justify-between gap-[var(--esp-2)]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">{libelle}</p>
          {sousLibelle && <p className="truncate text-[11px] text-texte-3">{sousLibelle}</p>}
        </div>
        <BoutonFiche code={code} className="-mr-1 -mt-1" />
      </div>
      <div className="flex items-end justify-between gap-[var(--esp-3)]">
        <div className="min-w-0">
          <p className="chiffre text-[28px] leading-none text-texte md:text-[36px]" title={nd ? motifNd : undefined}>
            {nd || affiche === null ? "n. d." : formater(affiche, format)}
          </p>
          {variation && (
            <p className={cn("mt-[6px] flex items-center gap-1 text-[12px]", favorable === null ? "text-texte-3" : favorable ? "text-succes" : "text-alerte")}>
              {tendance === null ? <Minus size={12} strokeWidth={1.5} aria-hidden="true" /> : tendance >= 0 ? <ArrowUpRight size={12} strokeWidth={1.5} aria-hidden="true" /> : <ArrowDownRight size={12} strokeWidth={1.5} aria-hidden="true" />}
              <span className="chiffre">
                {tendance === null ? "n. d." : variation.unite === "pts" ? formatVariationPoints(tendance) : `${tendance > 0 ? "+" : ""}${formatTaux(tendance)}`}
              </span>
              <span className="text-texte-3">{variation.libelle}</span>
            </p>
          )}
        </div>
        {serie && serie.length > 1 && <MiniCourbe serie={serie} />}
      </div>
    </article>
  );
}

/** Mini courbe douze mois : ligne 1,5 px, aire à 12 %, point ambre sur la dernière valeur. */
function MiniCourbe({ serie }: { serie: readonly (number | null)[] }) {
  const largeur = 96;
  const hauteur = 34;
  const valeurs = serie.map((v) => (v === null ? null : v));
  const presentes = valeurs.filter((v): v is number => v !== null);
  if (presentes.length < 2) return null;
  const min = Math.min(...presentes);
  const max = Math.max(...presentes);
  const etendue = max - min || 1;
  const points = valeurs.map((v, i) => {
    if (v === null) return null;
    const x = (i / (valeurs.length - 1)) * largeur;
    const y = hauteur - 3 - ((v - min) / etendue) * (hauteur - 6);
    return [x, y] as const;
  });
  const ligne = points.filter((p): p is readonly [number, number] => p !== null).map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const dernier = points.filter((p): p is readonly [number, number] => p !== null).at(-1);
  return (
    <svg width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} aria-hidden="true" className="shrink-0 overflow-visible text-texte-3">
      <path d={`${ligne} L${largeur},${hauteur} L0,${hauteur} Z`} fill="currentColor" opacity={0.12} />
      <path d={ligne} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {dernier && <circle cx={dernier[0]} cy={dernier[1]} r={2.5} className="fill-ambre" />}
    </svg>
  );
}
