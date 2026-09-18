/**
 * Revue hebdomadaire (ECRANS.md §7, IA.md §3) : trois blocs, faits (liste), lecture (cinq phrases), décisions proposées
 * (trois, avec l'indicateur à suivre). Cette version est rédigée par règles à partir du JSON de faits calculé en SQL
 * (buta.faits_revue_hebdo) : elle sert de repli et de première revue ; le modèle (WF3) rend le même format.
 * Aucun chiffre n'est calculé ici hors les écarts relatifs entre deux faits transmis.
 */
import { formatMontant, formatNombre, formatTaux } from "@/lib/format";
import { ecartPct } from "@/lib/periode";

export interface FaitsReseau {
  leads: number;
  rdv_tenus: number;
  signatures: number;
  ca_signe: number;
  poses: number;
  encaisse: number;
  leads_semaine_precedente: number;
  signatures_semaine_precedente: number;
  ca_signe_semaine_precedente: number;
}

export interface FaitsAgence {
  agence: string;
  nom_bassin: string;
  leads: number;
  signatures: number;
  ca_signe: number;
  poses: number;
}

export interface FaitsEcart {
  agence: string;
  mois: string;
  comparaison: string;
  ca_realise: number;
  ca_comparaison: number | null;
  ecart_total: number | null;
  effet_volume: number | null;
  effet_mix: number | null;
  effet_prix: number | null;
  effet_remise: number | null;
  comparaison_disponible: boolean;
}

export interface FaitsAlerte {
  code: string;
  agence: string;
  nom_bassin: string;
  gravite: string;
  valeur: number | null;
  texte: string;
}

export interface FaitsRevue {
  semaine: string;
  reseau: FaitsReseau;
  agences: FaitsAgence[];
  ecarts_mois: FaitsEcart[];
  alertes: FaitsAlerte[];
  mention?: string;
}

export interface Decision {
  texte: string;
  indicateur: string;
}

