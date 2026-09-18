import { cn } from "@/lib/cn";

export type Statut = "succes" | "attention" | "alerte" | "neutre";

const COULEURS: Record<Statut, string> = {
  succes: "bg-succes",
  attention: "bg-attention",
  alerte: "bg-alerte",
  neutre: "bg-texte-3",
};

interface PastilleProps {
  statut: Statut;
  texte: string;
  className?: string;
}

/** Pastille 8 px toujours accompagnée d'un texte (DESIGN.md §3 : jamais la couleur seule). */
export function Pastille({ statut, texte, className }: PastilleProps) {
  return (
    <span className={cn("inline-flex items-center gap-[6px] text-[12px] text-texte-2", className)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", COULEURS[statut])} aria-hidden="true" />
      {texte}
    </span>
  );
}

/**
 * Statut d'un écart à l'objectif (INDICATEURS.md conventions) : vert au-dessus,
 * ambre entre 0 et -5 %, rouge en dessous ; un indicateur « plus bas = mieux » inverse.
 */
export function statutEcart(ecartPct: number | null | undefined, plusBasMieux = false): Statut {
  if (ecartPct === null || ecartPct === undefined || Number.isNaN(ecartPct)) return "neutre";
  const e = plusBasMieux ? -ecartPct : ecartPct;
  if (e >= 0) return "succes";
  if (e >= -5) return "attention";
  return "alerte";
}
