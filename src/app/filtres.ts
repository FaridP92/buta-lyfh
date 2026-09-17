import { useSearchParams } from "react-router";
import { useFraicheur } from "@/donnees/fraicheur";
import { analyserPeriode, moisDe, type Periode } from "@/lib/periode";

export type Comparaison = "objectif" | "n1";

export const AGENCES = [
  { code: "SAI", nom: "Saintonge" },
  { code: "ANG", nom: "Angoumois" },
  { code: "MAR", nom: "Marensin" },
  { code: "BOR", nom: "Born" },
  { code: "MSN", nom: "Marsan" },
  { code: "BDX", nom: "Bordeaux Métropole" },
  { code: "HGI", nom: "Haute Gironde" },
  { code: "ARC", nom: "Bassin d'Arcachon" },
  { code: "NOR", nom: "Nord" },
] as const;

export type CodeAgence = (typeof AGENCES)[number]["code"];

export function nomAgence(code: string): string {
  return AGENCES.find((a) => a.code === code)?.nom ?? code;
}

function moisHier(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface Filtres {
  periode: Periode;
  comparaison: Comparaison;
  /** Code agence ou « toutes ». */
  agence: string;
  /** Valeur de la colonne `agence` des vues : code ou RESEAU. */
  agenceVue: string;
  /** « le réseau » ou le nom du bassin, pour les titres. */
  perimetreLibelle: string;
  moisPublie: string;
  journeePubliee: string | null;
  definir: (cle: "periode" | "comparaison" | "agence", valeur: string) => void;
}

/**
 * Filtres globaux persistés dans l'URL (ECRANS.md conventions), pour qu'un lien partagé
 * montre la même vue : ?periode=2026-09&comparaison=objectif&agence=SAI
 * La période est bornée par la journée publiée (badge de fraîcheur).
 */
export function useFiltres(): Filtres {
  const [params, setParams] = useSearchParams();
  const { data: fraicheur } = useFraicheur();
  const moisPublie = fraicheur?.journee ? moisDe(fraicheur.journee) : moisHier();

  const periode = analyserPeriode(params.get("periode"), moisPublie);
  const comparaison: Comparaison = params.get("comparaison") === "n1" ? "n1" : "objectif";
  const agenceParam = params.get("agence") ?? "toutes";
  const agence = AGENCES.some((a) => a.code === agenceParam) ? agenceParam : "toutes";

  function definir(cle: "periode" | "comparaison" | "agence", valeur: string) {
    const suivant = new URLSearchParams(params);
    if (valeur === "toutes" || valeur === "" || (cle === "comparaison" && valeur === "objectif")) suivant.delete(cle);
    else suivant.set(cle, valeur);
    setParams(suivant, { replace: true });
  }

  return {
    periode,
    comparaison,
    agence,
    agenceVue: agence === "toutes" ? "RESEAU" : agence,
    perimetreLibelle: agence === "toutes" ? "le réseau" : nomAgence(agence),
    moisPublie,
    journeePubliee: fraicheur?.journee ?? null,
    definir,
  };
}
