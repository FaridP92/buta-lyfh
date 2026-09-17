import { cn } from "@/lib/cn";

interface MarqueProps {
  taille?: number;
  className?: string;
  animerEntree?: boolean;
}

const LETTRES_AVANT = ["B", "u", "t", "a"];
const LETTRES_APRES = ["L", "y", "f", "h"];

/**
 * Marque-mot « Buta.Lyfh » (DESIGN.md §10) : le point médian devient un point
 * ambre légèrement plus grand que le corps du texte. En Instrument Serif.
 */
export function Marque({ taille = 22, className, animerEntree = false }: MarqueProps) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline whitespace-nowrap font-serif-titre leading-none tracking-[-0.01em] text-texte",
        className,
      )}
      style={{ fontSize: taille }}
      role="img"
      aria-label="Buta.Lyfh"
    >
      {LETTRES_AVANT.map((lettre, i) => (
        <span
          key={`a-${i}`}
          aria-hidden="true"
          style={
            animerEntree
              ? { animation: `buta-lettre 340ms ease-out ${80 + i * 40}ms both` }
              : undefined
          }
        >
          {lettre}
        </span>
      ))}
      <span
        aria-hidden="true"
        className="mx-[0.06em] inline-block rounded-full bg-ambre"
        style={{
          width: "0.17em",
          height: "0.17em",
          transform: "translateY(-0.05em)",
          animation: animerEntree ? "buta-point 420ms cubic-bezier(0.2,1.4,0.4,1) 0ms both" : undefined,
        }}
      />
      {LETTRES_APRES.map((lettre, i) => (
        <span
          key={`b-${i}`}
          aria-hidden="true"
          style={
            animerEntree
              ? { animation: `buta-lettre 340ms ease-out ${260 + i * 40}ms both` }
              : undefined
          }
        >
          {lettre}
        </span>
      ))}
    </span>
  );
}
