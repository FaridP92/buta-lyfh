import { useEffect, useState } from "react";
import { formatMontant, formatProbabilite, formatTaux } from "@/lib/format";
import { ecartPct } from "@/lib/periode";
import { cn } from "@/lib/cn";

interface JaugeProps {
  realise: number;
  central: number | null;
  bas: number | null;
  haut: number | null;
  objectif: number;
  probabilite: number | null;
  annee: number;
  clePeriode: string;
}

/**
 * Jauge horizontale d'atterrissage (ECRANS.md §1, DESIGN.md §11) : le réalisé se remplit de gauche à
 * droite en 900 ms, puis l'intervalle bas-haut et le repère central apparaissent, puis l'objectif.
 */
export function JaugeAtterrissage({ realise, central, bas, haut, objectif, probabilite, annee, clePeriode }: JaugeProps) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    setPhase(0);
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduit) {
      setPhase(3);
      return;
    }
    const t1 = window.setTimeout(() => setPhase(1), 30);
    const t2 = window.setTimeout(() => setPhase(2), 950);
    const t3 = window.setTimeout(() => setPhase(3), 1250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [clePeriode]);

  const maximum = Math.max(objectif, haut ?? 0, central ?? 0, realise) * 1.06;
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / maximum) * 100))}%`;
  const ecart = ecartPct(central, objectif);

  return (
    <div className="flex flex-col gap-[var(--esp-3)]">
      <div className="flex flex-wrap items-baseline gap-x-[var(--esp-4)] gap-y-1">
        <span className="chiffre text-[28px] leading-none text-texte md:text-[36px]">{central === null ? "n. d." : formatMontant(central)}</span>
        <span className="text-[12px] text-texte-2">atterrissage central {annee}</span>
        {ecart !== null && (
          <span className={cn("chiffre text-[12px]", ecart >= 0 ? "text-succes" : ecart >= -5 ? "text-attention" : "text-alerte")}>
            {ecart >= 0 ? "+" : ""}{formatTaux(ecart)} vs objectif
          </span>
        )}
        {probabilite !== null && <span className="text-[12px] text-texte-3">probabilité d'atteinte {formatProbabilite(probabilite)}</span>}
      </div>

      <div className="relative h-10">
        <div className="absolute inset-x-0 top-[14px] h-3 rounded-full bg-surface-2" />
        {bas !== null && haut !== null && (
          <div
            className="absolute top-[12px] h-4 rounded-full border border-texte-3/40 transition-opacity duration-300"
            style={{ left: pct(bas), width: `calc(${pct(haut)} - ${pct(bas)})`, opacity: phase >= 2 ? 1 : 0 }}
            title={`Intervalle à 68 % : ${formatMontant(bas)} à ${formatMontant(haut)}`}
          />
        )}
        <div
          className="absolute left-0 top-[14px] h-3 rounded-full bg-accent"
          style={{ width: phase >= 1 ? pct(realise) : "0%", transition: "width 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
        {central !== null && (
          <div className="absolute top-[8px] h-6 w-[2px] bg-texte transition-opacity duration-300" style={{ left: pct(central), opacity: phase >= 2 ? 1 : 0 }} />
        )}
        <div className="absolute top-[6px] flex h-7 flex-col items-center transition-opacity duration-300" style={{ left: pct(objectif), opacity: phase >= 3 ? 1 : 0, transform: "translateX(-50%)" }}>
          <div className="h-7 w-[2px] bg-menthe" />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-[var(--esp-4)] gap-y-1 text-[12px] sm:grid-cols-4">
        <div><dt className="text-texte-3">Réalisé à date</dt><dd className="chiffre text-texte">{formatMontant(realise)}</dd></div>
        <div><dt className="text-texte-3">Bas</dt><dd className="chiffre text-texte">{bas === null ? "n. d." : formatMontant(bas)}</dd></div>
        <div><dt className="text-texte-3">Haut</dt><dd className="chiffre text-texte">{haut === null ? "n. d." : formatMontant(haut)}</dd></div>
        <div><dt className="flex items-center gap-1 text-texte-3"><span className="inline-block h-2 w-[2px] bg-menthe" aria-hidden="true" />Objectif {annee}</dt><dd className="chiffre text-texte">{formatMontant(objectif)}</dd></div>
      </dl>
    </div>
  );
}
