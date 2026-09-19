import type { EChartsOption } from "echarts";
import { libelleMoisAxe, optionBase, type TokensGraphique } from "@/graphiques/theme";
import { formatMontant, formatMontantUnite, formatNombre, formatTaux } from "@/lib/format";
import type { EffetsEcart } from "@/lib/phrases";
import type { VentesAgregees } from "@/lib/ventes";

/** Constructeurs d'options ECharts de l'écran Ventes et marge (DESIGN.md §5 et §11). Aucun calcul métier ici : mise en forme de valeurs déjà calculées. */

export interface MarcheCascade {
  comparaisonLibelle: string;
  caComparaison: number;
  caRealise: number;
  effets: EffetsEcart;
}

/**
 * Cascade de l'écart : barres empilées (socle transparent + effet), qui tombent à 120 ms d'écart,
 * résiduel en dernier avant le réalisé.
 */
export interface Cascade {
  option: EChartsOption;
  /** Valeur basse de l'axe des montants quand il est tronqué pour rendre les effets lisibles ; null si l'axe part de zéro. */
  axeTronque: number | null;
}

/** Pas d'axe « rond » : 1, 2 ou 5 × 10^k, pour que la troncature tombe sur une graduation lisible. */
function pasRond(etendue: number): number {
  const brut = Math.pow(10, Math.floor(Math.log10(Math.max(1, etendue))));
  return etendue / brut >= 5 ? brut : etendue / brut >= 2 ? brut / 2 : brut / 5;
}

export function optionCascade(m: MarcheCascade, t: TokensGraphique, mobile = false): Cascade {
  const etapes: { nom: string; valeur: number; type: "borne" | "effet" }[] = [
    { nom: m.comparaisonLibelle, valeur: m.caComparaison, type: "borne" },
    { nom: "Volume", valeur: m.effets.volume, type: "effet" },
    { nom: "Mix", valeur: m.effets.mix, type: "effet" },
    { nom: "Prix", valeur: m.effets.prix, type: "effet" },
    { nom: "Remise", valeur: m.effets.remise, type: "effet" },
    { nom: "Résiduel", valeur: m.effets.residuel, type: "effet" },
    { nom: "Réalisé", valeur: m.caRealise, type: "borne" },
  ];
  let cumul = 0;
  const socle: number[] = [];
  const hauteur: number[] = [];
  const couleurs: string[] = [];
  etapes.forEach((e) => {
    if (e.type === "borne") {
      socle.push(0);
      hauteur.push(e.valeur);
      couleurs.push(e.nom === "Réalisé" ? t.accent : t.texte3);
      cumul = e.valeur;
    } else {
      const suivant = cumul + e.valeur;
      socle.push(Math.min(cumul, suivant));
      hauteur.push(Math.abs(e.valeur));
      couleurs.push(e.valeur >= 0 ? t.succes : t.alerte);
      cumul = suivant;
    }
  });
  // Les effets pèsent quelques pour cent des bornes : l'axe démarre sous le point le plus bas de la cascade, et le dit.
  const niveaux = socle.map((s, i) => s + (hauteur[i] ?? 0)).concat(socle.filter((_, i) => etapes[i]?.type === "effet"));
  const plusBas = Math.min(...niveaux.filter((n) => n > 0));
  const plusHaut = Math.max(...niveaux);
  const pas = pasRond(plusHaut - plusBas);
  const minimum = Math.floor((plusBas - 2 * pas) / pas) * pas;
  const axeTronque = minimum > 0 && plusHaut - plusBas < 0.5 * plusHaut ? minimum : null;
  const uniteAxe = plusHaut >= 2_000_000 ? "meur" : "keur";
  const base = optionBase(t);
  const option: EChartsOption = {
    ...base,
    grid: { left: 8, right: 12, top: 28, bottom: 8, containLabel: true },
    xAxis: { ...base.xAxis, type: "category", data: etapes.map((e) => e.nom), axisLabel: { ...base.xAxis.axisLabel, interval: 0, fontSize: mobile ? 10 : 11, ...(mobile ? { rotate: 35 } : {}) } },
    yAxis: {
      ...base.yAxis, type: "value",
      // Axe tronqué : graduations au pas rond et étiquettes à deux décimales, sinon deux graduations porteraient le même libellé.
      ...(axeTronque === null ? {} : { min: axeTronque, interval: 2 * pas }),
      // Une seule unité sur tout l'axe (k€ jusqu'à 2 M€), sinon les graduations changent d'écriture en cours de route.
      axisLabel: { ...base.yAxis.axisLabel, formatter: (v: number) => formatMontantUnite(v, uniteAxe, uniteAxe === "keur" ? 0 : 1) },
    },
    tooltip: { ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.grille } }, formatter: (params: unknown) => {
      const liste = params as { dataIndex: number }[];
      const i = liste[0]?.dataIndex ?? 0;
      const e = etapes[i];
      if (!e) return "";
      return e.type === "borne" ? `${e.nom} : <b>${formatMontant(e.valeur)}</b>` : `Effet ${e.nom.toLowerCase()} : <b>${e.valeur >= 0 ? "+" : "-"}${formatMontant(Math.abs(e.valeur))}</b>`;
    } },
    series: [
      { type: "bar", stack: "cascade", data: socle, itemStyle: { color: "transparent" }, emphasis: { disabled: true }, silent: true, barWidth: mobile ? 18 : 34, animation: false, tooltip: { show: false } },
      {
        type: "bar", stack: "cascade", barWidth: mobile ? 18 : 34, labelLayout: { hideOverlap: true },
        data: hauteur.map((h, i) => ({ value: h, itemStyle: { color: couleurs[i] ?? t.texte3, borderRadius: 3 } })),
        // Sur téléphone, les étiquettes se chevauchaient et devenaient fausses à la lecture : elles restent dans l'info-bulle.
        label: { show: !mobile, position: "top", color: t.texte2, fontFamily: t.mono, fontSize: 11, formatter: (p: unknown) => {
          const { dataIndex } = p as { dataIndex: number };
          const e = etapes[dataIndex];
          if (!e) return "";
          return e.type === "borne" || e.valeur === 0 ? formatMontant(e.valeur) : `${e.valeur > 0 ? "+" : "-"}${formatMontant(Math.abs(e.valeur))}`;
        } },
        animationDuration: 500, animationEasing: "cubicOut", animationDelay: (i: number) => i * 120,
      },
    ],
  };
  return { option, axeTronque };
}

