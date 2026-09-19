import type { EChartsOption } from "echarts";
import { optionBase, type TokensGraphique } from "@/graphiques/theme";
import { formatNombre, formatTaux } from "@/lib/format";

/** Cadre de la France métropolitaine : le fichier des départements contient aussi l'outre-mer, hors cadre. */
const CADRE_METROPOLE: [[number, number], [number, number]] = [[-5.4, 51.3], [9.8, 41.2]];

export interface DepartementCarte {
  code: string;
  nom: string;
  perimetre: boolean;
  indice: number | null;
  proprietaires: number | null;
  fioul: number | null;
  gaz_citerne: number | null;
  maisons_fg: number | null;
  solaire_nb: number | null;
  rge_pac: number | null;
  rge_pv: number | null;
  agences: string | null;
}

/** Carte de France par département colorée par l'indice, périmètre détouré en ambre (DESIGN.md §6). */
export function optionFrance(departements: readonly DepartementCarte[], t: TokensGraphique, selection: string | null, mobile = false): EChartsOption {
  const base = optionBase(t);
  const indices = departements.map((d) => d.indice).filter((v): v is number => v !== null);
  const max = indices.length ? Math.ceil(Math.max(...indices)) : 100;
  return {
    ...base,
    tooltip: { ...base.tooltip, trigger: "item", formatter: (p: unknown) => {
      const { name } = p as { name: string };
      const d = departements.find((x) => x.code === name);
      if (!d) return name;
      return [
        `<b>${d.nom} (${d.code})</b>${d.perimetre ? ` · périmètre simulé${d.agences ? ` (${d.agences})` : ""}` : ""}`,
        `indice : <b>${d.indice === null ? "n. d." : formatNombre(Math.round(d.indice))}</b>`,
        `propriétaires occupants : ${formatNombre(d.proprietaires)}`,
        `résidences au fioul : ${formatNombre(d.fioul)} · au gaz citerne : ${formatNombre(d.gaz_citerne)}`,
        `maisons F ou G : ${formatNombre(d.maisons_fg)} · installations solaires : ${formatNombre(d.solaire_nb)}`,
        `installateurs RGE PAC : ${formatNombre(d.rge_pac)} · PV : ${formatNombre(d.rge_pv)}`,
      ].join("<br/>");
    } },
    visualMap: {
      type: "continuous", min: 0, max, dimension: 0, orient: mobile ? "horizontal" : "vertical", left: mobile ? "center" : 8, bottom: mobile ? 0 : 12,
      itemWidth: 10, itemHeight: mobile ? 120 : 140, text: [`${max}`, "0"], textStyle: { color: t.texte3, fontSize: 11 },
      inRange: { color: [t.surface2, t.accent] }, calculable: false,
    },
    series: [{
      type: "map", map: "departements", nameProperty: "code", roam: false, boundingCoords: CADRE_METROPOLE, selectedMode: false, showLegendSymbol: false,
      left: mobile ? 8 : 60, right: 8, top: 8, bottom: mobile ? 36 : 8,
      itemStyle: { areaColor: t.surface2, borderColor: t.bordure, borderWidth: 0.6 },
      emphasis: { label: { show: false }, itemStyle: { areaColor: t.attention, borderColor: t.texte, borderWidth: 1 } },
      label: { show: false },
      data: departements.map((d) => ({
        name: d.code, value: d.indice ?? 0,
        ...(d.perimetre || d.code === selection ? { itemStyle: { borderColor: d.code === selection ? t.texte : t.accent, borderWidth: d.code === selection ? 2 : 1.5 } } : {}),
      })),
      animationDurationUpdate: 300,
    }],
  };
}

/** Carte de chaleur du parc gaz citerne ou bouteille (résidences principales), même cadre. */
export function optionGazCiterne(departements: readonly { code: string; nom: string; gaz_citerne: number | null; rp: number | null }[], t: TokensGraphique, mobile = false): EChartsOption {
  const base = optionBase(t);
  const valeurs = departements.map((d) => d.gaz_citerne ?? 0);
  const max = Math.max(1, ...valeurs);
  return {
    ...base,
    tooltip: { ...base.tooltip, trigger: "item", formatter: (p: unknown) => {
      const { name } = p as { name: string };
      const d = departements.find((x) => x.code === name);
      if (!d) return name;
      const part = d.rp && d.gaz_citerne !== null ? (100 * d.gaz_citerne) / d.rp : null;
      return `<b>${d.nom} (${d.code})</b><br/>résidences au gaz citerne ou bouteille : <b>${formatNombre(d.gaz_citerne)}</b>${part === null ? "" : ` · ${formatTaux(part)} des résidences principales`}`;
    } },
    visualMap: {
      type: "continuous", min: 0, max, orient: "horizontal", left: "center", bottom: 0, itemWidth: 10, itemHeight: 120,
      text: [formatNombre(max), "0"], textStyle: { color: t.texte3, fontSize: 11 }, inRange: { color: [t.surface2, t.menthe] }, calculable: false,
    },
    series: [{
      type: "map", map: "departements", nameProperty: "code", roam: false, boundingCoords: CADRE_METROPOLE, selectedMode: false, showLegendSymbol: false,
      left: 8, right: 8, top: 8, bottom: mobile ? 36 : 28,
      itemStyle: { areaColor: t.surface2, borderColor: t.bordure, borderWidth: 0.6 },
      emphasis: { label: { show: false }, itemStyle: { borderColor: t.texte, borderWidth: 1 } },
      label: { show: false },
      data: departements.map((d) => ({ name: d.code, value: d.gaz_citerne ?? 0 })),
    }],
  };
}

