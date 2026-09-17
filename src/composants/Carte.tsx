import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CarteProps {
  titre?: string;
  sousTitre?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Sans padding intérieur (tableaux qui gèrent leur propre gouttière). */
  nu?: boolean;
}

/** Carte (DESIGN.md §3) : rayon 14 px, fond surface, bordure 1 px, aucune ombre en sombre, padding 20 px. */
export function Carte({ titre, sousTitre, actions, children, className, nu = false }: CarteProps) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-[var(--rayon-carte)] border border-bordure bg-surface shadow-[var(--ombre-carte)]",
        nu ? "" : "p-[var(--esp-4)]",
        className,
      )}
    >
      {(titre || actions) && (
        <header className={cn("flex items-start justify-between gap-[var(--esp-3)]", nu ? "px-[var(--esp-4)] pt-[var(--esp-4)]" : "", "mb-[var(--esp-3)]")}>
          <div className="min-w-0">
            {titre && <h2 className="text-[15px] font-semibold leading-tight text-texte">{titre}</h2>}
            {sousTitre && <p className="mt-[2px] text-[12px] leading-snug text-texte-2">{sousTitre}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-[var(--esp-1)]">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
