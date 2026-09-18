/**
 * Contrôle des nombres (IA.md, règle fondatrice) : tout nombre écrit par le modèle doit se retrouver dans les
 * lignes ou les faits qui lui ont été transmis, à une reformulation d'unité près (371 500 € écrit 371,5 k€,
 * 23,4 % écrit 23,4). Module pur, sans dépendance, partagé par les Edge Functions et testé par Vitest.
 */

const MOTIF_NOMBRE = /\d[\d   ]*(?:[.,]\d+)?/g;

/** Clé comparable d'un nombre écrit à la française ou en machine : « 284,5 » et « 284.5 » donnent « 284.5 », « 1 300 » donne « 1300 ». */
export function normaliserNombre(brut: string): string {
  const compact = brut.replace(/[\s  ]/g, "").replace(",", ".").replace(/[.,]$/, "");
  if (compact === "") return "";
  const n = Number(compact);
  if (!Number.isFinite(n)) return compact;
  // « 08 » et « 8 » sont le même nombre ; « 2.50 » et « 2.5 » aussi.
  return String(n);
}

/** Les nombres écrits dans un texte, normalisés, dans l'ordre d'apparition (doublons conservés). */
export function extraireNombres(texte: string): string[] {
  return (texte.match(MOTIF_NOMBRE) ?? []).map(normaliserNombre).filter((t) => t !== "");
}

function arrondis(v: number): number[] {
  return [v, Math.round(v), Math.round(v * 10) / 10, Math.round(v * 100) / 100];
}

/** Représentations acceptées d'une valeur numérique : telle quelle, arrondie, en milliers et en millions (k€, M€), en valeur absolue. */
export function representations(v: number): string[] {
  if (!Number.isFinite(v)) return [];
  const abs = Math.abs(v);
  const candidats = [...arrondis(abs), ...arrondis(abs / 1000), ...arrondis(abs / 1_000_000)];
  return [...new Set(candidats.map((c) => String(c)))];
}

function ajouterValeur(valeur: unknown, autorises: Set<string>): void {
  if (typeof valeur === "number") {
    for (const r of representations(valeur)) autorises.add(r);
    return;
  }
  if (typeof valeur === "string") {
    // Nombre en texte (numeric renvoyé en chaîne), date « 2026-08-01 » (année, mois, jour), code « C-SAI-01 » : chaque suite de chiffres.
    const n = Number(valeur.replace(",", "."));
    if (valeur.trim() !== "" && Number.isFinite(n)) {
      for (const r of representations(n)) autorises.add(r);
      return;
    }
    for (const t of valeur.match(/\d+(?:[.,]\d+)?/g) ?? []) autorises.add(normaliserNombre(t));
    return;
  }
  if (Array.isArray(valeur)) {
    for (const v of valeur) ajouterValeur(v, autorises);
    return;
  }
  if (valeur && typeof valeur === "object") {
    for (const v of Object.values(valeur as Record<string, unknown>)) ajouterValeur(v, autorises);
  }
}

/** Nombres autorisés dans une réponse : ceux des lignes ou faits transmis (toutes valeurs, en profondeur), plus ceux de la question et le nombre de lignes. */
export function nombresAutorises(donnees: unknown, question = "", nombreDeLignes: number | null = null): Set<string> {
  const autorises = new Set<string>();
  ajouterValeur(donnees, autorises);
  for (const t of extraireNombres(question)) autorises.add(t);
  if (nombreDeLignes !== null) autorises.add(String(nombreDeLignes));
  return autorises;
}

/** Nombres du texte absents des autorisés (dédoublonnés) : vide si la réponse est traçable. */
export function nombresNonTraces(texte: string, autorises: Set<string>): string[] {
  return [...new Set(extraireNombres(texte).filter((t) => !autorises.has(t)))];
}
