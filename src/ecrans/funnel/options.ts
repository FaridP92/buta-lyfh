import type { EChartsOption } from "echarts";
import { libelleMoisAxe, optionBase, type TokensGraphique } from "@/graphiques/theme";
import { formatNombre, formatTaux } from "@/lib/format";
import type { LienSankey, NoeudSankey } from "@/lib/funnel";

/** Sankey du parcours (DESIGN.md §11 : coule de gauche à droite en 800 ms, se réorganise sans disparaître au changement de filtre). */
export function optionSankey(noeuds: readonly NoeudSankey[], liens: readonly LienSankey[], total: number, t: TokensGraphique, mobile = false): EChartsOption {
  const base = optionBase(t);
  const couleur = (n: NoeudSankey) => (n.type === "etape" ? t.ambre : n.type === "perte" ? t.alerte : t.texte3);
  return {
    ...base,
    animationDuration: 800,
    animationDurationUpdate: 600,
    tooltip: { ...base.tooltip, trigger: "item", formatter: (p: unknown) => {
      const { dataType, name, value, data } = p as { dataType: string; name: string; value: number; data: { source?: string; target?: string } };
      if (dataType === "edge") return `${data.source} → ${data.target} : <b>${formatNombre(value)}</b>${total > 0 ? ` · ${formatTaux((100 * value) / total)} des leads` : ""}`;
      return `${name} : <b>${formatNombre(value)}</b>${total > 0 ? ` · ${formatTaux((100 * value) / total)} des leads` : ""}`;
    } },
    series: [{
      // Sur téléphone, le flux se lit de haut en bas : les libellés ont toute la largeur au lieu de s'empiler dans le tiers droit.
      type: "sankey", left: 8, right: mobile ? 8 : 150, top: mobile ? 8 : 12, bottom: mobile ? 8 : 12, orient: mobile ? "vertical" : "horizontal",
      // Alignement à gauche : chaque perte sort juste après son étape, au lieu d'être rejetée en dernière colonne.
      nodeWidth: mobile ? 12 : 14, nodeGap: mobile ? 14 : 16, nodeAlign: "left", draggable: false,
      emphasis: { focus: "adjacency" },
      data: noeuds.map((n) => ({ name: n.nom, itemStyle: { color: couleur(n), borderWidth: 0 } })),
      links: liens.map((l) => ({ source: l.source, target: l.cible, value: l.valeur })),
      lineStyle: { color: "gradient", opacity: 0.28, curveness: 0.5 },
      // Mobile : libellé sur deux lignes (nom puis nombre) pour tenir dans la largeur.
      label: { color: t.texte, fontFamily: t.police, fontSize: mobile ? 10 : 12, lineHeight: mobile ? 12 : 16, formatter: (p: unknown) => {
        const { name, value } = p as { name: string; value: number };
        return mobile ? `${name}\n{chiffre|${formatNombre(value)}}` : `${name}  {chiffre|${formatNombre(value)}}`;
      }, rich: { chiffre: { color: t.texte2, fontFamily: t.mono, fontSize: mobile ? 10 : 11 } } },
    }],
  };
}

