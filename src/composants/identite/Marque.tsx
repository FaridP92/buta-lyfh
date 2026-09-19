import { Monogramme } from "@/composants/identite/Monogramme";
import { cn } from "@/lib/cn";

interface MarqueProps {
  taille?: number;
  className?: string;
  animerEntree?: boolean;
  /** Monogramme à gauche du mot-marque (partout sauf là où le rail l'affiche déjà). */
  avecMonogramme?: boolean;
}

const LETTRES_AVANT = ["B", "U", "T", "A"];
const LETTRES_APRES = ["L", "Y", "F", "H"];

/**
 * Mot-marque « BUTA.LYFH » (DESIGN.md §10, logo du 19 septembre) : capitales géométriques graisse 800,
 * point menthe légèrement plus grand que le corps, précédé du monogramme. La couleur suit le thème
 * (texte du thème, jamais le bleu nuit du visuel, illisible sur fond sombre).
 */
export function Marque({ taille = 22, className, animerEntree = false, avecMonogramme = true }: MarqueProps) {
  return (
    <span className={cn("inline-flex items-center gap-[0.45em] whitespace-nowrap", className)} style={{ fontSize: taille }} role="img" aria-label="Buta.Lyfh">
      {avecMonogramme && <Monogramme taille={Math.round(taille * 1.45)} {...(animerEntree ? { className: "animation-monogramme" } : {})} />}
      <span className="inline-flex items-baseline font-marque font-extrabold uppercase leading-none tracking-[0.04em] text-texte" style={{ fontSize: "0.92em" }}>
        {LETTRES_AVANT.map((lettre, i) => (
          <span key={`a-${i}`} aria-hidden="true" style={animerEntree ? { animation: `buta-lettre 340ms ease-out ${80 + i * 40}ms both` } : undefined}>
            {lettre}
          </span>
        ))}
        <span
          aria-hidden="true"
          className="mx-[0.05em] inline-block rounded-full bg-menthe"
          style={{ width: "0.2em", height: "0.2em", transform: "translateY(-0.02em)", animation: animerEntree ? "buta-point 420ms cubic-bezier(0.2,1.4,0.4,1) 0ms both" : undefined }}
        />
        {LETTRES_APRES.map((lettre, i) => (
          <span key={`b-${i}`} aria-hidden="true" style={animerEntree ? { animation: `buta-lettre 340ms ease-out ${260 + i * 40}ms both` } : undefined}>
            {lettre}
          </span>
        ))}
      </span>
    </span>
  );
}
