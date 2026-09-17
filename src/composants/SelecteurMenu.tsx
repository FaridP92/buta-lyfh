import { ChevronDown } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/cn";

interface Option {
  valeur: string;
  libelle: string;
}

interface SelecteurMenuProps {
  libelle: string;
  options: readonly Option[];
  valeur: string;
  onChange: (valeur: string) => void;
  className?: string;
}

/** Selecteur compact de la barre haute (periode, comparaison, agence). */
export function SelecteurMenu({ libelle, options, valeur, onChange, className }: SelecteurMenuProps) {
  const optionActive = options.find((o) => o.valeur === valeur);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 items-center gap-[6px] rounded-[10px] border border-bordure bg-surface px-[var(--esp-3)] text-[13px] text-texte transition-colors hover:bg-surface-2",
            className,
          )}
        >
          <span className="text-texte-3">{libelle}</span>
          <span className="font-medium">{optionActive?.libelle ?? valeur}</span>
          <ChevronDown size={14} strokeWidth={1.5} className="text-texte-3" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-[180px] rounded-[10px] border border-bordure bg-surface-2 p-1 shadow-[var(--ombre-carte)]"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.valeur}
              onSelect={() => onChange(option.valeur)}
              className={cn(
                "cursor-pointer rounded-[8px] px-[var(--esp-2)] py-[6px] text-[13px] text-texte outline-none transition-colors hover:bg-surface data-[highlighted]:bg-surface",
                option.valeur === valeur && "text-ambre-texte",
              )}
            >
              {option.libelle}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
