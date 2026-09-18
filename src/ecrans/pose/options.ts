import type { EChartsOption } from "echarts";
import { libelleMoisAxe, optionBase, type TokensGraphique } from "@/graphiques/theme";
import { formatDateCourte, formatDelaiJours, formatNombre, formatTaux } from "@/lib/format";
import type { CelluleCharge } from "@/lib/pose";

/**
 * Calendrier de charge (ECRANS.md §6) : semaines en colonnes, agences en lignes, couleur = charge en part de la
 * capacité (réalisée pour les semaines passées, cadre plein ; planifiée ensuite, cadre pointillé).
 */
export function optionCalendrierCharge(semaines: readonly string[], agences: readonly { code: string; nom: string }[], cellules: readonly CelluleCharge[], t: TokensGraphique, mobile = false): EChartsOption {
  const base = optionBase(t);
  return {
    ...base,
    grid: { left: 8, right: mobile ? 8 : 16, top: 8, bottom: mobile ? 56 : 48, containLabel: true },
    tooltip: { ...base.tooltip, trigger: "item", formatter: (p: unknown) => {
      const { value } = p as { value: [number, number, number | null] };
      const c = cellules.find((x) => semaines.indexOf(x.semaine) === value[0] && agences.findIndex((a) => a.code === x.agence) === value[1]);
      if (!c) return "";
      const nom = agences.find((a) => a.code === c.agence)?.nom ?? c.agence;
      return `<b>${nom}</b> · semaine du ${formatDateCourte(c.semaine)}<br/>${c.type === "realisee" ? "charge réalisée" : "charge planifiée"} : <b>${c.charge === null ? "n. d." : formatTaux(c.charge, 0)}</b> de la capacité<br/>${formatNombre(c.poses)} pose${c.poses > 1 ? "s" : ""} ${c.type === "realisee" ? "réalisées" : "planifiées"}`;
    } },
    xAxis: { ...base.xAxis, type: "category", data: semaines.map((s) => formatDateCourte(s)), splitArea: { show: false }, axisLabel: { ...base.xAxis.axisLabel, interval: mobile ? 2 : 0, fontSize: 11 } },
    yAxis: { ...base.yAxis, type: "category", inverse: true, data: agences.map((a) => (mobile ? a.code : a.nom)), splitArea: { show: false }, axisLabel: { ...base.yAxis.axisLabel, fontSize: 11 } },
    visualMap: {
      type: "continuous", min: 0, max: 100, orient: "horizontal", left: "center", bottom: 0, itemWidth: 10, itemHeight: 120,
      text: ["100 %", "0 %"], textStyle: { color: t.texte3, fontSize: 11 }, inRange: { color: [t.surface2, t.ambre, t.alerte] }, calculable: false,
    },
    series: [{
      type: "heatmap",
      data: cellules.map((c) => ({
        value: [semaines.indexOf(c.semaine), agences.findIndex((a) => a.code === c.agence), c.charge === null ? 0 : Math.min(120, c.charge)],
        itemStyle: c.type === "realisee" ? { borderColor: t.fond, borderWidth: 2 } : { borderColor: t.texte3, borderWidth: 1, borderType: "dashed" as const },
      })),
      label: { show: !mobile, color: t.texte, fontFamily: t.mono, fontSize: 10, formatter: (p: unknown) => { const v = (p as { value: [number, number, number] }).value[2]; return v > 0 ? `${Math.round(v)}` : ""; } },
      itemStyle: { borderColor: t.fond, borderWidth: 2, borderRadius: 4 },
      emphasis: { itemStyle: { borderColor: t.texte, borderWidth: 1 } },
      animationDuration: 500,
    }],
  };
}

/** Délai signature vers pose par mois : sur place contre à distance (H5), avec les poses en retard du réseau en barres fines. */
export function optionDelaiCouverture(mois: readonly string[], surPlace: readonly (number | null)[], aDistance: readonly (number | null)[], t: TokensGraphique, mobile = false): EChartsOption {
  const base = optionBase(t);
  return {
    ...base,
    grid: { left: 8, right: 16, top: mobile ? 68 : 40, bottom: 8, containLabel: true },
    legend: { ...base.legend, data: ["Sur place (département avec agence)", "À distance (département sans agence)"] },
    xAxis: { ...base.xAxis, type: "category", boundaryGap: false, data: mois.map((m) => libelleMoisAxe(m)), axisLabel: { ...base.xAxis.axisLabel, interval: mobile ? 1 : 0 } },
    yAxis: { ...base.yAxis, type: "value", name: "jours", nameTextStyle: { color: t.texte3, fontSize: 11, align: "left" }, axisLabel: { ...base.yAxis.axisLabel, formatter: (v: number) => formatNombre(v) } },
    tooltip: { ...base.tooltip, trigger: "axis", valueFormatter: (v: unknown) => (typeof v === "number" ? formatDelaiJours(v) : "n. d."), axisPointer: { type: "line", lineStyle: { color: t.texte3 } } },
    series: [
      { name: "Sur place (département avec agence)", type: "line", data: [...surPlace], symbol: "circle", symbolSize: 5, lineStyle: { color: t.menthe, width: 2 }, itemStyle: { color: t.menthe }, connectNulls: true, animationDuration: 600,
        markLine: { silent: true, symbol: "none", animation: false, lineStyle: { color: t.texte3, type: "dotted" }, label: { color: t.texte3, fontSize: 11, fontFamily: t.police, formatter: "objectif 60 jours", position: "insideEndTop" }, data: [{ yAxis: 60 }] } },
      { name: "À distance (département sans agence)", type: "line", data: [...aDistance], symbol: "circle", symbolSize: 5, lineStyle: { color: t.alerte, width: 2 }, itemStyle: { color: t.alerte }, connectNulls: true, animationDuration: 600, animationDelay: 150 },
    ],
  };
}
