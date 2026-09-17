import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type VarianteBadge = "simule" | "reel" | "instantane";

const STYLES: Record<VarianteBadge, string> = {
  simule: "border-ambre/60 text-ambre-texte",
  reel: "border-menthe/60 text-menthe-texte",
  instantane: "border-texte-3/60 text-texte-3",
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
