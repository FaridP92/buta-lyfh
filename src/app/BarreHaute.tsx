import { useEffect, useState } from "react";
import { Menu, Search, Download } from "lucide-react";
import { AGENCES, useFiltresURL } from "@/app/filtres";
import { SelecteurMenu } from "@/composants/SelecteurMenu";
import { BadgeFraicheur } from "@/app/BadgeFraicheur";
import { BasculeTheme } from "@/app/BasculeTheme";
import { PaletteCommandes } from "@/app/PaletteCommandes";
import { TiroirMobile } from "@/app/TiroirMobile";
import { Marque } from "@/composants/identite/Marque";
import { formatMoisAbrege } from "@/lib/format";

const OPTIONS_COMPARAISON = [
  { valeur: "objectif", libelle: "Objectif" },
  { valeur: "n1", libelle: "N-1" },
];

/** Barre haute collante : periode, comparaison, agence, Cmd K, Exporter, fraicheur. */
export function BarreHaute() {
  const { periode, comparaison, agence, definir } = useFiltresURL();
  const [paletteOuverte, setPaletteOuverte] = useState(false);
  const [tiroirOuvert, setTiroirOuvert] = useState(false);

  useEffect(() => {
    function surAppuiClavier(evenement: KeyboardEvent) {
      const estRaccourci = (evenement.metaKey || evenement.ctrlKey) && evenement.key.toLowerCase() === "k";
      if (estRaccourci) {
        evenement.preventDefault();
        setPaletteOuverte((valeur) => !valeur);
      }
    }
    window.addEventListener("keydown", surAppuiClavier);
    return () => window.removeEventListener("keydown", surAppuiClavier);
  }, []);

  const optionsPeriode = [{ valeur: periode, libelle: formatMoisAbrege(`${periode}-01`) }];
  const optionsAgence = [
    { valeur: "toutes", libelle: "Toutes les agences" },
    ...AGENCES.map((a) => ({ valeur: a.code, libelle: a.nom })),
  ];

  return (
    <>
      <header className="sticky top-0 z-20 flex h-[var(--barre-haute-hauteur)] items-center gap-[var(--esp-3)] border-b border-bordure bg-fond/95 px-[var(--esp-4)] backdrop-blur-sm md:pl-[calc(var(--rail-largeur)+var(--esp-4))]">
        <button
          type="button"
          onClick={() => setTiroirOuvert(true)}
          aria-label="Ouvrir la navigation"
          className="flex h-9 w-9 items-center justify-center rounded-[10px] text-texte-2 hover:bg-surface-2 md:hidden"
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>

        <div className="md:hidden">
          <Marque taille={17} />
        </div>

        <div className="hidden items-center gap-[var(--esp-2)] md:flex">
          <SelecteurMenu
            libelle="Periode"
            options={optionsPeriode}
            valeur={periode}
            onChange={(v) => definir("periode", v)}
          />
          <SelecteurMenu
            libelle="Vs"
            options={OPTIONS_COMPARAISON}
            valeur={comparaison}
            onChange={(v) => definir("comparaison", v)}
          />
          <SelecteurMenu
            libelle="Agence"
            options={optionsAgence}
            valeur={agence}
            onChange={(v) => definir("agence", v)}
          />
        </div>

        <div className="ml-auto flex items-center gap-[var(--esp-2)]">
          <BadgeFraicheur />
          <button
            type="button"
            onClick={() => setPaletteOuverte(true)}
            aria-label="Rechercher un ecran, une agence ou un indicateur (Cmd K)"
            className="flex h-9 items-center gap-[6px] rounded-[10px] border border-bordure px-[var(--esp-3)] text-[13px] text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte"
          >
            <Search size={14} strokeWidth={1.5} aria-hidden="true" />
            <span className="hidden sm:inline">Rechercher</span>
            <kbd className="hidden rounded border border-bordure px-[5px] py-[1px] text-[10px] text-texte-3 sm:inline">
              ⌘K
            </kbd>
          </button>
          <button
            type="button"
            disabled
            title="Disponible avec les premiers tableaux (lot 2)"
            className="hidden h-9 items-center gap-[6px] rounded-[10px] border border-bordure px-[var(--esp-3)] text-[13px] text-texte-2 opacity-40 sm:flex"
          >
            <Download size={14} strokeWidth={1.5} aria-hidden="true" />
            Exporter
          </button>
          <BasculeTheme />
        </div>
      </header>

      <PaletteCommandes ouverte={paletteOuverte} onOuvertureChange={setPaletteOuverte} />
      <TiroirMobile ouvert={tiroirOuvert} onOuvertureChange={setTiroirOuvert} />
    </>
  );
}
