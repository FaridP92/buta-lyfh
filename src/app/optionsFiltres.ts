import { AGENCES, useFiltres } from "@/app/filtres";
import { optionsPeriode } from "@/lib/periode";

export const OPTIONS_COMPARAISON = [
  { valeur: "objectif", libelle: "Objectif" },
  { valeur: "n1", libelle: "N-1" },
] as const;

const GROUPES: Record<string, string> = { mois: "Mois", trimestre: "Trimestres", annee: "Années" };

/** Options des trois sélecteurs globaux (période, comparaison, agence), partagées par la barre haute et le tiroir mobile. */
export function useOptionsFiltres() {
  const filtres = useFiltres();
  const optionsPeriodes = optionsPeriode(filtres.moisPublie).map((o) => ({ valeur: o.valeur, libelle: o.libelle, groupe: GROUPES[o.groupe] ?? o.groupe }));
  const optionsAgence = [{ valeur: "toutes", libelle: "Toutes les agences" }, ...AGENCES.map((a) => ({ valeur: a.code, libelle: a.nom }))];
  return { filtres, optionsPeriodes, optionsComparaison: OPTIONS_COMPARAISON, optionsAgence };
}
