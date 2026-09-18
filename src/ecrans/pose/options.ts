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
  // Ambre à demi-opacité pour le palier intermédiaire (les jetons sont des hexadécimaux à six chiffres).
  const ambreDoux = /^#[0-9a-f]{6}$/i.test(t.ambre) ? `${t.ambre}80` : t.ambre;
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
    // Paliers lisibles plutôt qu'un dégradé écrêté à 100 % : la surcharge (au-delà de la capacité) a sa propre couleur.
    visualMap: {
      type: "piecewise", orient: "horizontal", left: "center", bottom: 0, itemWidth: 12, itemHeight: 10, itemGap: 8, dimension: 2,
      textStyle: { color: t.texte3, fontSize: 11 },
      pieces: [
        { max: 50, label: "moins de 50 %", color: t.surface2 },
        { min: 50, max: 80, label: "50 à 80 %", color: ambreDoux },
        { min: 80, max: 100, label: "80 à 100 %", color: t.ambre },
        { min: 100, label: "plus de 100 %, surcharge", color: t.alerte },
      ],
    },
    series: [{
      type: "heatmap",
      // Les semaines sans pose (charge inconnue) restent vides : pas de fausse case à 0 %.
      data: cellules.filter((c) => c.charge !== null).map((c) => ({
        value: [semaines.indexOf(c.semaine), agences.findIndex((a) => a.code === c.agence), c.charge as number],
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
