import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FeuilleExport } from "@/lib/export";

interface ContexteExport {
  feuilles: FeuilleExport[];
  declarer: (id: string, feuille: FeuilleExport | null) => void;
}

const Contexte = createContext<ContexteExport>({ feuilles: [], declarer: () => undefined });

/** Chaque écran déclare ses tableaux ; le bouton « Exporter » de la barre haute les réunit en un classeur. */
export function FournisseurExportEcran({ children }: { children: ReactNode }) {
  const [feuilles, setFeuilles] = useState<Record<string, FeuilleExport>>({});
  const declarer = useCallback((id: string, feuille: FeuilleExport | null) => {
    setFeuilles((etat) => {
      if (feuille === null) {
        if (!(id in etat)) return etat;
        const copie = { ...etat };
        delete copie[id];
        return copie;
      }
      return { ...etat, [id]: feuille };
    });
  }, []);
  const valeur = useMemo(() => ({ feuilles: Object.values(feuilles), declarer }), [feuilles, declarer]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useExportEcran(): FeuilleExport[] {
  return useContext(Contexte).feuilles;
}

/** À appeler dans un écran : la feuille est retirée quand l'écran se démonte. */
export function useDeclarerExport(id: string, feuille: FeuilleExport | null): void {
  const { declarer } = useContext(Contexte);
  const derniere = useRef<string>("");
  useEffect(() => {
    const signature = feuille ? `${feuille.nom}|${feuille.lignes.length}|${feuille.colonnes.map((c) => c.cle).join(",")}` : "";
    if (signature === derniere.current) return;
    derniere.current = signature;
    declarer(id, feuille);
  }, [id, feuille, declarer]);
  useEffect(() => () => declarer(id, null), [id, declarer]);
}
