import { formatMontant, formatNombre, formatTaux, formatVariationPoints } from "@/lib/format";

/**
 * « Ce que dit le mois » par règles (ECRANS.md §1, repli de la fonction expliquer-ecart) :
 * trois phrases assemblées à partir de faits déjà calculés en SQL. Aucun calcul ici sinon
 * choisir les effets dominants et formater. Tout nombre affiché vient des entrées.
 */
export interface FaitsMois {
  perimetre: string;
  periodeLibelle: string;
  comparaisonLibelle: "l'objectif" | "N-1";
  caSigne: number;
  caComparaison: number | null;
  ventes: number;
  ventesComparaison: number | null;
  tauxMarge: number | null;
  tauxMargeComparaison: number | null;
  /** Libellé de la comparaison de marge quand elle diffère (la marge n'a pas d'objectif : toujours N-1). */
  margeComparaisonLibelle?: string;
  ecart: EffetsEcart | null;
  alertes: readonly string[];
  motifSansComparaison?: string;
  /** Présent quand le mois en cours est partiel : la comparaison est proratisée. */
  prorata?: { joursPublies: number; joursMois: number };
}

export interface EffetsEcart {
  total: number;
  volume: number;
  mix: number;
  prix: number;
  remise: number;
  residuel: number;
}

type CleEffet = keyof Omit<EffetsEcart, "total" | "residuel">;
const LIBELLES_EFFETS: Record<CleEffet, { a: string; sujet: string; pluriel: boolean }> = {
  volume: { a: "au volume", sujet: "le volume", pluriel: false },
  mix: { a: "au mix produit", sujet: "le mix produit", pluriel: false },
  prix: { a: "aux prix", sujet: "les prix", pluriel: true },
  remise: { a: "aux remises", sujet: "les remises", pluriel: true },
};

function signe(valeur: number): string {
  return valeur > 0 ? "+" : valeur < 0 ? "-" : "";
}

function montantSigne(valeur: number): string {
  return `${signe(valeur)}${formatMontant(Math.abs(valeur))}`;
}

/** Somme des effets de plusieurs lignes mensuelles de mart_ecarts (tous en euros, additifs). */
export function sommerEffets(lignes: readonly EffetsEcart[]): EffetsEcart | null {
  if (lignes.length === 0) return null;
  return lignes.reduce(
    (s, l) => ({ total: s.total + l.total, volume: s.volume + l.volume, mix: s.mix + l.mix, prix: s.prix + l.prix, remise: s.remise + l.remise, residuel: s.residuel + l.residuel }),
    { total: 0, volume: 0, mix: 0, prix: 0, remise: 0, residuel: 0 },
  );
}

export function phrasesDuMois(f: FaitsMois): [string, string, string] {
  const perimetre = f.perimetre.charAt(0).toUpperCase() + f.perimetre.slice(1);

  let p1: string;
  if (f.caComparaison === null || f.caComparaison === 0) {
    p1 = `${perimetre} a signé ${formatMontant(f.caSigne)} HT sur ${f.periodeLibelle} (${formatNombre(f.ventes)} ventes) ; comparaison indisponible : ${f.motifSansComparaison ?? "pas de référence pour cette période"}.`;
  } else {
    const ecartPct = ((f.caSigne - f.caComparaison) / Math.abs(f.caComparaison)) * 100;
    const sens = ecartPct >= 0 ? "au-dessus de" : "en retrait de";
    const ventesTexte = f.ventesComparaison === null ? `${formatNombre(f.ventes)} ventes` : `${formatNombre(f.ventes)} ventes contre ${formatNombre(Math.round(f.ventesComparaison))}`;
    const prorata = f.prorata ? ` au prorata des ${formatNombre(f.prorata.joursPublies)} jours publiés sur ${formatNombre(f.prorata.joursMois)}` : "";
    p1 = `${perimetre} a signé ${formatMontant(f.caSigne)} HT sur ${f.periodeLibelle}, ${formatTaux(Math.abs(ecartPct))} ${sens} ${f.comparaisonLibelle}${prorata} (${formatMontant(f.caComparaison)}), avec ${ventesTexte}.`;
  }

  let p2: string;
  if (!f.ecart) {
    p2 = "La décomposition de l'écart n'est pas disponible pour cette période.";
  } else {
    const effets = (Object.keys(LIBELLES_EFFETS) as CleEffet[])
      .map((cle) => ({ cle, valeur: f.ecart?.[cle] ?? 0 }))
      .sort((a, b) => Math.abs(b.valeur) - Math.abs(a.valeur));
    const [premier, second] = effets;
    if (!premier || Math.abs(f.ecart.total) < 1) {
      p2 = "L'écart de chiffre d'affaires est nul : volume, mix, prix et remises se compensent.";
    } else {
      const part = Math.round((Math.abs(premier.valeur) / Math.abs(f.ecart.total)) * 100);
      const explique = Math.abs(premier.valeur) <= Math.abs(f.ecart.total) ? `, soit ${formatNombre(part)} % de l'écart` : ", plus que l'écart lui-même, compensé par les autres effets";
      const verbe = (cle: CleEffet, valeur: number) => (LIBELLES_EFFETS[cle].pluriel ? (valeur >= 0 ? "ajoutent" : "retirent") : valeur >= 0 ? "ajoute" : "retire");
      const secondTexte = second && Math.abs(second.valeur) >= 1000 ? ` ; ${LIBELLES_EFFETS[second.cle].sujet} ${verbe(second.cle, second.valeur)} ${formatMontant(Math.abs(second.valeur))}` : "";
      p2 = `L'écart de ${montantSigne(f.ecart.total)} tient d'abord ${LIBELLES_EFFETS[premier.cle].a} (${montantSigne(premier.valeur)}${explique})${secondTexte}.`;
    }
  }

  let p3: string;
  const margeTexte =
    f.tauxMarge === null
      ? "Taux de marge non calculable"
      : f.tauxMargeComparaison === null
        ? `Le taux de marge brute est à ${formatTaux(f.tauxMarge)}`
        : `Le taux de marge brute est à ${formatTaux(f.tauxMarge)}, ${formatVariationPoints(Math.round((f.tauxMarge - f.tauxMargeComparaison) * 10) / 10)} vs ${f.margeComparaisonLibelle ?? f.comparaisonLibelle}`;
  if (f.alertes.length === 0) {
    p3 = `${margeTexte} ; aucune alerte du matin.`;
  } else if (f.alertes.length === 1) {
    p3 = `${margeTexte} ; une alerte du matin : ${f.alertes[0]}.`;
  } else {
    p3 = `${margeTexte} ; ${formatNombre(f.alertes.length)} alertes du matin, dont : ${f.alertes.slice(0, 2).join(" ; ")}.`;
  }

  return [p1, p2, p3];
}