/** Barres empilées mensuelles du CA par produit et courbe du taux de marge sur un second axe. */
export function optionProduitsMensuels(
  mois: readonly string[],
  series: readonly { produit: string; libelle: string; valeurs: readonly (number | null)[] }[],
  tauxMarge: readonly (number | null)[],
  t: TokensGraphique,
  mobile = false,
): EChartsOption {
  const base = optionBase(t);
  return {
    ...base,
    // La légende des huit produits tient sur deux lignes en desktop, trois sur mobile.
    grid: { left: 8, right: 8, top: mobile ? 84 : 56, bottom: 8, containLabel: true },
    legend: { ...base.legend, data: [...series.map((s) => s.libelle), "Taux de marge"], itemGap: 10 },
    xAxis: { ...base.xAxis, type: "category", data: mois.map((m) => libelleMoisAxe(m)) },
    yAxis: [
      // Tout l'axe en M€ à une décimale : « 0,5 M€ », « 1,0 M€ », jamais « 500,0 k€ » puis « 1,0 M€ ».
      { ...base.yAxis, type: "value", axisLabel: { ...base.yAxis.axisLabel, formatter: (v: number) => formatMontantUnite(v, "meur") } },
      { ...base.yAxis, type: "value", splitLine: { show: false }, min: 0, max: 50, axisLabel: { ...base.yAxis.axisLabel, formatter: (v: number) => `${formatNombre(v)} %` } },
    ],
    tooltip: { ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.grille } }, valueFormatter: (v: unknown) => (typeof v === "number" ? formatMontant(v) : "n. d.") },
    series: [
      ...series.map((s, i) => ({
        name: s.libelle, type: "bar" as const, stack: "ca", data: s.valeurs.map((v) => v ?? 0), barMaxWidth: 28,
        itemStyle: { color: t.serie[i % t.serie.length] ?? t.accent, opacity: 0.9 },
        animationDelay: (idx: number) => idx * 30,
      })),
      {
        name: "Taux de marge", type: "line", yAxisIndex: 1, data: [...tauxMarge], smooth: 0.3, symbol: "circle", symbolSize: 5,
        lineStyle: { color: t.texte, width: 1.5 }, itemStyle: { color: t.texte }, connectNulls: false,
        tooltip: { valueFormatter: (v: unknown) => (typeof v === "number" ? formatTaux(v) : "n. d.") },
      },
    ],
  };
}

