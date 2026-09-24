import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { nomAgence } from "@/app/filtres";
import { useOptionsFiltres } from "@/app/optionsFiltres";
import { SelecteurMenu } from "@/composants/SelecteurMenu";

/**
 * Filtres sur téléphone (ECRANS.md conventions, remarque du 24 septembre) : la première ligne de la barre haute
 * n'a pas la place des trois sélecteurs (23 px libres à 375 px), et des filtres cachés dans le tiroir ne se
 * trouvent pas. Une seconde ligne de la barre porte donc un bouton qui dit la vue active (période, comparaison,
 * périmètre) et ouvre un panneau du bas avec les trois sélecteurs. Les filtres restent dans l'adresse de la page.
 */
export function FiltresMobile() {
  const { filtres, optionsPeriodes, optionsComparaison, optionsAgence } = useOptionsFiltres();
  const [ouvert, setOuvert] = useState(false);
  const comparaisonLibelle = optionsComparaison.find((o) => o.valeur === filtres.comparaison)?.libelle ?? filtres.comparaison;
  const perimetre = filtres.agence === "toutes" ? "Réseau" : nomAgence(filtres.agence);

  return (
    <Dialog.Root open={ouvert} onOpenChange={setOuvert}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex h-10 w-full items-center gap-[var(--esp-2)] rounded-[10px] border border-bordure bg-surface px-[var(--esp-3)] text-[13px] text-texte transition-colors hover:bg-surface-2"
        >
          <SlidersHorizontal size={15} strokeWidth={1.5} className="shrink-0 text-accent-texte" aria-hidden="true" />
          <span className="sr-only">Filtres : </span>
          <span className="min-w-0 flex-1 truncate text-left">
            <span className="font-medium">{filtres.periode.libelle}</span>
            <span className="text-texte-3"> · vs </span>
            <span className="font-medium">{comparaisonLibelle}</span>
            <span className="text-texte-3"> · </span>
            <span className="font-medium">{perimetre}</span>
          </span>
          <ChevronDown size={14} strokeWidth={1.5} className="shrink-0 text-texte-3" aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col gap-[var(--esp-3)] overflow-y-auto rounded-t-[16px] border-t border-bordure bg-surface px-[var(--esp-4)] pb-[max(var(--esp-4),env(safe-area-inset-bottom))] pt-[var(--esp-3)]"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">Filtres de l'écran</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fermer les filtres"
                className="flex h-10 w-10 items-center justify-center rounded-[10px] text-texte-2 hover:bg-surface-2"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </Dialog.Close>
          </div>
          <SelecteurMenu libelle="Période" options={optionsPeriodes} valeur={filtres.periode.param} onChange={(v) => filtres.definir("periode", v)} className="h-10 w-full justify-between" />
          <SelecteurMenu libelle="Vs" options={optionsComparaison} valeur={filtres.comparaison} onChange={(v) => filtres.definir("comparaison", v)} className="h-10 w-full justify-between" />
          <SelecteurMenu libelle="Agence" options={optionsAgence} valeur={filtres.agence} onChange={(v) => filtres.definir("agence", v)} className="h-10 w-full justify-between" />
          <p className="text-[11px] leading-relaxed text-texte-3">Chaque choix s'applique aussitôt. Les filtres vivent dans l'adresse de la page : un lien partagé montre la même vue.</p>
          <Dialog.Close asChild>
            <button
              type="button"
              className="bouton-primaire flex h-10 items-center justify-center rounded-[10px] px-[var(--esp-3)] text-[13px] font-medium"
            >
              Terminé
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
