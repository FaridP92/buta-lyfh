import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { appliquerTheme, memoriserTheme, themeActifResolu, type Theme } from "@/app/theme";

/** Bascule sombre/clair dans la barre haute (DESIGN.md §1), memorisee. */
export function BasculeTheme() {
  const [theme, setTheme] = useState<Theme>("sombre");

  useEffect(() => {
    const actif = themeActifResolu();
    setTheme(actif);
    appliquerTheme(actif);
  }, []);

  function basculer() {
    const suivant: Theme = theme === "sombre" ? "clair" : "sombre";
    setTheme(suivant);
    memoriserTheme(suivant);
  }

  return (
    <button
      type="button"
      onClick={basculer}
      aria-label={theme === "sombre" ? "Passer au theme clair" : "Passer au theme sombre"}
      className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-bordure text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte"
    >
      {theme === "sombre" ? (
        <Sun size={16} strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Moon size={16} strokeWidth={1.5} aria-hidden="true" />
      )}
    </button>
  );
}
