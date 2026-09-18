import { forwardRef, lazy, Suspense } from "react";
import type { EChartsOption } from "echarts";
import type { ECharts } from "echarts/core";
import { Squelette } from "@/composants/Squelette";
import { useEstMobile } from "@/lib/useEstMobile";

export interface GraphiqueRef {
  dataURL: () => string | null;
  instance: () => ECharts | null;
}

export interface GraphiqueProps {
  option: EChartsOption;
  /** Hauteur bureau ; 260 px sur mobile (DESIGN.md §5), sauf hauteur mobile explicite (Sankey). */
  hauteur?: number;
  hauteurMobile?: number;
  description: string;
  onEvenements?: Record<string, (params: unknown) => void>;
  notMerge?: boolean;
}

/** ECharts est chargé à la demande : le premier écran avec un graphique paie le chargement, pas la coquille. */
const Interne = lazy(() => import("./GraphiqueInterne"));

export const Graphique = forwardRef<GraphiqueRef, GraphiqueProps>(function Graphique(
  { option, hauteur = 320, hauteurMobile, description, onEvenements, notMerge },
  ref,
) {
  const mobile = useEstMobile();
  const h = mobile ? (hauteurMobile ?? Math.min(hauteur, 260)) : hauteur;
  return (
    <Suspense fallback={<Squelette hauteur={h} />}>
      <Interne ref={ref} option={option} hauteur={h} description={description} onEvenements={onEvenements ?? undefined} notMerge={notMerge ?? undefined} />
    </Suspense>
  );
});