export interface Revue {
  faits: string[];
  lecture: string[];
  decisions: Decision[];
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function jourMois(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function finDeSemaine(lundi: string): string {
  const d = new Date(`${lundi.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** « de Saintonge », « du Nord », « d'Angoumois », « du Bassin d'Arcachon ». */
export function deAgence(nom: string): string {
  if (nom === "Nord" || nom.startsWith("Bassin ")) return `du ${nom}`;
  if (/^[AEIOUYÉÈÊ]/i.test(nom)) return `d'${nom}`;
  return `de ${nom}`;
}

function signe(v: number): string {
  return `${v > 0 ? "+" : ""}${formatTaux(v)}`;
}

function tendance(valeur: number, reference: number, nom: string, feminin = false): string {
  const e = ecartPct(valeur, reference);
  if (e === null) return `${nom} : ${formatNombre(valeur)}, sans comparaison`;
  if (Math.abs(e) < 3) return `${nom} ${feminin ? "stables" : "stables"} sur une semaine (${formatNombre(valeur)} contre ${formatNombre(reference)})`;
  return `${nom} ${e > 0 ? "en hausse" : "en retrait"} de ${formatTaux(Math.abs(e))} sur une semaine (${formatNombre(valeur)} contre ${formatNombre(reference)})`;
}

/** Rédige la revue par règles à partir des faits SQL. */
export function redigerRevue(f: FaitsRevue): Revue {
  const r = f.reseau;
  const lundi = f.semaine.slice(0, 10);
  const dimanche = finDeSemaine(lundi);
  const agences = [...f.agences].sort((a, b) => b.ca_signe - a.ca_signe);
  const meilleure = agences[0];
  const plusFaible = agences.at(-1);
  const reseauEcart = f.ecarts_mois.find((e) => e.agence === "RESEAU" && e.comparaison_disponible && e.ca_comparaison);
  const ecartsAgences = f.ecarts_mois
    .filter((e) => e.agence !== "RESEAU" && e.comparaison_disponible && e.ca_comparaison && e.ecart_total !== null)
    .map((e) => ({ ...e, pct: ecartPct(e.ca_realise, e.ca_comparaison as number) ?? 0, nom: f.agences.find((a) => a.agence === e.agence)?.nom_bassin ?? e.agence }))
    .sort((a, b) => a.pct - b.pct);
  const moisLibelle = reseauEcart ? `${MOIS[Number(reseauEcart.mois.slice(5, 7)) - 1] ?? reseauEcart.mois}` : null;
  const comparaisonLibelle = reseauEcart?.comparaison === "n1" ? "N-1" : "l'objectif";

  const faits: string[] = [
    `Semaine du ${jourMois(lundi)} au ${jourMois(dimanche)} : ${formatNombre(r.leads)} leads, ${formatNombre(r.rdv_tenus)} RDV tenus, ${formatNombre(r.signatures)} signatures pour ${formatMontant(r.ca_signe)} HT, ${formatNombre(r.poses)} poses, ${formatMontant(r.encaisse)} encaissés.`,
    `Semaine précédente : ${formatNombre(r.leads_semaine_precedente)} leads, ${formatNombre(r.signatures_semaine_precedente)} signatures, ${formatMontant(r.ca_signe_semaine_precedente)} signés.`,
  ];
  if (meilleure && plusFaible && meilleure !== plusFaible) {
    faits.push(`Agences : ${meilleure.nom_bassin} signe le plus (${formatNombre(meilleure.signatures)} signatures, ${formatMontant(meilleure.ca_signe)}), ${plusFaible.nom_bassin} le moins (${formatNombre(plusFaible.signatures)}, ${formatMontant(plusFaible.ca_signe)}).`);
  }
  if (reseauEcart && reseauEcart.ca_comparaison && reseauEcart.ecart_total !== null) {
    faits.push(`${moisLibelle ? moisLibelle.charAt(0).toUpperCase() + moisLibelle.slice(1) : "Mois"} à date : ${formatMontant(reseauEcart.ca_realise)} signés contre ${formatMontant(reseauEcart.ca_comparaison)} pour ${comparaisonLibelle} (${signe(ecartPct(reseauEcart.ca_realise, reseauEcart.ca_comparaison) ?? 0)}) ; effet volume ${formatMontant(reseauEcart.effet_volume ?? 0)}, mix ${formatMontant(reseauEcart.effet_mix ?? 0)}, prix ${formatMontant(reseauEcart.effet_prix ?? 0)}, remise ${formatMontant(reseauEcart.effet_remise ?? 0)}.`);
  }
  faits.push(f.alertes.length === 0 ? "Aucune alerte active à la date de publication." : `${formatNombre(f.alertes.length)} alerte${f.alertes.length > 1 ? "s" : ""} active${f.alertes.length > 1 ? "s" : ""} : ${f.alertes.map((a) => a.texte).join(" ; ")}.`);

  const lecture: string[] = [];
  lecture.push(`${tendance(r.leads, r.leads_semaine_precedente, "Leads")}.`);
  const eSign = ecartPct(r.signatures, r.signatures_semaine_precedente);
  const eCa = ecartPct(r.ca_signe, r.ca_signe_semaine_precedente);
  if (eSign !== null && eCa !== null) {
    const sens = eSign < -20 ? "une semaine de conversion faible, à lire sur deux semaines avant de conclure" : eSign > 20 ? "une bonne semaine de conversion, à confirmer la semaine prochaine" : "une semaine dans la moyenne";
    lecture.push(`Signatures ${eSign >= 0 ? "en hausse" : "en retrait"} de ${formatTaux(Math.abs(eSign))} et CA signé ${eCa >= 0 ? "en hausse" : "en retrait"} de ${formatTaux(Math.abs(eCa))} : ${sens}.`);
  } else {
    lecture.push(`Signatures : ${formatNombre(r.signatures)}, sans semaine de comparaison.`);
  }
  const sousObjectif = ecartsAgences.filter((e) => e.pct <= -20);
  const auDessus = ecartsAgences.filter((e) => e.pct > 0);
  if (ecartsAgences.length > 0) {
    lecture.push(sousObjectif.length > 0
      ? `${formatNombre(sousObjectif.length)} agence${sousObjectif.length > 1 ? "s sont" : " est"} à plus de 20 % sous ${comparaisonLibelle} au prorata du mois : ${sousObjectif.map((e) => `${e.nom} (${signe(e.pct)})`).join(", ")}.`
      : `Aucune agence n'est à plus de 20 % sous ${comparaisonLibelle} au prorata du mois.`);
    lecture.push(auDessus.length > 0 ? `${auDessus.map((e) => `${e.nom} (${signe(e.pct)})`).join(", ")} dépasse${auDessus.length > 1 ? "nt" : ""} ${comparaisonLibelle}.` : `Aucune agence ne dépasse ${comparaisonLibelle} ce mois-ci.`);
  }
  if (reseauEcart && reseauEcart.ecart_total) {
    const effets = [
      { nom: "volume", v: reseauEcart.effet_volume ?? 0 }, { nom: "mix", v: reseauEcart.effet_mix ?? 0 },
      { nom: "prix", v: reseauEcart.effet_prix ?? 0 }, { nom: "remise", v: reseauEcart.effet_remise ?? 0 },
    ].sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    const premier = effets[0];
    const second = effets[1];
    if (premier) {
      const part = Math.round((100 * premier.v) / reseauEcart.ecart_total);
      lecture.push(`L'écart du réseau tient d'abord au ${premier.nom} (${formatMontant(premier.v)}, ${formatNombre(part)} % de l'écart)${second ? ` puis au ${second.nom} (${formatMontant(second.v)})` : ""}.`);
    }
  }
  lecture.push(f.alertes.length === 0 ? "Aucune alerte n'appelle de décision cette semaine." : `Les alertes du matin appellent une décision : ${f.alertes.map((a) => a.nom_bassin).join(", ")}.`);

  const decisions: Decision[] = [];
  for (const a of f.alertes) {
    if (a.code === "CPV_LEADS_ACHETES") decisions.push({ texte: `Plafonner les leads achetés ${deAgence(a.nom_bassin)} et renégocier le prix du lead ; revoir le coût par vente dans quatre semaines.`, indicateur: "CPV" });
    else if (a.code === "DOSSIERS_A_QUALIFIER") decisions.push({ texte: `Terminer l'alignement du référentiel ${deAgence(a.nom_bassin)} et qualifier les ${formatNombre(a.valeur ?? 0)} dossiers restants avant de comparer ses taux.`, indicateur: "QUALITE" });
    else if (a.code === "CARNET_POSE" || a.code === "POSES_EN_RETARD") decisions.push({ texte: `Renfort de pose à ${a.nom_bassin} jusqu'à résorption du carnet, poses priorisées par ancienneté de signature.`, indicateur: "CARNET" });
  }
  const pire = sousObjectif[0];
  if (pire) decisions.push({ texte: `Revue de pipe avec ${pire.nom} : ${signe(pire.pct)} sur le mois, devis en attente à passer en revue cette semaine.`, indicateur: "TX_SIGN" });
  if (eSign !== null && eSign < -20) decisions.push({ texte: "Passer en revue les devis de plus de 30 jours de toutes les agences et relancer sous 48 heures les leads sans rendez-vous planifié.", indicateur: "ATTENTE48" });
  decisions.push({ texte: "Confirmer la semaine prochaine que les leads sans rendez-vous à 48 heures reculent dans chaque agence.", indicateur: "ATTENTE48" });
  const uniques: Decision[] = [];
  for (const d of decisions) if (!uniques.some((u) => u.indicateur === d.indicateur)) uniques.push(d);
  return { faits, lecture: lecture.slice(0, 5), decisions: uniques.slice(0, 3) };
}

/** Texte de la revue au format commun (rédaction par règles ou par le modèle) : trois titres, listes et phrases. */
export function versTexte(r: Revue): string {
  return [
    "## Faits", ...r.faits.map((x) => `- ${x}`), "",
    "## Lecture", ...r.lecture, "",
    "## Décisions proposées", ...r.decisions.map((d) => `- ${d.texte} (indicateur : ${d.indicateur})`),
  ].join("\n");
}

/** Relit un texte au format commun ; null si les trois blocs ne sont pas reconnaissables. */
export function analyserTexte(texte: string): Revue | null {
  const blocs: Record<string, string[]> = {};
  let courant: string | null = null;
  for (const brute of texte.split("\n")) {
    const ligne = brute.trim();
    if (ligne.startsWith("## ")) { courant = ligne.slice(3).trim().toLowerCase(); blocs[courant] = []; continue; }
    if (!ligne || !courant) continue;
    blocs[courant]?.push(ligne.startsWith("- ") ? ligne.slice(2).trim() : ligne);
  }
  const faits = blocs["faits"];
  const lecture = blocs["lecture"];
  const decisions = blocs["décisions proposées"] ?? blocs["decisions proposees"] ?? blocs["décisions"];
  if (!faits || !lecture || !decisions) return null;
  return {
    faits, lecture,
    decisions: decisions.map((d) => {
      const m = /\(indicateur\s*:\s*([A-Z0-9_]+)\)\s*$/.exec(d);
      return m ? { texte: d.slice(0, m.index).trim(), indicateur: m[1] as string } : { texte: d, indicateur: "" };
    }),
  };
}
