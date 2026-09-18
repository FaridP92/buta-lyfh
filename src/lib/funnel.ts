import { moisDe, type CohorteAgregee } from "@/lib/periode";

/**
 * Funnel et leads (ECRANS.md §3) : flux du Sankey à partir d'une cohorte agrégée, coûts d'acquisition
 * agrégés par canal sur une période avec la pastille « à revoir », matrice canal × agence.
 * Aucun chiffre n'est calculé dans un composant : tout passe par ici, avec tests.
 */

export interface NoeudSankey {
  nom: string;
  /** Étape du parcours ou perte (branche sortante). */
  type: "etape" | "perte" | "attente";
}

export interface LienSankey {
  source: string;
  cible: string;
  valeur: number;
}

/**
 * Lead → RDV tenu → Devis → Signature → Pose → Encaissement, avec les pertes en branches sortantes :
 * sans suite (pas de RDV tenu), sans devis, refus, annulation ; et les dossiers en attente (signés non
 * posés, posés non encaissés), qui existent surtout sur les cohortes récentes.
 */
export function fluxSankey(c: CohorteAgregee): { noeuds: NoeudSankey[]; liens: LienSankey[] } {
  const etapes: NoeudSankey[] = [
    { nom: "Leads", type: "etape" }, { nom: "RDV tenus", type: "etape" }, { nom: "Devis", type: "etape" },
    { nom: "Signatures", type: "etape" }, { nom: "Poses", type: "etape" }, { nom: "Encaissements", type: "etape" },
  ];
  const liens: LienSankey[] = [];
  const noeuds = [...etapes];
  const ajouter = (source: string, cible: string, valeur: number, type: NoeudSankey["type"]) => {
    if (valeur <= 0) return;
    if (!noeuds.some((n) => n.nom === cible)) noeuds.push({ nom: cible, type });
    liens.push({ source, cible, valeur });
  };
  ajouter("Leads", "RDV tenus", c.rdv, "etape");
  ajouter("Leads", "Sans suite", c.leads - c.rdv, "perte");
  ajouter("RDV tenus", "Devis", c.devis, "etape");
  ajouter("RDV tenus", "Sans devis", c.rdv - c.devis, "perte");
  ajouter("Devis", "Signatures", c.signatures, "etape");
  ajouter("Devis", "Refus", c.devis - c.signatures, "perte");
  ajouter("Signatures", "Annulations", c.signatures - c.signaturesNettes, "perte");
  ajouter("Signatures", "Poses", c.poses, "etape");
  ajouter("Signatures", "À poser", c.signaturesNettes - c.poses, "attente");
  ajouter("Poses", "Encaissements", c.encaissements, "etape");
  ajouter("Poses", "À encaisser", c.poses - c.encaissements, "attente");
  return { noeuds: noeuds.filter((n) => n.type !== "etape" || liens.some((l) => l.source === n.nom || l.cible === n.nom) || n.nom === "Leads"), liens };
}

export interface LigneCoutCanal {
  mois: string;
  agence: string;
  canal: string;
  leads: number;
  rdv_tenus: number;
  ventes: number;
  ca_signe: number;
  cout: number;
  delai_lead_rdv_median: number | null;
}

export interface CanalAgrege {
  canal: string;
  leads: number;
  rdv_tenus: number;
  ventes: number;
  ca_signe: number;
  cout: number;
  taux_rdv: number | null;
  taux_conversion: number | null;
  cout_par_lead: number | null;
  cout_par_vente: number | null;
  /** Médiane mensuelle pondérée par les leads (approximation sur plusieurs mois). */
  delai_lead_rdv_median: number | null;
  /** Vrai quand le coût par vente dépasse 1,3 fois la médiane des canaux payants de la période. */
  a_revoir: boolean | null;
}

function ratio(numerateur: number, denominateur: number, facteur = 1, decimales = 1): number | null {
  if (!denominateur) return null;
  const f = Math.pow(10, decimales);
  return Math.round((facteur * numerateur / denominateur) * f) / f;
}

function mediane(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 1 ? (triees[milieu] as number) : ((triees[milieu - 1] as number) + (triees[milieu] as number)) / 2;
}

