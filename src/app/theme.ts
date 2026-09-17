export type Theme = "sombre" | "clair";

const CLE_STOCKAGE = "buta-theme";

export function themeMemorise(): Theme | null {
  try {
    const valeur = localStorage.getItem(CLE_STOCKAGE);
    return valeur === "sombre" || valeur === "clair" ? valeur : null;
  } catch {
    return null;
  }
}

export function appliquerTheme(theme: Theme | null): void {
  const racine = document.documentElement;
  if (theme) {
    racine.setAttribute("data-theme", theme);
  } else {
    racine.removeAttribute("data-theme");
  }
}

export function memoriserTheme(theme: Theme): void {
  try {
    localStorage.setItem(CLE_STOCKAGE, theme);
  } catch {
    // stockage indisponible (navigation privee) : le choix ne survit pas a la session
  }
  appliquerTheme(theme);
}

export function themeActifResolu(): Theme {
  const memorise = themeMemorise();
  if (memorise) return memorise;
  const preferesClair = window.matchMedia("(prefers-color-scheme: light)").matches;
  return preferesClair ? "clair" : "sombre";
}
