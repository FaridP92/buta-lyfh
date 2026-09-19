import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Info, X } from "lucide-react";
import { ficheIndicateur, LIBELLE_SENS } from "@/lib/indicateurs";
import { cn } from "@/lib/cn";

interface ContexteFiche {
  ouvrir: (code: string) => void;
}

const Contexte = createContext<ContexteFiche>({ ouvrir: () => undefined });

/** Panneau latéral 420 px (DESIGN.md §3) : définition, formule, grain, vue, source, sens de lecture. */
export function FournisseurFicheIndicateur({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string | null>(null);
  const ouvrir = useCallback((c: string) => setCode(c), []);
  const valeur = useMemo(() => ({ ouvrir }), [ouvrir]);
  const fiche = code ? ficheIndicateur(code) : undefined;

  return (
    <Contexte.Provider value={valeur}>
      {children}
      <Dialog.Root open={code !== null} onOpenChange={(o) => !o && setCode(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col gap-[var(--esp-4)] overflow-y-auto border-l border-bordure bg-surface p-[var(--esp-5)]"
            aria-describedby={undefined}
          >
            {fiche ? (
              <>
                <div className="flex items-start justify-between gap-[var(--esp-3)]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-texte">Fiche indicateur · {fiche.code}</p>
                    <Dialog.Title className="mt-1 font-serif-titre text-[26px] leading-tight text-texte">{fiche.libelle}</Dialog.Title>
                  </div>
                  <Dialog.Close asChild>
                    <button type="button" aria-label="Fermer la fiche" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-texte-2 hover:bg-surface-2">
                      <X size={18} strokeWidth={1.5} />
                    </button>
                  </Dialog.Close>
                </div>
                <dl className="flex flex-col gap-[var(--esp-3)] text-[13px]">
                  <Champ titre="Définition">{fiche.definition}</Champ>
                  <Champ titre="Formule"><code className="chiffre text-[12px] text-texte">{fiche.formule}</code></Champ>
                  <Champ titre="Grain">{fiche.grain}</Champ>
                  <Champ titre="Vue SQL"><code className="chiffre text-[12px] text-texte">buta.{fiche.vue}</code></Champ>
                  <Champ titre="Sens de lecture">{LIBELLE_SENS[fiche.sens]}</Champ>
                  <Champ titre="Source">{fiche.source}</Champ>
                  {fiche.note && <Champ titre="Note">{fiche.note}</Champ>}
                </dl>
              </>
            ) : (
              <Dialog.Title className="text-[15px] text-texte-2">Indicateur inconnu.</Dialog.Title>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Contexte.Provider>
  );
}

function Champ({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">{titre}</dt>
      <dd className="mt-[2px] leading-relaxed text-texte-2">{children}</dd>
    </div>
  );
}

export function useFicheIndicateur(): ContexteFiche {
  return useContext(Contexte);
}

/** Le bouton « i » d'une carte KPI ou d'un graphique. */
export function BoutonFiche({ code, className }: { code: string; className?: string }) {
  const { ouvrir } = useFicheIndicateur();
  return (
    <button
      type="button"
      onClick={() => ouvrir(code)}
      aria-label={`Fiche de l'indicateur ${code}`}
      className={cn("flex h-6 w-6 items-center justify-center rounded-full text-texte-3 transition-colors hover:bg-surface-2 hover:text-texte", className)}
    >
      <Info size={14} strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}
