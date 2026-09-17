import { useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, X } from "lucide-react";
import type { EChartsOption } from "echarts";
import { Carte } from "@/composants/Carte";
import { BoutonFiche } from "@/composants/FicheIndicateur";
import { Graphique, type GraphiqueRef } from "@/graphiques/Graphique";
import { nomFichier, telecharger, versCSV, type ColonneExport, type LigneExport } from "@/lib/export";

interface CarteGraphiqueProps {
  titre: string;
  sousTitre?: string;
  option: EChartsOption;
  hauteur?: number;
  description: string;
  /** Données tabulaires derrière le graphique, pour l'export CSV. */
  exportCSV?: { colonnes: readonly ColonneExport[]; lignes: readonly LigneExport[] };
  /** Vue et filtres à l'origine du graphique, pour « Voir la requête ». */
  requete?: string;
  codeIndicateur?: string;
  onEvenements?: Record<string, (params: unknown) => void>;
  enfantsSous?: ReactNode;
  className?: string;
}

/** Carte + graphique + menu (plein écran, PNG, CSV, requête), DESIGN.md §3 et §5. */
export function CarteGraphique({ titre, sousTitre, option, hauteur = 320, description, exportCSV, requete, codeIndicateur, onEvenements, enfantsSous, className }: CarteGraphiqueProps) {
  const ref = useRef<GraphiqueRef>(null);
  const [pleinEcran, setPleinEcran] = useState(false);
  const [voirRequete, setVoirRequete] = useState(false);

  function png() {
    const url = ref.current?.dataURL();
    if (!url) return;
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nomFichier(titre, "png");
    lien.click();
  }

  function csv() {
    if (!exportCSV) return;
    telecharger(nomFichier(titre, "csv"), versCSV(exportCSV.lignes, exportCSV.colonnes), "text/csv;charset=utf-8");
  }

  const item = "cursor-pointer rounded-[8px] px-[var(--esp-2)] py-[6px] text-[13px] text-texte outline-none data-[highlighted]:bg-surface data-[disabled]:opacity-40";

  const menu = (
    <div className="flex items-center gap-[var(--esp-1)]">
      {codeIndicateur && <BoutonFiche code={codeIndicateur} />}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label={`Menu du graphique ${titre}`} className="flex h-6 w-6 items-center justify-center rounded-full text-texte-3 transition-colors hover:bg-surface-2 hover:text-texte">
            <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-[180px] rounded-[10px] border border-bordure bg-surface-2 p-1 shadow-[var(--ombre-carte)]">
            <DropdownMenu.Item onSelect={() => setPleinEcran(true)} className={item}>Plein écran</DropdownMenu.Item>
            <DropdownMenu.Item onSelect={png} className={item}>Télécharger PNG</DropdownMenu.Item>
            <DropdownMenu.Item onSelect={csv} disabled={!exportCSV} className={item}>Exporter CSV</DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => setVoirRequete(true)} disabled={!requete} className={item}>Voir la requête</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );

  return (
    <>
      <Carte titre={titre} {...(sousTitre ? { sousTitre } : {})} actions={menu} {...(className ? { className } : {})}>
        <Graphique ref={ref} option={option} hauteur={hauteur} description={description} {...(onEvenements ? { onEvenements } : {})} />
        {enfantsSous}
      </Carte>

      <Dialog.Root open={pleinEcran} onOpenChange={setPleinEcran}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
          <Dialog.Content className="fixed inset-[3vh_3vw] z-50 flex flex-col rounded-[var(--rayon-carte)] border border-bordure bg-surface p-[var(--esp-4)]" aria-describedby={undefined}>
            <div className="mb-[var(--esp-3)] flex items-start justify-between">
              <div>
                <Dialog.Title className="text-[15px] font-semibold text-texte">{titre}</Dialog.Title>
                {sousTitre && <p className="text-[12px] text-texte-2">{sousTitre}</p>}
              </div>
              <Dialog.Close asChild>
                <button type="button" aria-label="Quitter le plein écran" className="flex h-9 w-9 items-center justify-center rounded-[10px] text-texte-2 hover:bg-surface-2"><X size={18} strokeWidth={1.5} /></button>
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1">
              {pleinEcran && <Graphique option={option} hauteur={Math.max(320, window.innerHeight * 0.94 - 120)} description={description} />}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={voirRequete} onOpenChange={setVoirRequete}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-[20vh] z-50 w-[92vw] max-w-[640px] -translate-x-1/2 rounded-[var(--rayon-carte)] border border-bordure bg-surface p-[var(--esp-4)]" aria-describedby={undefined}>
            <div className="mb-[var(--esp-3)] flex items-start justify-between">
              <Dialog.Title className="text-[15px] font-semibold text-texte">Requête à l'origine du graphique</Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-[10px] text-texte-2 hover:bg-surface-2"><X size={16} strokeWidth={1.5} /></button>
              </Dialog.Close>
            </div>
            <pre className="chiffre overflow-x-auto whitespace-pre-wrap rounded-[10px] bg-surface-2 p-[var(--esp-3)] text-[12px] leading-relaxed text-texte">{requete}</pre>
            <p className="mt-[var(--esp-2)] text-[12px] text-texte-3">Lecture par PostgREST avec la clé anon ; les vues mart_ sont la seule origine des chiffres.</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
