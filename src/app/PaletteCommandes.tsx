import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { ROUTES } from "@/app/routes";
import { cn } from "@/lib/cn";

interface PaletteCommandesProps {
  ouverte: boolean;
  onOuvertureChange: (ouverte: boolean) => void;
}

/** Palette de commandes Cmd K (DESIGN.md §3) : ecrans, agences, indicateurs. */
export function PaletteCommandes({ ouverte, onOuvertureChange }: PaletteCommandesProps) {
  const [requete, setRequete] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!ouverte) setRequete("");
  }, [ouverte]);

  const resultats = useMemo(() => {
    const q = requete.trim().toLowerCase();
    if (!q) return ROUTES;
    return ROUTES.filter((route) => route.libelle.toLowerCase().includes(q));
  }, [requete]);

  function choisir(chemin: string) {
    navigate(chemin);
    onOuvertureChange(false);
  }

  return (
    <Dialog.Root open={ouverte} onOpenChange={onOuvertureChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="fixed left-1/2 top-[18vh] z-50 w-[92vw] max-w-[560px] -translate-x-1/2 rounded-[14px] border border-bordure bg-surface-2 shadow-[var(--ombre-carte)]"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Palette de commandes</Dialog.Title>
          <div className="flex items-center gap-[var(--esp-2)] border-b border-bordure px-[var(--esp-4)] py-[var(--esp-3)]">
            <Search size={16} strokeWidth={1.5} className="text-texte-3" aria-hidden="true" />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              autoFocus
              value={requete}
              onChange={(e) => setRequete(e.target.value)}
              placeholder="Chercher un ecran, une agence, un indicateur..."
              className="w-full bg-transparent text-[14px] text-texte outline-none placeholder:text-texte-3"
            />
            <kbd className="rounded border border-bordure px-[6px] py-[2px] text-[11px] text-texte-3">Echap</kbd>
          </div>
          <ul className="max-h-[320px] overflow-y-auto p-1">
            {resultats.length === 0 && (
              <li className="px-[var(--esp-4)] py-[var(--esp-4)] text-[13px] text-texte-3">
                Aucun resultat pour « {requete} ».
              </li>
            )}
            {resultats.map((route) => (
              <li key={route.chemin}>
                <button
                  type="button"
                  onClick={() => choisir(route.chemin)}
                  className={cn(
                    "flex w-full items-center gap-[var(--esp-3)] rounded-[10px] px-[var(--esp-3)] py-[10px] text-left text-[13px] text-texte transition-colors hover:bg-surface",
                  )}
                >
                  <route.icone size={16} strokeWidth={1.5} className="text-texte-2" aria-hidden="true" />
                  {route.libelle}
                  {!route.disponible && (
                    <span className="ml-auto text-[11px] text-texte-3">palier {route.palier}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
