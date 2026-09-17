import { Badge } from "@/composants/Badge";

export interface SourceAffichee {
  nom: string;
  licence?: string;
  reference?: string;
}

interface LigneSourcesProps {
  sources: SourceAffichee[];
  simule?: boolean;
  hypotheses?: string;
}

/** Ligne « Sources et hypothèses » en bas de chaque écran (ECRANS.md conventions). */
export function LigneSources({ sources, simule = false, hypotheses }: LigneSourcesProps) {
  return (
    <footer className="flex flex-col gap-[var(--esp-2)] border-t border-bordure pt-[var(--esp-3)] text-[12px] text-texte-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-[var(--esp-4)]">
      <span className="font-semibold uppercase tracking-[0.08em] text-texte-3">Sources et hypothèses</span>
      {sources.map((s) => (
        <span key={s.nom}>
          {s.nom}
          {s.licence ? ` · ${s.licence}` : ""}
          {s.reference ? ` · ${s.reference}` : ""}
        </span>
      ))}
      {hypotheses && <span>{hypotheses}</span>}
      {simule && <Badge variante="simule">Données d'activité simulées</Badge>}
    </footer>
  );
}