/** Coûts d'acquisition par canal sur la période (hors TOUS), ratios depuis les sommes, pastille « à revoir » sur la médiane des canaux à coût. */
export function agregerCoutsParCanal(lignes: readonly LigneCoutCanal[], debut: string, fin: string): CanalAgrege[] {
  const retenues = lignes.filter((l) => l.canal !== "TOUS" && moisDe(l.mois) >= debut && moisDe(l.mois) <= fin);
  const parCanal = new Map<string, LigneCoutCanal[]>();
  for (const l of retenues) {
    const liste = parCanal.get(l.canal) ?? [];
    liste.push(l);
    parCanal.set(l.canal, liste);
  }
  const canaux: CanalAgrege[] = [];
  for (const [canal, liste] of parCanal) {
    const somme = (f: (l: LigneCoutCanal) => number) => liste.reduce((s, l) => s + f(l), 0);
    const leads = somme((l) => l.leads), rdv = somme((l) => l.rdv_tenus), ventes = somme((l) => l.ventes), cout = somme((l) => l.cout);
    const leadsAvecDelai = liste.reduce((s, l) => s + (l.delai_lead_rdv_median === null ? 0 : l.leads), 0);
    const delais = liste.reduce((s, l) => s + (l.delai_lead_rdv_median ?? 0) * (l.delai_lead_rdv_median === null ? 0 : l.leads), 0);
    canaux.push({
      canal, leads, rdv_tenus: rdv, ventes, ca_signe: somme((l) => l.ca_signe), cout,
      taux_rdv: ratio(rdv, leads, 100), taux_conversion: ratio(ventes, leads, 100),
      cout_par_lead: ratio(cout, leads, 1, 0), cout_par_vente: ratio(cout, ventes, 1, 0),
      delai_lead_rdv_median: leadsAvecDelai > 0 ? Math.round(delais / leadsAvecDelai) : null,
      a_revoir: null,
    });
  }
  const med = mediane(canaux.map((c) => c.cout_par_vente).filter((v): v is number => v !== null && v > 0));
  // Un canal sans coût (appels entrants, base clients) n'a pas de coût par vente à juger.
  for (const c of canaux) c.a_revoir = c.cout === 0 || c.cout_par_vente === null || med === null ? null : c.cout_par_vente > 1.3 * med;
  return canaux.sort((a, b) => b.leads - a.leads);
}

export interface LigneFunnelCanal {
  mois: string;
  agence: string;
  canal: string;
  leads: number;
  signatures_nettes: number;
}

export interface CelluleMatrice {
  leads: number;
  signatures: number;
  taux_conversion: number | null;
}

/** Matrice canal × agence sur la période : leads et conversion lead vers vente nette, clé « canal|agence ». */
export function matriceCanalAgence(lignes: readonly LigneFunnelCanal[], debut: string, fin: string): Map<string, CelluleMatrice> {
  const cumul = new Map<string, { leads: number; signatures: number }>();
  for (const l of lignes) {
    if (l.canal === "TOUS" || l.agence === "RESEAU") continue;
    const m = moisDe(l.mois);
    if (m < debut || m > fin) continue;
    const cle = `${l.canal}|${l.agence}`;
    const c = cumul.get(cle) ?? { leads: 0, signatures: 0 };
    c.leads += l.leads;
    c.signatures += l.signatures_nettes;
    cumul.set(cle, c);
  }
  const resultat = new Map<string, CelluleMatrice>();
  for (const [cle, c] of cumul) resultat.set(cle, { leads: c.leads, signatures: c.signatures, taux_conversion: ratio(c.signatures, c.leads, 100) });
  return resultat;
}

/** Coûts d'acquisition totaux d'une liste de lignes (canal TOUS d'un périmètre) : coût par lead et par vente depuis les sommes. */
export function sommerCouts(lignes: readonly { leads: number; ventes: number; cout: number }[]): { leads: number; ventes: number; cout: number; cpl: number | null; cpv: number | null } {
  const leads = lignes.reduce((s, l) => s + l.leads, 0);
  const ventes = lignes.reduce((s, l) => s + l.ventes, 0);
  const cout = lignes.reduce((s, l) => s + l.cout, 0);
  return { leads, ventes, cout, cpl: leads > 0 ? Math.round(cout / leads) : null, cpv: ventes > 0 ? Math.round(cout / ventes) : null };
}
