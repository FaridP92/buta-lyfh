import { Link } from "react-router";

/** Mention réglementaire obligatoire sur chaque page (CLAUDE.md). */
export function PiedPage() {
  return (
    <footer className="border-t border-bordure px-[var(--esp-4)] py-[var(--esp-4)] md:px-[var(--esp-5)]">
      <p className="max-w-[80ch] text-[12px] leading-relaxed text-texte-3">
        Démonstrateur personnel de Frédéric Poissonnier, à l'appui d'une candidature. Sans lien avec
        Butagaz. Données de marché publiques, données d'activité simulées.{" "}
        <Link to="/methode" className="underline decoration-texte-3/40 underline-offset-2 hover:text-texte-2">
          En savoir plus sur la méthode
        </Link>
        .
      </p>
    </footer>
  );
}
