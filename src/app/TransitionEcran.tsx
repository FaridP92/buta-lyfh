import { useLayoutEffect } from "react";
import { Outlet, useLocation } from "react-router";

/**
 * Transition de route (DESIGN.md §11). Le fondu croisé entre l'écran sortant (120 ms) et l'entrant (220 ms)
 * est confié à l'API View Transitions du navigateur (`viewTransition` sur chaque lien et navigation, règles
 * `::view-transition-*` dans base.css) ; le rail et la barre haute portent un nom de transition et ne bougent
 * jamais. Ici : au changement d'écran, la page revient en haut et les cartes de l'écran entrent en fondu avec un
 * léger décalage (`.ecran-entree`). Un changement de filtre (même chemin, autre recherche) conserve la position
 * de lecture et ne rejoue rien.
 */
export function TransitionEcran() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <div key={pathname} className="ecran-entree">
      <Outlet />
    </div>
  );
}