/** Matrice agence × produit : un point par case, taille = CA, couleur = taux de marge. */
export function optionMatrice(
  agences: readonly { code: string; nom: string }[],
  produits: readonly { code: string; libelle: string }[],
  cellules: ReadonlyMap<string, VentesAgregees>,
  t: TokensGraphique,
  mobile = false,
): EChartsOption {
  const donnees: { value: [number, number, number, number]; name: string }[] = [];
  let caMax = 1;
  agences.forEach((a, y) => {
    produits.forEach((p, x) => {
      const v = cellules.get(`${a.code}|${p.code}`);
      if (!v || v.ca_signe <= 0) return;
      caMax = Math.max(caMax, v.ca_signe);
      donnees.push({ value: [x, y, v.ca_signe, v.taux_marge ?? 0], name: `${a.nom} · ${p.libelle}` });
    });
  });
  const marges = donnees.map((d) => d.value[3]).filter((m) => m > 0);
  const min = marges.length ? Math.floor(Math.min(...marges)) : 20;
  const max = marges.length ? Math.ceil(Math.max(...marges)) : 40;
  const base = optionBase(t);
  return {
    ...base,
    grid: { left: 8, right: 16, top: 8, bottom: 40, containLabel: true },
    xAxis: { ...base.xAxis, type: "category", data: produits.map((p) => p.libelle), position: "top", axisLabel: { ...base.xAxis.axisLabel, interval: 0, fontSize: mobile ? 10 : 11, rotate: mobile ? 55 : 28 }, splitLine: { show: true, lineStyle: { color: t.grille } } },
    yAxis: { ...base.yAxis, type: "category", data: agences.map((a) => a.nom), inverse: true, axisLabel: { ...base.yAxis.axisLabel, fontFamily: t.police }, splitLine: { show: true, lineStyle: { color: t.grille } } },
    visualMap: {
      type: "continuous", dimension: 3, min, max, orient: "horizontal", left: "center", bottom: 0, itemWidth: 10, itemHeight: 120,
      text: [`${formatNombre(max)} %`, `${formatNombre(min)} %`], textStyle: { color: t.texte3, fontSize: 11 },
      inRange: { color: [t.alerte, t.attention, t.succes] }, calculable: false,
    },
    tooltip: { ...base.tooltip, trigger: "item", formatter: (p: unknown) => {
      const { name, value } = p as { name: string; value: [number, number, number, number] };
      return `${name}<br/>CA signé : <b>${formatMontant(value[2])}</b> · marge : <b>${formatTaux(value[3])}</b>`;
    } },
    series: [{
      type: "scatter", data: donnees,
      symbolSize: (v: number[]) => (mobile ? 4 : 6) + (mobile ? 14 : 26) * Math.sqrt((v[2] ?? 0) / caMax),
      itemStyle: { opacity: 0.85 },
      animationDelay: (i: number) => i * 12,
    }],
  };
}

/** Annulations à 60 jours : départements couverts à distance contre départements avec agence, par agence. */
export function optionAnnulations(lignes: readonly { nom: string; aDistance: number | null; surPlace: number | null }[], t: TokensGraphique): EChartsOption {
  const base = optionBase(t);
  return {
    ...base,
    grid: { left: 8, right: 12, top: 32, bottom: 8, containLabel: true },
    legend: { ...base.legend, data: ["À distance", "Sur place"] },
    xAxis: { ...base.xAxis, type: "value", axisLabel: { ...base.xAxis.axisLabel, formatter: (v: number) => `${formatNombre(v)} %` }, splitLine: { lineStyle: { color: t.grille } } },
    yAxis: { ...base.yAxis, type: "category", data: lignes.map((l) => l.nom), inverse: true, axisLabel: { ...base.yAxis.axisLabel, fontFamily: t.police }, splitLine: { show: false } },
    tooltip: { ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.grille } }, valueFormatter: (v: unknown) => (typeof v === "number" ? formatTaux(v) : "n. d.") },
    series: [
      { name: "À distance", type: "bar", data: lignes.map((l) => l.aDistance), barGap: "10%", barMaxWidth: 10, itemStyle: { color: t.accent, borderRadius: [0, 3, 3, 0] } },
      { name: "Sur place", type: "bar", data: lignes.map((l) => l.surPlace), barMaxWidth: 10, itemStyle: { color: t.texte3, borderRadius: [0, 3, 3, 0] } },
    ],
  };
}

/** Boîtes à moustaches des taux de remise par agence : moustaches aux 10e et 90e centiles. */
export function optionRemises(
  lignes: readonly { nom: string; boite: [number, number, number, number, number]; devis: number; active: boolean }[],
  t: TokensGraphique,
  mobile = false,
): EChartsOption {
  const base = optionBase(t);
  return {
    ...base,
    grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true },
    xAxis: { ...base.xAxis, type: "category", data: lignes.map((l) => l.nom), axisLabel: { ...base.xAxis.axisLabel, interval: 0, fontSize: mobile ? 10 : 11, ...(mobile ? { rotate: 40 } : {}) } },
    yAxis: { ...base.yAxis, type: "value", name: "taux de remise", axisLabel: { ...base.yAxis.axisLabel, formatter: (v: number) => `${formatNombre(v)} %` } },
    tooltip: { ...base.tooltip, trigger: "item", formatter: (p: unknown) => {
      const { name, dataIndex } = p as { name: string; dataIndex: number };
      const l = lignes[dataIndex];
      if (!l) return name;
      const [p10, q1, med, q3, p90] = l.boite;
      return `${name} · ${formatNombre(l.devis)} devis<br/>médiane <b>${formatTaux(med)}</b> · quartiles ${formatTaux(q1)} à ${formatTaux(q3)}<br/>centiles 10 et 90 : ${formatTaux(p10)} à ${formatTaux(p90)}`;
    } },
    series: [{
      type: "boxplot", data: lignes.map((l) => ({ value: l.boite, itemStyle: { color: l.active ? t.accent : t.surface2, borderColor: l.active ? t.accent : t.texte2, borderWidth: 1.5 } })),
      boxWidth: mobile ? [6, 14] : [10, 28],
      animationDelay: (i: number) => i * 40,
    }],
  };
}
