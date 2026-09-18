import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type VarianteBadge = "simule" | "reel" | "instantane";

// « simulé » et « instantané » se remplacent l'un l'autre au même endroit quand la base répond : même largeur,
// sinon la ligne d'en-tête change de nombre de lignes sur téléphone (décalage de mise en page mesuré sous 4G).
const STYLES: Record<VarianteBadge, string> = {
  simule: "min-w-[96px] justify-center border-ambre/60 text-ambre-texte",
  reel: "border-menthe/60 text-menthe-texte",
  instantane: "min-w-[96px] justify-center border-texte-3/60 text-texte-3",
};

interface BadgeProps {
  variante: VarianteBadge;
  children: ReactNode;
  className?: string;
}

/** Badges « simulé », « réel, source », « instantané » (DESIGN.md §3). */
export function Badge({ variante, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-[var(--esp-2)] py-[2px] text-[11px] font-semibold uppercase tracking-[0.08em]",
        STYLES[variante],
        className,
      )}
    >
      {children}
    </span>
  );
}
