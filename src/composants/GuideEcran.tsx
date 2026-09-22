import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { BookOpen, X } from "lucide-react";
import { useLocation } from "react-router";
import { GUIDES_ECRANS, guideEcran, PROFILS } from "@/lib/guideEcrans";
import { cn } from "@/lib/cn";

interface ContexteGuide {
  ouvrir: (chemin?: string) => void;
}

const Contexte = createContext<ContexteGuide>({ ouvrir: () => undefined });

/**
 * Panneau « Comprendre cet écran » (lot 6) : pour un lecteur étranger au métier, ce que l'écran permet
 * de décider, ce qu'on y trouve, d'où viennent les données, ce qu'il vise, et ce qu'y lit chaque profil.
 * Même contenu que la fiche de présentation par écran (`src/lib/guideEcrans.ts`).
 */
export function FournisseurGuideEcran({ children }: { children: ReactNode }) {
  const [chemin, setChemin] = useState<string | null>(null);
  const { pathname } = useLocation();
  const ouvrir = useCallback((c?: string) => setChemin(c ?? pathname), [pathname]);
  const valeur = useMemo(() => ({ ouvrir }), [ouvrir]);
  const guide = chemin ? guideEcran(chemin) : undefined;
  const index = guide ? GUIDES_ECRANS.indexOf(guide) : -1;

  return (
    <Contexte.Provider value={valeur}>
      {children}
      <Dialog.Root open={chemin !== null} onOpenChange={(o) => !o && setChemin(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col gap-[var(--esp-4)] overflow-y-auto border-l border-bordure bg-surface p-[var(--esp-5)]"
            aria-describedby={undefined}
          >
            {guide ? (
              <>
                <div className="flex items-start justify-between gap-[var(--esp-3)]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-texte">
                      Comprendre cet écran · {index + 1} / {GUIDES_ECRANS.length}
                    </p>
                    <Dialog.Title className="mt-1 font-serif-titre text-[26px] leading-tight text-texte">{guide.libelle}</Dialog.Title>
                    <p className="mt-1 text-[13px] italic text-texte-2">« {guide.question} »</p>
                  </div>
                  <Dialog.Close asChild>
                    <button type="button" aria-label="Fermer le guide" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-texte-2 hover:bg-surface-2">
                      <X size={18} strokeWidth={1.5} />
                    </button>
                  </Dialog.Close>
                </div>

                <p className="text-[14px] leading-relaxed text-texte">{guide.decision}</p>

                <Section titre="Ce qu'on y trouve">
                  <Liste items={guide.contenu} />
                </Section>
                <Section titre="D'où viennent les données">
                  <Liste items={guide.sources} />
                </Section>
                <Section titre="Ce que l'écran vise">
                  <Liste items={guide.vise} />
                </Section>
                <Section titre="Ce qu'y lit chaque direction">
                  <dl className="flex flex-col gap-[var(--esp-2)]">
                    {PROFILS.map((p) => (
                      <div key={p.code} className="rounded-[10px] border border-bordure bg-surface-2 p-[var(--esp-3)]">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">{p.libelle}</dt>
                        <dd className="mt-[2px] text-[13px] leading-relaxed text-texte-2">{guide.lectures[p.code]}</dd>
                      </div>
                    ))}
                  </dl>
                </Section>

                <nav aria-label="Autres écrans" className="mt-auto flex flex-wrap gap-[6px] border-t border-bordure pt-[var(--esp-3)]">
                  {GUIDES_ECRANS.map((g) => (
                    <button
                      key={g.chemin}
                      type="button"
                      onClick={() => setChemin(g.chemin)}
                      aria-current={g.chemin === guide.chemin ? "true" : undefined}
                      className={cn(
                        "rounded-full border border-bordure px-[10px] py-[3px] text-[11px] text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte",
                        g.chemin === guide.chemin && "border-accent/60 text-accent-texte",
                      )}
                    >
                      {g.libelle}
                    </button>
                  ))}
                </nav>
                <p className="text-[11px] text-texte-3">
                  Le même guide, écran par écran, existe en PDF sur la page Méthode (présentation par écran).
                </p>
              </>
            ) : (
              <Dialog.Title className="text-[15px] text-texte-2">Aucun guide pour cet écran.</Dialog.Title>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Contexte.Provider>
  );
}

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-[6px] text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">{titre}</h3>
      {children}
    </section>
  );
}

function Liste({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-[6px] text-[13px] leading-relaxed text-texte-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-[var(--esp-2)]">
          <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function useGuideEcran(): ContexteGuide {
  return useContext(Contexte);
}

/** Bouton de la barre haute : ouvre le guide de l'écran courant. */
export function BoutonGuideEcran({ className }: { className?: string }) {
  const { ouvrir } = useGuideEcran();
  return (
    <button
      type="button"
      onClick={() => ouvrir()}
      title="Comprendre cet écran : ce qu'il montre, d'où viennent les données, ce qu'il vise"
      className={cn(
        "flex h-9 items-center gap-[6px] rounded-[10px] border border-bordure px-[var(--esp-3)] text-[13px] text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte",
        className,
      )}
    >
      <BookOpen size={14} strokeWidth={1.5} aria-hidden="true" />
      <span className="max-2xl:sr-only">Comprendre cet écran</span>
    </button>
  );
}
