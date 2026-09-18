import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/cn";
import { nomFichier, telecharger, versCSV, versXLSX, type LigneExport } from "@/lib/export";

export interface Colonne<L> {
  cle: string;
  libelle: string;
  /** Valeur brute (tri, export) ; par défaut la propriété `cle` de la ligne. */
  valeur?: (ligne: L) => string | number | boolean | null | undefined;
  /** Rendu affiché ; par défaut la valeur brute en texte. */
  rendu?: (ligne: L) => ReactNode;
  numerique?: boolean;
  largeur?: string;
  triable?: boolean;
  /** Masquée sur mobile. */
  secondaire?: boolean;
  /** Masquée sous ce point de rupture (colonne de détail d'un tableau logé dans une carte étroite). */
  masquerSous?: "xl" | "2xl";
}

const CLASSES_MASQUAGE = { xl: "max-xl:hidden", "2xl": "max-2xl:hidden" } as const;

function classesVisibilite(c: { secondaire?: boolean; masquerSous?: "xl" | "2xl" }): string | undefined {
  return cn(c.secondaire && "max-md:hidden", c.masquerSous && CLASSES_MASQUAGE[c.masquerSous]) || undefined;
}

interface TableauProps<L> {
  colonnes: readonly Colonne<L>[];
  lignes: readonly L[];
  cleLigne: (ligne: L) => string;
  triInitial?: { cle: string; sens: "asc" | "desc" };
  /** Ligne mise en avant (agence active) : point ambre dans la marge. */
  estActive?: (ligne: L) => boolean;
  onLigneClic?: (ligne: L) => void;
  nomExport: string;
  vide?: string;
  compact?: boolean;
  /** Dernière ligne traitée comme total (non triée, en gras). */
  ligneTotal?: L;
}

function valeurBrute<L>(colonne: Colonne<L>, ligne: L) {
  return colonne.valeur ? colonne.valeur(ligne) : (ligne as Record<string, unknown>)[colonne.cle] as string | number | boolean | null | undefined;
}

/**
 * Tableau (DESIGN.md §3) : lignes 40 px, en-tête collant, tri par colonne, chiffres alignés à droite en mono,
 * zébrure 3 %, ligne survolée surface haute, export CSV et XLSX, défilement horizontal explicite sur mobile.
 */
