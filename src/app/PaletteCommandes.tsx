import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { Building2, Info, Search } from "lucide-react";
import { ROUTES } from "@/app/routes";
import { AGENCES, useFiltres } from "@/app/filtres";
import { useFicheIndicateur } from "@/composants/FicheIndicateur";
import { INDICATEURS } from "@/lib/indicateurs";
import { cn } from "@/lib/cn";
import { correspond, normaliser } from "@/lib/recherche";

interface PaletteCommandesProps {
  ouverte: boolean;
  onOuvertureChange: (ouverte: boolean) => void;
}

interface Commande {
  cle: string;
  groupe: "Écrans" | "Agences" | "Indicateurs";
  libelle: string;
  detail?: string;
  /** Texte de recherche principal (libellé, code), sans accents ni majuscules ; les correspondances y passent en premier. */
  cible: string;
  /** Texte de recherche secondaire (définition, objectif). */
  cibleSecondaire: string;
  executer: () => void;
}

/** Palette de commandes Cmd K (DESIGN.md §3) : écrans, agences (filtre de l'écran courant), fiches d'indicateurs. Clavier : flèches, Entrée, Échap. */
export function PaletteCommandes({ ouverte, onOuvertureChange }: PaletteCommandesProps) {
  const [requete, setRequete] = useState("");
  const [actif, setActif] = useState(0);
  const navigate = useNavigate();
  const filtres = useFiltres();
  const { ouvrir } = useFicheIndicateur();
  const liste = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!ouverte) setRequete("");
    setActif(0);
  }, [ouverte]);

  const commandes = useMemo<Commande[]>(() => {
    const fermer = () => onOuvertureChange(false);
    const ecrans: Commande[] = ROUTES.map((r) => ({
      cle: `ecran:${r.chemin}`, groupe: "Écrans", libelle: r.libelle, cible: normaliser(r.libelle), cibleSecondaire: normaliser(r.objectif),
      ...(r.disponible ? {} : { detail: `palier ${r.palier}` }),
      executer: () => { navigate(r.chemin); fermer(); },
    }));
    const agences: Commande[] = [
      { cle: "agence:toutes", groupe: "Agences", libelle: "Toutes les agences", detail: "réseau entier", cible: "toutes les agences reseau", cibleSecondaire: "", executer: () => { filtres.definir("agence", "toutes"); fermer(); } },
      ...AGENCES.map((a) => ({
        cle: `agence:${a.code}`, groupe: "Agences" as const, libelle: a.nom, detail: filtres.agence === a.code ? "agence active" : "filtrer l'écran courant", cible: normaliser(`${a.nom} ${a.code}`), cibleSecondaire: "agence",
        executer: () => { filtres.definir("agence", a.code); fermer(); },
      })),
    ];
    const indicateurs: Commande[] = INDICATEURS.map((i) => ({
      cle: `indicateur:${i.code}`, groupe: "Indicateurs", libelle: i.libelle, detail: i.code, cible: normaliser(`${i.libelle} ${i.code}`), cibleSecondaire: normaliser(i.definition),
      executer: () => { ouvrir(i.code); fermer(); },
    }));
    return [...ecrans, ...agences, ...indicateurs];
  }, [navigate, onOuvertureChange, filtres, ouvrir]);

  const resultats = useMemo(() => {
    const q = requete.trim();
    if (!q) return commandes.filter((c) => c.groupe !== "Indicateurs");
    // Les correspondances sur le libellé ou le code passent avant celles sur la définition, à ordre égal sinon.
    const principales = commandes.filter((c) => correspond(c.cible, q));
    const secondaires = commandes.filter((c) => !principales.includes(c) && correspond(`${c.cible} ${c.cibleSecondaire}`, q));
    return [...principales, ...secondaires].slice(0, 30);
  }, [commandes, requete]);

  useEffect(() => {
    setActif(0);
  }, [requete]);

  useEffect(() => {
    liste.current?.querySelector<HTMLElement>(`[data-index="${actif}"]`)?.scrollIntoView({ block: "nearest" });
  }, [actif]);

  function surClavier(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((i) => Math.min(resultats.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      resultats[actif]?.executer();
    }
  }

  const groupes = ["Écrans", "Agences", "Indicateurs"] as const;

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
              onKeyDown={surClavier}
              placeholder="Chercher un écran, une agence, un indicateur…"
              className="w-full bg-transparent text-[14px] text-texte outline-none placeholder:text-texte-3"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-resultats"
              aria-activedescendant={resultats[actif] ? `palette-${resultats[actif].cle}` : undefined}
              aria-autocomplete="list"
            />
            <kbd className="rounded border border-bordure px-[6px] py-[2px] text-[11px] text-texte-3">Échap</kbd>
          </div>
          <ul ref={liste} id="palette-resultats" role="listbox" className="max-h-[360px] overflow-y-auto p-1">
            {resultats.length === 0 && (
              <li className="px-[var(--esp-4)] py-[var(--esp-4)] text-[13px] text-texte-3">
                Aucun résultat pour « {requete} ».
              </li>
            )}
            {groupes.map((groupe) => {
              const du = resultats.filter((c) => c.groupe === groupe);
              if (du.length === 0) return null;
              return (
                <li key={groupe} role="presentation">
                  <p className="px-[var(--esp-3)] pb-1 pt-[var(--esp-2)] text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">{groupe}</p>
                  <ul role="group" aria-label={groupe}>
                    {du.map((c) => {
                      const index = resultats.indexOf(c);
                      const route = c.groupe === "Écrans" ? ROUTES.find((r) => `ecran:${r.chemin}` === c.cle) : undefined;
                      const Icone = route ? route.icone : c.groupe === "Agences" ? Building2 : Info;
                      return (
                        <li key={c.cle} id={`palette-${c.cle}`} role="option" aria-selected={index === actif} data-index={index}>
                          <button
                            type="button"
                            onClick={c.executer}
                            onMouseEnter={() => setActif(index)}
                            tabIndex={-1}
                            className={cn("flex w-full items-center gap-[var(--esp-3)] rounded-[10px] px-[var(--esp-3)] py-[9px] text-left text-[13px] text-texte transition-colors", index === actif && "bg-surface")}
                          >
                            <Icone size={16} strokeWidth={1.5} className="shrink-0 text-texte-2" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate">{c.libelle}</span>
                            {c.detail && <span className="ml-auto shrink-0 text-[11px] text-texte-3">{c.detail}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-bordure px-[var(--esp-4)] py-[6px] text-[11px] text-texte-3">Flèches pour parcourir, Entrée pour ouvrir. Les agences filtrent l'écran courant ; les indicateurs ouvrent leur fiche.</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
