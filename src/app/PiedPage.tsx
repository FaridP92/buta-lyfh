import { Link } from "react-router";

/** Mention reglementaire obligatoire sur chaque page (CLAUDE.md). */
export function PiedPage() {
  return (
    <footer className="border-t border-bordure px-[var(--esp-4)] py-[var(--esp-4)] md:px-[var(--esp-5)]">
      <p className="max-w-[80ch] text-[12px] leading-relaxed text-texte-3">
        Demonstrateur personnel de Frederic Poissonnier, a l'appui d'une candidature. Sans lien avec
        Butagaz. Donnees de marche publiques, donnees d'activite simulees.{" "}
        <Link to="/methode" className="underline decoration-texte-3/40 underline-offset-2 hover:text-texte-2">
          En savoir plus sur la methode
        </Link>
        .
      </p>
    </footer>
  );
}
