import { forwardRef, useImperativeHandle, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, BoxplotChart, HeatmapChart, LineChart, MapChart, PieChart, SankeyChart, ScatterChart, EffectScatterChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  GeoComponent,
  GraphicComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import ReactEChartsCore from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import type { GraphiqueRef } from "./Graphique";

echarts.use([
  BarChart, BoxplotChart, HeatmapChart, LineChart, MapChart, PieChart, SankeyChart, ScatterChart, EffectScatterChart,
  GridComponent, LegendComponent, MarkLineComponent, TooltipComponent, VisualMapComponent, GeoComponent, GraphicComponent,
  CanvasRenderer,
]);

export { echarts };

interface Props {
  option: EChartsOption;
  hauteur: number;
  description: string;
  onEvenements: Record<string, (params: unknown) => void> | undefined;
  notMerge: boolean | undefined;
}

const GraphiqueInterne = forwardRef<GraphiqueRef, Props>(function GraphiqueInterne(
  { option, hauteur, description, onEvenements, notMerge },
  ref,
) {
  const interne = useRef<ReactEChartsCore>(null);
  useImperativeHandle(ref, () => ({
    dataURL: () => interne.current?.getEchartsInstance().getDataURL({ pixelRatio: 2, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() }) ?? null,
    instance: () => interne.current?.getEchartsInstance() ?? null,
  }));
  const reduit = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <div role="img" aria-label={description}>
      <ReactEChartsCore
        ref={interne}
        echarts={echarts}
        option={reduit ? { ...option, animation: false } : option}
        notMerge={notMerge ?? true}
        lazyUpdate
        style={{ height: hauteur, width: "100%" }}
        opts={{ renderer: "canvas" }}
        {...(onEvenements ? { onEvents: onEvenements } : {})}
      />
    </div>
  );
});

export default GraphiqueInterne;
