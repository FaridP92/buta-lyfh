/**
 * Contrôle des nombres (IA.md, règle fondatrice) : tout nombre écrit par le modèle doit se retrouver dans les
 * lignes ou les faits qui lui ont été transmis, à une reformulation d'unité près (371 500 € écrit 371,5 k€,
 * 23,4 % écrit 23,4). Module pur, sans dépendance, partagé par les Edge Functions et testé par Vitest.
 * Relecture du 19 septembre 2026 : nombres écrits en lettres (« quatre agences ») comptés comme des nombres,
 * signe vérifié quand il est écrit (« -17 779 € »), formes en milliers et millions réservées aux valeurs
 * qui les justifient, arrondis à la dizaine, à la centaine et au millier acceptés, référentiels versés en
 * chiffres bruts seulement.
 */

const MOTIF_NOMBRE = /\d[\d   ]*(?:[.,]\d+)?/g;

/** Nombres écrits en lettres, de deux à mille ; « un » et « une » sont des articles et restent hors contrôle. */
const MOTS_NOMBRES: Record<string, number> = {
  deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13,
  quatorze: 14, quinze: 15, seize: 16, "dix-sept": 17, "dix-huit": 18, "dix-neuf": 19, vingt: 20, trente: 30,
  quarante: 40, cinquante: 50, soixante: 60, cent: 100, mille: 1000,
};
const MOTIF_MOTS = new RegExp(`(?<![\\p{L}-])(${Object.keys(MOTS_NOMBRES).sort((a, b) => b.length - a.length).join("|")})(?![\\p{L}-])`, "giu");

/** Clé comparable d'un nombre écrit à la française ou en machine : « 284,5 » et « 284.5 » donnent « 284.5 », « 1 300 » donne « 1300 ». */
export function normaliserNombre(brut: string): string {
  const compact = brut.replace(/[\s  ]/g, "").replace(",", ".").replace(/[.,]$/, "");
  if (compact === "") return "";
  const n = Number(compact);
  if (!Number.isFinite(n)) return compact;
  // « 08 » et « 8 » sont le même nombre ; « 2.50 » et « 2.5 » aussi.
  return String(n);
}

/** Les nombres écrits dans un texte, en chiffres puis en lettres, normalisés, dans l'ordre d'apparition (doublons conservés). */
export function extraireNombres(texte: string): string[] {
  const chiffres = (texte.match(MOTIF_NOMBRE) ?? []).map(normaliserNombre).filter((t) => t !== "");
  const lettres = (texte.match(MOTIF_MOTS) ?? []).map((m) => String(MOTS_NOMBRES[m.toLowerCase()] ?? "")).filter((t) => t !== "");
  return [...chiffres, ...lettres];
}

function arrondis(v: number): number[] {
  const formes = [v, Math.round(v), Math.round(v * 10) / 10, Math.round(v * 100) / 100];
  // Arrondis à la dizaine, à la centaine et au millier quand la valeur les atteint (« près de 300 000 € »).
  if (v >= 10) formes.push(Math.round(v / 10) * 10);
  if (v >= 100) formes.push(Math.round(v / 100) * 100);
  if (v >= 1000) formes.push(Math.round(v / 1000) * 1000);
  return formes;
}

/** Représentations acceptées d'une valeur numérique : telle quelle, arrondie, en milliers (dès 1 000) et en millions (dès 1 000 000), en valeur absolue. */
export function representations(v: number): string[] {
  if (!Number.isFinite(v)) return [];
  const abs = Math.abs(v);
  const candidats = [...arrondis(abs)];
  if (abs >= 1000) candidats.push(...arrondis(abs / 1000));
  if (abs >= 1_000_000) candidats.push(...arrondis(abs / 1_000_000));
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

/** Suites de chiffres telles quelles (sans arrondi ni forme en milliers) : pour les référentiels, codes et dates. */
function ajouterBrut(valeur: unknown, autorises: Set<string>): void {
  if (typeof valeur === "number") {
    autorises.add(String(valeur));
    return;
  }
  if (typeof valeur === "string") {
    for (const t of valeur.match(/\d+(?:[.,]\d+)?/g) ?? []) autorises.add(normaliserNombre(t));
    return;
  }
  if (Array.isArray(valeur)) {
    for (const v of valeur) ajouterBrut(v, autorises);
    return;
  }
  if (valeur && typeof valeur === "object") {
    for (const v of Object.values(valeur as Record<string, unknown>)) ajouterBrut(v, autorises);
  }
}

/**
 * Nombres autorisés dans une réponse : ceux des lignes ou faits transmis (toutes valeurs, en profondeur, avec leurs
 * reformulations), ceux de la question, les dénombrements de 1 au nombre de lignes (« deux contrôles » sur trois lignes
 * se vérifie en comptant le tableau), et les chiffres bruts des référentiels (codes de département, années, journée
 * publiée) sans aucune reformulation.
 */
export function nombresAutorises(donnees: unknown, question = "", nombreDeLignes: number | null = null, referentiels: unknown = null): Set<string> {
  const autorises = new Set<string>();
  ajouterValeur(donnees, autorises);
  for (const t of extraireNombres(question)) autorises.add(t);
  if (nombreDeLignes !== null) for (let k = 1; k <= nombreDeLignes; k += 1) autorises.add(String(k));
  if (referentiels !== null) ajouterBrut(referentiels, autorises);
  return autorises;
}

/** Nombres du texte absents des autorisés (dédoublonnés) : vide si la réponse est traçable. */
export function nombresNonTraces(texte: string, autorises: Set<string>): string[] {
  return [...new Set(extraireNombres(texte).filter((t) => !autorises.has(t)))];
}

function valeursNumeriques(donnees: unknown, sortie: number[] = []): number[] {
  if (typeof donnees === "number") sortie.push(donnees);
  else if (typeof donnees === "string") {
    const n = Number(donnees.replace(",", "."));
    if (donnees.trim() !== "" && Number.isFinite(n)) sortie.push(n);
  } else if (Array.isArray(donnees)) for (const v of donnees) valeursNumeriques(v, sortie);
  else if (donnees && typeof donnees === "object") for (const v of Object.values(donnees as Record<string, unknown>)) valeursNumeriques(v, sortie);
  return sortie;
}

/**
 * Nombres écrits avec un signe (« -17 779 € », « +5,2 % ») dont aucune valeur des données ne porte ce signe :
 * un montant négatif recopié en positif, ou l'inverse, passe le contrôle en valeur absolue mais pas ici.
 * Le signe doit précéder immédiatement le nombre, sans chiffre ni lettre devant (une date « 2026-09-01 » n'est pas un signe).
 */
export function signesIncoherents(texte: string, donnees: unknown): string[] {
  const valeurs = valeursNumeriques(donnees);
  const positives = new Set(valeurs.filter((v) => v > 0).flatMap((v) => representations(v)));
  const negatives = new Set(valeurs.filter((v) => v < 0).flatMap((v) => representations(v)));
  const incoherents: string[] = [];
  for (const m of texte.matchAll(/(?<![\p{L}\d])([+-])\s?(\d[\d   ]*(?:[.,]\d+)?)/gu)) {
    const signe = m[1];
    const cle = normaliserNombre(m[2] ?? "");
    if (cle === "" || cle === "0") continue;
    const attendu = signe === "-" ? negatives : positives;
    const autre = signe === "-" ? positives : negatives;
    if (!attendu.has(cle) && autre.has(cle)) incoherents.push(`${signe}${cle}`);
  }
  return [...new Set(incoherents)];
}
