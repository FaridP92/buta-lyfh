import { NavLink, useLocation } from "react-router";
import { ROUTES } from "@/app/routes";
import { Monogramme } from "@/composants/identite/Monogramme";
import { InfoBulle } from "@/composants/InfoBulle";
import { cn } from "@/lib/cn";

/**
 * Rail gauche fixe, 76 px, icones 20 px, libelle au survol apres 300 ms
 * (ECRANS.md conventions, DESIGN.md §3). Le point ambre marque la selection.
 *
 * NavLink est enveloppe par Tooltip.Trigger (asChild) : Radix Slot fusionne
 * className en chaine et casse la forme fonction ({isActive}) => ... de
 * react-router. On calcule donc l'etat actif nous-memes avec useLocation,
 * et NavLink ne recoit qu'une className/des enfants deja resolus.
 */
export function Rail() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-y-0 left-0 z-30 hidden w-[var(--rail-largeur)] flex-col items-center gap-[var(--esp-4)] border-r border-bordure bg-surface py-[var(--esp-3)] md:flex"
    >
      <InfoBulle contenu="Buta.Lyfh" delaiMs={300} cote="right">
        <NavLink to="/" aria-label="Aller a la vue d'ensemble" className="flex items-center justify-center">
          <Monogramme taille={32} />
        </NavLink>
      </InfoBulle>

      <ul className="flex flex-1 flex-col items-center gap-[var(--esp-2)]">
        {ROUTES.map((route) => {
          const estActif = pathname === route.chemin;
          return (
            <li key={route.chemin}>
              <InfoBulle contenu={route.libelle} delaiMs={300} cote="right">
                <NavLink
                  to={route.chemin}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-[10px] text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte",
                    estActif && "text-ambre-texte",
                  )}
                >
                  <route.icone size={20} strokeWidth={1.5} aria-hidden="true" />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -left-[9px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-ambre transition-opacity",
                      estActif ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="sr-only">{route.libelle}</span>
                </NavLink>
              </InfoBulle>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
