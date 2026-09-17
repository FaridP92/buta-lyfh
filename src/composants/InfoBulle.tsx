import type { ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

interface InfoBulleProps {
  contenu: ReactNode;
  children: ReactNode;
  delaiMs?: number;
  cote?: "top" | "right" | "bottom" | "left";
}

/** Info-bulle maison (DESIGN.md §3) : 12 px, fond surface haute, flèche. */
export function InfoBulle({ contenu, children, delaiMs = 200, cote = "right" }: InfoBulleProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delaiMs}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={cote}
            sideOffset={8}
            className="z-50 rounded-md border border-bordure bg-surface-2 px-[var(--esp-2)] py-[6px] text-[12px] text-texte shadow-[var(--ombre-carte)]"
          >
            {contenu}
            <TooltipPrimitive.Arrow className="fill-surface-2" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