/** Leads mensuels par canal en barres empilées et ventes nettes de la cohorte en courbe sur un second axe. */
export function optionCourbeCanaux(mois: readonly string[], canaux: readonly { code: string; libelle: string; valeurs: readonly number[] }[], ventes: readonly (number | null)[], t: TokensGraphique, mobile = false): EChartsOption {
  const base = optionBase(t);
  return {
    ...base,
    // Assez de place sous la légende de huit canaux (deux lignes) pour les titres d'axe « leads » et « ventes ».
    grid: { left: 8, right: 8, top: mobile ? 100 : 76, bottom: 8, containLabel: true },
    legend: { ...base.legend, data: [...canaux.map((c) => c.libelle), "Ventes nettes"], itemGap: 10 },
    xAxis: { ...base.xAxis, type: "category", data: mois.map((m) => libelleMoisAxe(m)), axisLabel: { ...base.xAxis.axisLabel, interval: mobile ? 3 : 1 } },
    yAxis: [
      { ...base.yAxis, type: "value", name: "leads", axisLabel: { ...base.yAxis.axisLabel, formatter: (v: number) => formatNombre(v) } },
      { ...base.yAxis, type: "value", name: "ventes", splitLine: { show: false }, axisLabel: { ...base.yAxis.axisLabel, formatter: (v: number) => formatNombre(v) } },
    ],
    tooltip: { ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.grille } }, valueFormatter: (v: unknown) => (typeof v === "number" ? formatNombre(v) : "n. d.") },
    series: [
      ...canaux.map((c, i) => ({
        name: c.libelle, type: "bar" as const, stack: "leads", data: [...c.valeurs], barMaxWidth: 22,
        itemStyle: { color: t.serie[i % t.serie.length] ?? t.ambre, opacity: 0.9 },
      })),
      { name: "Ventes nettes", type: "line", yAxisIndex: 1, data: [...ventes], smooth: 0.3, symbol: "circle", symbolSize: 4, lineStyle: { color: t.texte, width: 1.5 }, itemStyle: { color: t.texte } },
    ],
  };
}

/** Leads créés depuis plus de 48 h sans RDV planifié : barres par agence sur la dernière cohorte, courbe des huit dernières cohortes pour le périmètre. */
export function optionSansRdv(agences: readonly { nom: string; valeur: number }[], serie: readonly { mois: string; valeur: number }[], t: TokensGraphique, mobile = false): EChartsOption {
  const base = optionBase(t);
  return {
    ...base,
    legend: { show: false },
    grid: [
      { left: 8, right: 8, top: 24, bottom: "54%", containLabel: true },
      { left: 8, right: 8, top: "62%", bottom: 8, containLabel: true },
    ],
    title: [
      { text: "Dernière cohorte, par agence", left: 4, top: 0, textStyle: { color: t.texte3, fontSize: 11, fontWeight: "normal", fontFamily: t.police } },
      { text: "Huit dernières cohortes", left: 4, top: "54%", textStyle: { color: t.texte3, fontSize: 11, fontWeight: "normal", fontFamily: t.police } },
    ],
    xAxis: [
      { ...base.xAxis, gridIndex: 0, type: "category", data: agences.map((a) => a.nom), axisLabel: { ...base.xAxis.axisLabel, interval: 0, fontSize: 10, rotate: mobile ? 45 : 30 } },
      { ...base.xAxis, gridIndex: 1, type: "category", data: serie.map((s) => libelleMoisAxe(s.mois)), axisLabel: { ...base.xAxis.axisLabel, fontSize: 10 } },
    ],
    yAxis: [
      { ...base.yAxis, gridIndex: 0, type: "value", axisLabel: { ...base.yAxis.axisLabel, formatter: (v: number) => formatNombre(v) } },
      { ...base.yAxis, gridIndex: 1, type: "value", axisLabel: { ...base.yAxis.axisLabel, formatter: (v: number) => formatNombre(v) } },
    ],
    tooltip: { ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.grille } }, valueFormatter: (v: unknown) => (typeof v === "number" ? formatNombre(v) : "n. d.") },
    series: [
      { name: "Leads sans RDV à 48 h", type: "bar", xAxisIndex: 0, yAxisIndex: 0, data: agences.map((a) => a.valeur), barMaxWidth: 22, itemStyle: { color: t.ambre, borderRadius: [3, 3, 0, 0] } },
      { name: "Leads sans RDV à 48 h", type: "line", xAxisIndex: 1, yAxisIndex: 1, data: serie.map((s) => s.valeur), smooth: 0.3, symbol: "circle", symbolSize: 4, lineStyle: { color: t.ambre, width: 1.5 }, itemStyle: { color: t.ambre }, areaStyle: { color: t.ambre, opacity: 0.1 } },
    ],
  };
}
