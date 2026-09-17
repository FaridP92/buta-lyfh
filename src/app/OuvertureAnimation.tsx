import { useEffect, useState } from "react";
import { Marque } from "@/composants/identite/Marque";

const CLE_SESSION = "buta-ouverture-vue";
const DUREE_MS = 700;

function reductionMouvementSouhaitee(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function dejaVue(): boolean {
  try {
    return sessionStorage.getItem(CLE_SESSION) === "1";
  } catch {
    return false;
  }
}

function marquerVue(): void {
  try {
    sessionStorage.setItem(CLE_SESSION, "1");
  } catch {
    // navigation privee : l'animation pourra rejouer, sans consequence
  }
}

interface OuvertureAnimationProps {
  onTermine: () => void;
}

/**
 * Animation d'ouverture, une fois par session (DESIGN.md §10) : le point
 * s'allume, le mot apparait lettre par lettre, puis le rail glisse (gere par
 * Layout via la classe "ouverture-terminee" posee 300 ms avant la fin).
 */
export function OuvertureAnimation({ onTermine }: OuvertureAnimationProps) {
  const [visible, setVisible] = useState(() => !dejaVue() && !reductionMouvementSouhaitee());
  const [sortie, setSortie] = useState(false);

  useEffect(() => {
    if (!visible) {
      marquerVue();
      onTermine();
      return;
    }
    const sortieTimer = window.setTimeout(() => setSortie(true), DUREE_MS - 180);
    const finTimer = window.setTimeout(() => {
      marquerVue();
      setVisible(false);
      onTermine();
    }, DUREE_MS);
    return () => {
      window.clearTimeout(sortieTimer);
      window.clearTimeout(finTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-fond transition-opacity duration-200"
      style={{ opacity: sortie ? 0 : 1 }}
    >
      <Marque taille={44} animerEntree />
    </div>
  );
}
