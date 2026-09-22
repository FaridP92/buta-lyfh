import * as Dialog from "@radix-ui/react-dialog";
import { NavLink } from "react-router";
import { X } from "lucide-react";
import { ROUTES } from "@/app/routes";
import { useOptionsFiltres } from "@/app/optionsFiltres";
import { SelecteurMenu } from "@/composants/SelecteurMenu";
import { Marque } from "@/composants/identite/Marque";
import { cn } from "@/lib/cn";

interface TiroirMobileProps {
  ouvert: boolean;
  onOuvertureChange: (ouvert: boolean) => void;
}

/**
 * Tiroir de navigation mobile (375 px) : libellé complet de chaque route, puis les trois filtres globaux
 * (période, comparaison, agence) que la barre haute n'a pas la place d'afficher sur téléphone.
 */
export function TiroirMobile({ ouvert, onOuvertureChange }: TiroirMobileProps) {
  const { filtres, optionsPeriodes, optionsComparaison, optionsAgence } = useOptionsFiltres();

  return (
    <Dialog.Root open={ouvert} onOpenChange={onOuvertureChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="fixed inset-y-0 left-0 z-50 flex w-[80vw] max-w-[320px] flex-col gap-[var(--esp-4)] overflow-y-auto border-r border-bordure bg-surface px-[var(--esp-4)] py-[var(--esp-4)]"
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
          <ul className="flex flex-col gap-[2px]">
            {ROUTES.filter((route) => route.disponible).map((route) => (
              <li key={route.chemin}>
                <NavLink
                  to={route.chemin}
                  viewTransition
                  onClick={() => onOuvertureChange(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-[var(--esp-3)] rounded-[10px] px-[var(--esp-3)] py-[10px] text-[14px] text-texte-2 transition-colors",
                      isActive ? "bg-surface-2 text-accent-texte" : "hover:bg-surface-2 hover:text-texte",
                    )
                  }
                >
                  <route.icone size={18} strokeWidth={1.5} aria-hidden="true" />
                  {route.libelle}
                </NavLink>
              </li>
            ))}
          </ul>
          <section aria-label="Filtres" className="flex flex-col gap-[var(--esp-2)] border-t border-bordure pt-[var(--esp-3)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">Filtres de l'écran</p>
            <SelecteurMenu libelle="Période" options={optionsPeriodes} valeur={filtres.periode.param} onChange={(v) => filtres.definir("periode", v)} className="w-full justify-between" />
            <SelecteurMenu libelle="Vs" options={optionsComparaison} valeur={filtres.comparaison} onChange={(v) => filtres.definir("comparaison", v)} className="w-full justify-between" />
            <SelecteurMenu libelle="Agence" options={optionsAgence} valeur={filtres.agence} onChange={(v) => filtres.definir("agence", v)} className="w-full justify-between" />
            <p className="text-[11px] leading-relaxed text-texte-3">Les filtres vivent dans l'adresse de la page : un lien partagé montre la même vue.</p>
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
