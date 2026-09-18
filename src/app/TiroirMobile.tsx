import * as Dialog from "@radix-ui/react-dialog";
import { NavLink } from "react-router";
import { X } from "lucide-react";
import { ROUTES } from "@/app/routes";
import { Marque } from "@/composants/identite/Marque";
import { cn } from "@/lib/cn";

interface TiroirMobileProps {
  ouvert: boolean;
  onOuvertureChange: (ouvert: boolean) => void;
}

/** Tiroir de navigation mobile (375 px), libellé complet de chaque route. */
export function TiroirMobile({ ouvert, onOuvertureChange }: TiroirMobileProps) {
  return (
    <Dialog.Root open={ouvert} onOpenChange={onOuvertureChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="fixed inset-y-0 left-0 z-50 flex w-[80vw] max-w-[320px] flex-col gap-[var(--esp-4)] border-r border-bordure bg-surface px-[var(--esp-4)] py-[var(--esp-4)]"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title asChild>
              <Marque taille={20} />
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fermer la navigation"
                className="flex h-9 w-9 items-center justify-center rounded-[10px] text-texte-2 hover:bg-surface-2"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </Dialog.Close>
          </div>
          <ul className="flex flex-col gap-[2px] overflow-y-auto">
            {ROUTES.filter((route) => route.disponible).map((route) => (
              <li key={route.chemin}>
                <NavLink
                  to={route.chemin}
                  onClick={() => onOuvertureChange(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-[var(--esp-3)] rounded-[10px] px-[var(--esp-3)] py-[10px] text-[14px] text-texte-2 transition-colors",
                      isActive ? "bg-surface-2 text-ambre-texte" : "hover:bg-surface-2 hover:text-texte",
                    )
                  }
                >
                  <route.icone size={18} strokeWidth={1.5} aria-hidden="true" />
                  {route.libelle}
                </NavLink>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