export function Tableau<L>({ colonnes, lignes, cleLigne, triInitial, estActive, onLigneClic, nomExport, vide = "Aucune ligne pour cette période.", compact = false, ligneTotal }: TableauProps<L>) {
  const [tri, setTri] = useState<{ cle: string; sens: "asc" | "desc" } | null>(triInitial ?? null);

  const triees = useMemo(() => {
    if (!tri) return lignes;
    const colonne = colonnes.find((c) => c.cle === tri.cle);
    if (!colonne) return lignes;
    return [...lignes].sort((a, b) => {
      const va = valeurBrute(colonne, a);
      const vb = valeurBrute(colonne, b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const r = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "fr");
      return tri.sens === "asc" ? r : -r;
    });
  }, [lignes, tri, colonnes]);

  function basculerTri(cle: string) {
    setTri((t) => (t?.cle === cle ? (t.sens === "desc" ? { cle, sens: "asc" } : null) : { cle, sens: "desc" }));
  }

  function exporter(format: "csv" | "xlsx") {
    const toutes = ligneTotal ? [...triees, ligneTotal] : triees;
    const donnees: LigneExport[] = toutes.map((l) => Object.fromEntries(colonnes.map((c) => [c.cle, valeurBrute(c, l) ?? null])));
    const cols = colonnes.map((c) => ({ cle: c.cle, libelle: c.libelle }));
    if (format === "csv") telecharger(nomFichier(nomExport, "csv"), versCSV(donnees, cols), "text/csv;charset=utf-8");
    else telecharger(nomFichier(nomExport, "xlsx"), versXLSX([{ nom: nomExport.slice(0, 31), colonnes: cols, lignes: donnees }]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  const hauteurLigne = compact ? "h-9" : "h-10";

  return (
    <div className="flex min-w-0 flex-col gap-[var(--esp-2)]">
      <div className="overflow-x-auto [scrollbar-width:thin]">
        <table className="w-full min-w-[560px] border-collapse text-[15px] max-md:text-[13px]">
          <thead className="sticky top-0 z-[1] bg-surface">
            <tr className="border-b border-bordure">
              {colonnes.map((c) => {
                const actif = tri?.cle === c.cle;
                const triable = c.triable !== false;
                return (
                  <th
                    key={c.cle}
                    scope="col"
                    style={c.largeur ? { width: c.largeur } : undefined}
                    className={cn("px-[var(--esp-2)] py-[var(--esp-2)] text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3", c.numerique ? "text-right" : "text-left", classesVisibilite(c))}
                  >
                    {triable ? (
                      <button type="button" onClick={() => basculerTri(c.cle)} className={cn("inline-flex items-center gap-1 hover:text-texte", c.numerique && "flex-row-reverse", actif && "text-texte")} aria-label={`Trier par ${c.libelle}`}>
                        {c.libelle}
                        {actif ? (tri.sens === "desc" ? <ArrowDown size={11} strokeWidth={1.5} aria-hidden="true" /> : <ArrowUp size={11} strokeWidth={1.5} aria-hidden="true" />) : <ArrowUpDown size={11} strokeWidth={1.5} className="opacity-40" aria-hidden="true" />}
                      </button>
                    ) : c.libelle}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {triees.length === 0 && (
              <tr><td colSpan={colonnes.length} className="px-[var(--esp-2)] py-[var(--esp-4)] text-[13px] text-texte-3">{vide}</td></tr>
            )}
            {triees.map((l, i) => {
              const active = estActive?.(l) ?? false;
              return (
                <tr
                  key={cleLigne(l)}
                  onClick={onLigneClic ? () => onLigneClic(l) : undefined}
                  className={cn("relative border-b border-bordure/60 transition-colors hover:bg-surface-2", hauteurLigne, i % 2 === 1 && "bg-[color-mix(in_srgb,var(--texte)_3%,transparent)]", onLigneClic && "cursor-pointer", active && "bg-surface-2")}
                >
                  {colonnes.map((c, j) => (
                    <td key={c.cle} className={cn("px-[var(--esp-2)] align-middle", c.numerique ? "chiffre text-right text-[13px]" : "text-left", classesVisibilite(c), j === 0 && active && "pl-[14px]")}>
                      {j === 0 && active && <span aria-hidden="true" className="absolute left-[2px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-ambre" />}
                      {c.rendu ? c.rendu(l) : String(valeurBrute(c, l) ?? "n. d.")}
                    </td>
                  ))}
                </tr>
              );
            })}
            {ligneTotal && (
              <tr className={cn("border-t border-bordure font-semibold", hauteurLigne)}>
                {colonnes.map((c) => (
                  <td key={c.cle} className={cn("px-[var(--esp-2)] align-middle text-texte", c.numerique ? "chiffre text-right text-[13px]" : "text-left", classesVisibilite(c))}>
                    {c.rendu ? c.rendu(ligneTotal) : String(valeurBrute(c, ligneTotal) ?? "")}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-[var(--esp-2)]">
        <p className="text-[11px] text-texte-3 md:hidden">Faire défiler horizontalement pour les autres colonnes.</p>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="ml-auto inline-flex h-8 items-center gap-[6px] rounded-[10px] border border-bordure px-[var(--esp-2)] text-[12px] text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte">
              <Download size={13} strokeWidth={1.5} aria-hidden="true" />
              Exporter
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-[160px] rounded-[10px] border border-bordure bg-surface-2 p-1 shadow-[var(--ombre-carte)]">
              <DropdownMenu.Item onSelect={() => exporter("csv")} className="cursor-pointer rounded-[8px] px-[var(--esp-2)] py-[6px] text-[13px] text-texte outline-none data-[highlighted]:bg-surface">Fichier CSV</DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => exporter("xlsx")} className="cursor-pointer rounded-[8px] px-[var(--esp-2)] py-[6px] text-[13px] text-texte outline-none data-[highlighted]:bg-surface">Classeur XLSX</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
