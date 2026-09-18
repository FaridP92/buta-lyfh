import type { EChartsOption } from "echarts";
import { libelleMoisAxe, optionBase, type TokensGraphique } from "@/graphiques/theme";
import { formatMontant } from "@/lib/format";
import type { Trajectoire } from "@/lib/forecast";

/**
 * Éventail d'atterrissage (ECRANS.md §5, DESIGN.md §11) : réalisé cumulé, objectif cumulé, ligne
 * « aujourd'hui », puis le central qui pousse vers décembre en 1 000 ms et les bornes qui suivent.
 * L'aire entre les bornes est dessinée par deux séries empilées (bas transparent, haut moins bas coloré).
 */
export function optionEventail(t: Trajectoire, moisCourant: number, objectifAnnuel: number, journeeLibelle: string, tokens: TokensGraphique, mobile = false): EChartsOption {
  const base = optionBase(tokens);
  const largeurBande = t.haut.map((h, i) => (h === null || t.bas[i] === null ? null : h - (t.bas[i] as number)));
  const montant = (v: unknown) => (typeof v === "number" ? formatMontant(v) : "n. d.");
  return {
    ...base,
    // La légende passe sur deux lignes en mobile : plus de place au-dessus du tracé.
    grid: { left: 8, right: mobile ? 12 : 24, top: mobile ? 64 : 40, bottom: 8, containLabel: true },
    legend: { ...base.legend, data: ["Réalisé cumulé", "Objectif cumulé", "Central", "Intervalle à 68 %"] },
    xAxis: { ...base.xAxis, type: "category", boundaryGap: false, data: t.mois.map((m) => libelleMoisAxe(m)), axisLabel: { ...base.xAxis.axisLabel, interval: mobile ? 1 : 0 } },
    yAxis: { ...base.yAxis, type: "value", axisLabel: { ...base.yAxis.axisLabel, formatter: (v: number) => formatMontant(v) } },
    tooltip: { ...base.tooltip, trigger: "axis", valueFormatter: montant, axisPointer: { type: "line", lineStyle: { color: tokens.texte3 } } },
    series: [
      {
        name: "Réalisé cumulé", type: "line", data: [...t.realiseCumule], symbol: "circle", symbolSize: 5, connectNulls: false,
        lineStyle: { color: tokens.ambre, width: 2 }, itemStyle: { color: tokens.ambre }, animationDuration: 400, z: 4,
        markLine: {
          silent: true, symbol: "none", animation: false,
          lineStyle: { color: tokens.texte3, type: "dashed", width: 1 },
          label: { color: tokens.texte3, fontSize: 11, fontFamily: tokens.police, formatter: (p: unknown) => String((p as { name: string }).name) },
          data: [
            { xAxis: moisCourant - 1, name: `journée publiée ${journeeLibelle}`, label: { position: "insideEndTop" } },
            { yAxis: objectifAnnuel, name: `objectif ${t.mois[0]?.slice(0, 4) ?? ""} : ${formatMontant(objectifAnnuel)}`, lineStyle: { color: tokens.menthe, type: "dotted" }, label: { position: "insideEndBottom", color: tokens.menthe, show: !mobile } },
          ],
        },
      },
      { name: "Objectif cumulé", type: "line", data: [...t.objectifCumule], symbol: "none", lineStyle: { color: tokens.menthe, width: 1.5, type: "dashed" }, itemStyle: { color: tokens.menthe }, animationDuration: 400, z: 3 },
      // Bande : socle transparent puis épaisseur colorée, empilés.
      { name: "bas", type: "line", stack: "bande", data: [...t.bas], symbol: "none", lineStyle: { opacity: 0 }, itemStyle: { opacity: 0 }, tooltip: { show: false }, animationDuration: 800, animationDelay: 500, z: 1 },
      { name: "Intervalle à 68 %", type: "line", stack: "bande", data: largeurBande, symbol: "none", lineStyle: { opacity: 0 }, itemStyle: { color: tokens.ambre }, areaStyle: { color: tokens.ambre, opacity: 0.14 }, tooltip: { show: false }, animationDuration: 800, animationDelay: 500, z: 1 },
      { name: "Central", type: "line", data: [...t.central], symbol: "none", lineStyle: { color: tokens.ambre, width: 1.5, type: "dashed" }, itemStyle: { color: tokens.ambre }, animationDuration: 1000, animationEasing: "cubicOut", z: 3 },
      { name: "Bas", type: "line", data: [...t.bas], symbol: "none", lineStyle: { color: tokens.ambre, width: 1, opacity: 0.5 }, itemStyle: { color: tokens.ambre }, animationDuration: 800, animationDelay: 500, z: 2 },
      { name: "Haut", type: "line", data: [...t.haut], symbol: "none", lineStyle: { color: tokens.ambre, width: 1, opacity: 0.5 }, itemStyle: { color: tokens.ambre }, animationDuration: 800, animationDelay: 500, z: 2 },
    ],
  };
}
