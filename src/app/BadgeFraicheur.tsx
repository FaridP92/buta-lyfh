import { useEffect, useRef, useState } from "react";
import { useFraicheur } from "@/donnees/fraicheur";
import { formatDateCourte, formatDateHeure } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Badge de fraîcheur (ECRANS.md conventions) : « journée du JJ/MM intégrée à HH:MM » depuis
 * mart_fraicheur (journée publiée plafonnée à la veille) ; « instantané du JJ/MM » si seul le secours
 * statique répond ; état neutre sinon. Le point ambre pulse pendant les dix secondes qui suivent un
 * changement de valeur (DESIGN.md §10).
 */
export function BadgeFraicheur() {
  const { data, isError } = useFraicheur();
  const [pulse, setPulse] = useState(false);
  const precedente = useRef<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const valeur = `${data.journee ?? ""}|${data.integreeLe}`;
    if (precedente.current !== null && precedente.current !== valeur) {
      setPulse(true);
      const timer = window.setTimeout(() => setPulse(false), 10_000);
      precedente.current = valeur;
      return () => window.clearTimeout(timer);
    }
    precedente.current = valeur;
    return undefined;
  }, [data]);

  let texte = "Pas encore de donnée chargée";
  let couleur = "bg-texte-3";
  if (data?.journee) {
    if (data.source === "supabase") {
      texte = `Journée du ${formatDateCourte(data.journee)} intégrée à ${formatDateHeure(data.integreeLe).slice(6)}`;
      couleur = "bg-accent";
    } else {
      texte = `Instantané du ${formatDateCourte(data.journee)}`;
      couleur = "bg-texte-3";
    }
  } else if (isError) {
    texte = "Données indisponibles";
  }

  return (
    <span
      className="hidden items-center gap-[6px] whitespace-nowrap rounded-full border border-bordure px-[var(--esp-3)] py-[6px] text-[12px] text-texte-3 lg:inline-flex"
      title={data?.source === "instantane" ? "Supabase ne répond pas : secours statique" : undefined}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", couleur, pulse && "animate-pulse")} aria-hidden="true" />
      {texte}
    </span>
  );
}
