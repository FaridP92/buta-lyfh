import { useEffect, useState } from "react";
import { Menu, Search, Download, Presentation } from "lucide-react";
import { useOptionsFiltres } from "@/app/optionsFiltres";
import { SelecteurMenu } from "@/composants/SelecteurMenu";
import { BadgeFraicheur } from "@/app/BadgeFraicheur";
import { BasculeTheme } from "@/app/BasculeTheme";
import { PaletteCommandes } from "@/app/PaletteCommandes";
import { TiroirMobile } from "@/app/TiroirMobile";
import { useExportEcran } from "@/app/exportEcran";
import { useModePresentation } from "@/app/ModePresentation";
import { BoutonGuideEcran } from "@/composants/GuideEcran";
import { Marque } from "@/composants/identite/Marque";
import { nomFichier, telecharger, versXLSX } from "@/lib/export";

/** Barre haute collante : période, comparaison, agence, guide de l'écran, Cmd K, Exporter, présentation, fraîcheur. */
export function BarreHaute() {
  const { filtres, optionsPeriodes, optionsComparaison, optionsAgence } = useOptionsFiltres();
  const { periode, comparaison, agence, definir } = filtres;
  const feuilles = useExportEcran();
  const presentation = useModePresentation();
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

  function exporterEcran() {
    if (feuilles.length === 0) return;
    telecharger(nomFichier("export-ecran", "xlsx"), versXLSX(feuilles), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  return (
    <>
      <header className="barre-haute sticky top-0 z-20 flex h-[var(--barre-haute-hauteur)] items-center gap-[var(--esp-3)] border-b border-bordure bg-fond/95 px-[var(--esp-4)] backdrop-blur-sm md:pl-[calc(var(--rail-largeur)+var(--esp-4))]">
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
          <SelecteurMenu libelle="Période" options={optionsPeriodes} valeur={periode.param} onChange={(v) => definir("periode", v)} />
          <SelecteurMenu libelle="Vs" options={optionsComparaison} valeur={comparaison} onChange={(v) => definir("comparaison", v)} />
          <SelecteurMenu libelle="Agence" options={optionsAgence} valeur={agence} onChange={(v) => definir("agence", v)} />
        </div>

        <div className="ml-auto flex items-center gap-[var(--esp-2)]">
          <BadgeFraicheur />
          <BoutonGuideEcran />
          <button
            type="button"
            onClick={() => setPaletteOuverte(true)}
            title="Rechercher un écran, une agence ou un indicateur (Cmd K)"
            className="flex h-9 items-center gap-[6px] rounded-[10px] border border-bordure px-[var(--esp-3)] text-[13px] text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte"
          >
            <Search size={14} strokeWidth={1.5} aria-hidden="true" />
            {/* Le libellé reste dans le nom accessible sur mobile (sr-only) : pas d'aria-label qui contredise le texte visible. */}
            <span className="max-2xl:sr-only">Rechercher</span>
            <kbd aria-hidden="true" className="hidden rounded border border-bordure px-[5px] py-[1px] text-[10px] text-texte-3 sm:inline">⌘K</kbd>
          </button>
          <button
            type="button"
            disabled={feuilles.length === 0}
            onClick={exporterEcran}
            title={feuilles.length === 0 ? "Aucun tableau à exporter sur cet écran" : `Exporter ${feuilles.length} tableau(x) de l'écran en XLSX`}
            className="hidden h-9 items-center gap-[6px] rounded-[10px] border border-bordure px-[var(--esp-3)] text-[13px] text-texte-2 transition-colors enabled:hover:bg-surface-2 enabled:hover:text-texte disabled:opacity-40 sm:flex"
          >
            <Download size={14} strokeWidth={1.5} aria-hidden="true" />
            Exporter
          </button>
          <button
            type="button"
            onClick={presentation.basculer}
            aria-label="Mode présentation (touche P) : plein écran, flèches pour changer d'écran"
            title="Mode présentation (touche P) : plein écran, flèches pour changer d'écran"
            className="hidden h-9 w-9 items-center justify-center rounded-[10px] border border-bordure text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte md:flex"
          >
            <Presentation size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <BasculeTheme />
        </div>
      </header>

      <PaletteCommandes ouverte={paletteOuverte} onOuvertureChange={setPaletteOuverte} />
      <TiroirMobile ouvert={tiroirOuvert} onOuvertureChange={setTiroirOuvert} />
    </>
  );
}
