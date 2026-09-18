import { useEffect, useState } from "react";

/**
 * Thème ECharts maison (DESIGN.md §5), lu dans les tokens CSS au moment du rendu
 * pour suivre la bascule sombre et clair : fond transparent, grilles à 6 % de blanc,
 * axes sans ligne, étiquettes 12 px en texte secondaire, palette de six séries
 * dans un ordre fixe (ambre, menthe, bleu, violet, alerte, gris).
 */
export interface TokensGraphique {
  serie: string[];
  fond: string;
  surface: string;
  surface2: string;
  bordure: string;
  texte: string;
  texte2: string;
  texte3: string;
  ambre: string;
  menthe: string;
  bleu: string;
  violet: string;
  alerte: string;
  succes: string;
  attention: string;
  grille: string;
  sombre: boolean;
  police: string;
  mono: string;
}

function lireVariable(nom: string, defaut: string): string {
  if (typeof window === "undefined") return defaut;
  const valeur = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
  return valeur || defaut;
}

export function lireTokens(): TokensGraphique {
  const sombre = getComputedStyle(document.documentElement).colorScheme !== "light";
  const ambre = lireVariable("--ambre", "#f5b700");
  const menthe = lireVariable("--menthe", "#2dd4bf");
  const bleu = lireVariable("--bleu", "#60a5fa");
  const violet = lireVariable("--violet", "#a78bfa");
  const alerte = lireVariable("--alerte", "#fb7185");
  const gris = lireVariable("--gris-serie", "#94a3b8");
  return {
    serie: [ambre, menthe, bleu, violet, alerte, gris],
    fond: lireVariable("--fond", "#0b0f17"),
    surface: lireVariable("--surface", "#111827"),
    surface2: lireVariable("--surface-2", "#161f2e"),
    bordure: lireVariable("--bordure", "rgba(255,255,255,0.08)"),
    texte: lireVariable("--texte", "#e6eaf2"),
    texte2: lireVariable("--texte-2", "#9aa4b8"),
    texte3: lireVariable("--texte-3", "#808a9d"),
    ambre,
    menthe,
    bleu,
    violet,
    alerte,
    succes: lireVariable("--succes", "#34d399"),
    attention: lireVariable("--attention", "#fbbf24"),
    grille: sombre ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)",
    sombre,
    police: "'Instrument Sans', ui-sans-serif, system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  };
}

/** Tokens graphiques, rafraîchis quand le thème change (attribut data-theme ou préférence système). */
export function useTokensGraphique(): TokensGraphique {
  const [tokens, setTokens] = useState<TokensGraphique>(() => lireTokens());
  useEffect(() => {
    const relire = () => setTokens(lireTokens());
    const observateur = new MutationObserver(relire);
    observateur.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", relire);
    return () => {
      observateur.disconnect();
      media.removeEventListener("change", relire);
    };
  }, []);
  return tokens;
}

/** Options communes à tous les graphiques : à fusionner dans chaque option. */
export function optionBase(t: TokensGraphique) {
  return {
    color: t.serie,
    backgroundColor: "transparent",
    textStyle: { fontFamily: t.police, color: t.texte2, fontSize: 12 },
    animationDuration: 600,
    animationDurationUpdate: 300,
    animationEasing: "cubicOut" as const,
    grid: { left: 8, right: 12, top: 32, bottom: 8, containLabel: true },
    legend: {
      textStyle: { color: t.texte2, fontSize: 12 },
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 14,
      top: 0,
      left: 0,
    },
    tooltip: {
      backgroundColor: t.surface2,
      borderColor: t.bordure,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: t.texte, fontSize: 12, fontFamily: t.police },
      extraCssText: "border-radius: 10px; box-shadow: none;",
    },
    xAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: t.texte2, fontSize: 12, fontFamily: t.police },
      splitLine: { show: false },
    },
    yAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: t.texte2, fontSize: 12, fontFamily: t.mono },
      splitLine: { lineStyle: { color: t.grille } },
      nameTextStyle: { color: t.texte3, fontSize: 11, align: "left" as const, padding: [0, 0, 0, -8] },
    },
  };
}

/** Étiquettes de mois abrégées à la française pour les axes (« janv. », « févr. »). */
export const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."] as const;

export function libelleMoisAxe(mois: string): string {
  const [annee, m] = mois.split("-");
  const index = Number(m) - 1;
  const court = MOIS_COURTS[index] ?? mois;
  return index === 0 ? `${court} ${annee?.slice(2) ?? ""}` : court;
}
