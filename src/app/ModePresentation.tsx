import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { ROUTES } from "@/app/routes";

interface ContextePresentation {
  actif: boolean;
  basculer: () => void;
  quitter: () => void;
}

const Contexte = createContext<ContextePresentation>({ actif: false, basculer: () => undefined, quitter: () => undefined });

const CHEMINS = ROUTES.filter((r) => r.disponible).map((r) => r.chemin);

/** Vrai quand la frappe vise un champ de saisie : les raccourcis d'une lettre ne s'y appliquent pas. */
function saisieEnCours(cible: EventTarget | null): boolean {
  if (!(cible instanceof HTMLElement)) return false;
  return cible.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName) || cible.closest("[role='dialog']") !== null;
}

/**
 * Mode présentation (BACKLOG US-060, palier C) : touche P, plein écran quand le navigateur l'accorde, rail et barre
 * haute masqués, flèches gauche et droite pour passer d'un écran à l'autre dans l'ordre du rail, Échap pour sortir.
 * Aucun enchaînement automatique : en réunion, c'est le présentateur qui avance.
 */
export function FournisseurModePresentation({ children }: { children: ReactNode }) {
  const [actif, setActif] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const quitter = useCallback(() => {
    setActif(false);
    if (document.fullscreenElement && document.exitFullscreen) void document.exitFullscreen().catch(() => undefined);
  }, []);

  const basculer = useCallback(() => {
    if (actif) {
      quitter();
      return;
    }
    setActif(true);
    const racine = document.documentElement;
    if (racine.requestFullscreen) void racine.requestFullscreen().catch(() => undefined);
  }, [actif, quitter]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-presentation", actif);
    return () => document.documentElement.removeAttribute("data-presentation");
  }, [actif]);

  // Sortir du plein écran (bouton du navigateur, Échap natif) sort aussi du mode.
  useEffect(() => {
    function surPleinEcran() {
      if (!document.fullscreenElement && actif) setActif(false);
    }
    document.addEventListener("fullscreenchange", surPleinEcran);
    return () => document.removeEventListener("fullscreenchange", surPleinEcran);
  }, [actif]);

  useEffect(() => {
    function surClavier(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "p" || e.key === "P") {
        if (saisieEnCours(e.target)) return;
        e.preventDefault();
        basculer();
        return;
      }
      if (!actif) return;
      if (e.key === "Escape") {
        quitter();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (saisieEnCours(e.target)) return;
        const index = CHEMINS.indexOf(pathname);
        const suivant = e.key === "ArrowRight" ? (index + 1) % CHEMINS.length : (index - 1 + CHEMINS.length) % CHEMINS.length;
        e.preventDefault();
        void navigate(CHEMINS[suivant] ?? "/", { viewTransition: true });
      }
    }
    window.addEventListener("keydown", surClavier);
    return () => window.removeEventListener("keydown", surClavier);
  }, [actif, basculer, quitter, navigate, pathname]);

  const valeur = useMemo(() => ({ actif, basculer, quitter }), [actif, basculer, quitter]);

  return (
    <Contexte.Provider value={valeur}>
      {children}
      {actif && <BandeauPresentation chemin={pathname} onQuitter={quitter} />}
    </Contexte.Provider>
  );
}

export function useModePresentation(): ContextePresentation {
  return useContext(Contexte);
}

/** Repère discret en bas à droite : écran courant, position dans l'enchaînement, touches. */
function BandeauPresentation({ chemin, onQuitter }: { chemin: string; onQuitter: () => void }) {
  const index = CHEMINS.indexOf(chemin);
  const route = ROUTES.find((r) => r.chemin === chemin);
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[var(--esp-4)] right-[var(--esp-4)] z-30 flex items-center gap-[var(--esp-3)] rounded-full border border-bordure bg-surface/95 px-[var(--esp-4)] py-[8px] text-[12px] text-texte-2 shadow-[var(--ombre-carte)] backdrop-blur-sm"
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
      <span className="text-texte">{route?.libelle ?? chemin}</span>
      <span className="chiffre text-texte-3">
        {index + 1} / {CHEMINS.length}
      </span>
      <span className="text-texte-3">
        <kbd className="rounded border border-bordure px-[4px] text-[10px]">←</kbd> <kbd className="rounded border border-bordure px-[4px] text-[10px]">→</kbd> écrans
      </span>
      <button type="button" onClick={onQuitter} className="rounded-full border border-bordure px-[8px] py-[2px] text-[11px] hover:bg-surface-2 hover:text-texte">
        Quitter <kbd className="ml-1 text-[10px] text-texte-3">Échap</kbd>
      </button>
    </div>
  );
}
