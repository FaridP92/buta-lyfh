/**
 * Badge de fraicheur (ECRANS.md conventions) : "journee du JJ/MM integree a
 * HH:MM". Lot 0 : aucune donnee chargee, l'etat neutre le dit honnetement ;
 * a partir du lot 1, ce composant lira mart_kpi_mensuel via useVue.
 */
export function BadgeFraicheur() {
  return (
    <span className="hidden items-center gap-[6px] rounded-full border border-bordure px-[var(--esp-3)] py-[6px] text-[12px] text-texte-3 lg:inline-flex">
      <span className="h-1.5 w-1.5 rounded-full bg-texte-3" aria-hidden="true" />
      Pas encore de donnee chargee
    </span>
  );
}
