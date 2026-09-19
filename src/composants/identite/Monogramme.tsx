import { cn } from "@/lib/cn";

interface MonogrammeProps {
  taille?: number;
  className?: string;
}

/**
 * Monogramme de marque (DESIGN.md §10, décision du 19 septembre) : le logo fourni par Frédéric,
 * monogramme « BL » fléché détouré en PNG (`public/logo/`), affiché à la largeur demandée.
 */
export function Monogramme({ taille = 32, className }: MonogrammeProps) {
  return (
    <img
      src="/logo/monogramme-96.png"
      width={taille}
      height={Math.round(taille * 0.876)}
      alt="Monogramme Buta.Lyfh"
      decoding="async"
      className={cn("shrink-0 select-none", className)}
      draggable={false}
    />
  );
}