export interface CommuneCarte {
  code: string;
  nom: string;
  indice: number | null;
  proprietaires: number | null;
  fioul: number | null;
  gaz_citerne: number | null;
  maisons_fg: number | null;
  rge_pac: number | null;
  rge_pv: number | null;
  latitude: number | null;
  longitude: number | null;
}

/** Carte des communes d'un département : potentiel en couleur, agence simulée du bassin, installateurs RGE en points fins (sans nom). */
export function optionCommunes(
  carte: string,
  communes: readonly CommuneCarte[],
  agences: readonly { nom: string; latitude: number; longitude: number }[],
  afficherRge: boolean,
  t: TokensGraphique,
  mobile = false,
): EChartsOption {
  const base = optionBase(t);
  const indices = communes.map((c) => c.indice).filter((v): v is number => v !== null);
  const max = indices.length ? Math.ceil(Math.max(...indices)) : 100;
  const rge = afficherRge ? communes.filter((c) => c.latitude !== null && c.longitude !== null && ((c.rge_pac ?? 0) + (c.rge_pv ?? 0)) > 0) : [];
  return {
    ...base,
    tooltip: { ...base.tooltip, trigger: "item", formatter: (p: unknown) => {
      const { name, seriesType, value } = p as { name: string; seriesType: string; value: unknown };
      if (seriesType === "scatter") {
        const v = value as number[];
        return v.length > 2 ? `${name} : <b>${formatNombre(v[2] ?? 0)}</b> installateur(s) RGE PAC ou PV` : `${name} · agence simulée`;
      }
      const c = communes.find((x) => x.code === name);
      if (!c) return name;
      return [
        `<b>${c.nom}</b> (${c.code})`,
        `indice : <b>${c.indice === null ? "n. d." : formatNombre(Math.round(c.indice))}</b>`,
        `propriétaires occupants : ${formatNombre(c.proprietaires)} · fioul : ${formatNombre(c.fioul)} · gaz citerne : ${formatNombre(c.gaz_citerne)}`,
        `maisons F ou G : ${formatNombre(c.maisons_fg)} · RGE PAC : ${formatNombre(c.rge_pac)} · RGE PV : ${formatNombre(c.rge_pv)}`,
      ].join("<br/>");
    } },
    visualMap: {
      type: "continuous", min: 0, max, seriesIndex: 0, orient: mobile ? "horizontal" : "vertical", left: mobile ? "center" : 8, bottom: mobile ? 0 : 12,
      itemWidth: 10, itemHeight: mobile ? 120 : 140, text: [`${max}`, "0"], textStyle: { color: t.texte3, fontSize: 11 },
      inRange: { color: [t.surface2, t.accent] }, calculable: false,
    },
    geo: {
      map: carte, nameProperty: "code", roam: true, scaleLimit: { min: 1, max: 6 }, left: mobile ? 8 : 60, right: 8, top: 8, bottom: mobile ? 36 : 8,
      itemStyle: { areaColor: t.surface2, borderColor: t.bordure, borderWidth: 0.4 },
      emphasis: { label: { show: false }, itemStyle: { borderColor: t.texte, borderWidth: 0.8 } },
      label: { show: false },
    },
    series: [
      { type: "map", geoIndex: 0, map: carte, nameProperty: "code", showLegendSymbol: false, data: communes.map((c) => ({ name: c.code, value: c.indice ?? 0 })) },
      {
        type: "scatter", coordinateSystem: "geo", z: 5, symbolSize: 3, itemStyle: { color: t.texte2, opacity: 0.8 },
        data: rge.map((c) => ({ name: c.nom, value: [c.longitude as number, c.latitude as number, (c.rge_pac ?? 0) + (c.rge_pv ?? 0)] })),
      },
      {
        type: "effectScatter", coordinateSystem: "geo", z: 6, symbolSize: 12, rippleEffect: { scale: 2.2, brushType: "stroke" },
        itemStyle: { color: t.accent }, label: { show: true, position: "right", color: t.texte, fontFamily: t.police, fontSize: 11, formatter: "{b} · agence simulée" },
        data: agences.map((a) => ({ name: a.nom, value: [a.longitude, a.latitude] })),
      },
    ],
  };
}
