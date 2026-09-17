import { useSearchParams } from "react-router";

export type Periode = "mois" | "trimestre" | "annee";
export type Comparaison = "objectif" | "n1";

export const AGENCES = [
  { code: "SAI", nom: "Saintonge" },
  { code: "ANG", nom: "Angoumois" },
  { code: "MAR", nom: "Marensin" },
  { code: "BOR", nom: "Born" },
  { code: "MSN", nom: "Marsan" },
  { code: "BDX", nom: "Bordeaux Metropole" },
  { code: "HGI", nom: "Haute Gironde" },
  { code: "ARC", nom: "Bassin d'Arcachon" },
  { code: "NOR", nom: "Nord" },
] as const;

function moisCourant(): string {
  const maintenant = new Date();
  return `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Filtres globaux persistes dans l'URL (ECRANS.md conventions), pour qu'un
 * lien partage montre la meme vue : ?periode=2026-09&comparaison=objectif&agence=MER
 */
export function useFiltresURL() {
  const [params, setParams] = useSearchParams();

  const periode = params.get("periode") ?? moisCourant();
  const comparaison = (params.get("comparaison") as Comparaison) ?? "objectif";
  const agence = params.get("agence") ?? "toutes";

  function definir(cle: "periode" | "comparaison" | "agence", valeur: string) {
    const suivant = new URLSearchParams(params);
    if (valeur === "toutes" || valeur === "") {
      suivant.delete(cle);
    } else {
      suivant.set(cle, valeur);
    }
    setParams(suivant, { replace: true });
  }

  return { periode, comparaison, agence, definir };
}
