import { cn } from "@/lib/cn";

interface SqueletteProps {
  hauteur?: number;
  className?: string;
}

/** Squelette de chargement, de la forme exacte du contenu attendu (ECRANS.md, états). */
export function Squelette({ hauteur = 120, className }: SqueletteProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-[10px] bg-surface-2", className)}
      style={{ height: hauteur }}
    />
  );
}
