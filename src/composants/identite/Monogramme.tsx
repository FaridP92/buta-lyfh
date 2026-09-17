import { cn } from "@/lib/cn";

interface MonogrammeProps {
  taille?: number;
  className?: string;
}

/** Monogramme de marque, DESIGN.md §10 : carré ambre, B en réserve, point ambre en réserve dans la panse. */
export function Monogramme({ taille = 32, className }: MonogrammeProps) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Monogramme Buta.Lyfh"
      className={cn("shrink-0", className)}
    >
      <rect width="32" height="32" rx="6" fill="#F5B700" />
      <text
        x="15.6"
        y="23.2"
        textAnchor="middle"
        fontFamily="Georgia, 'Iowan Old Style', 'Times New Roman', serif"
        fontSize="19"
        fontWeight="700"
        fill="#0B0F17"
      >
        B
      </text>
      <circle cx="20.6" cy="19.4" r="1.85" fill="#F5B700" />
    </svg>
  );
}
