import { useLocation } from "react-router";
import { ROUTES } from "@/app/routes";

/**
 * Etat "a venir" (BACKLOG US-004) : jamais un ecran blanc ni une icone triste
 * (DESIGN.md §9). Le titre, la promesse de l'ecran et le lot qui l'apporte.
 */
export function EnConstruction() {
  const { pathname } = useLocation();
  const route = ROUTES.find((r) => r.chemin === pathname);
  if (!route) return null;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[640px] flex-col justify-center gap-[var(--esp-4)] px-[var(--esp-4)] py-[var(--esp-6)]">
      <div className="flex items-center gap-[var(--esp-2)]">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ambre opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-ambre" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">
          À venir · palier {route.palier} · lot {route.lot}
        </span>
      </div>
      <h1 className="font-serif-titre text-[32px] leading-[1.15] text-texte max-md:text-[26px]">
        {route.libelle}
      </h1>
      <p className="max-w-[52ch] text-[15px] leading-relaxed text-texte-2">{route.objectif}</p>
    </div>
  );
}
