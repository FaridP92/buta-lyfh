import { createInterface } from "node:readline";

/** Decoupe une ligne CSV (separateur simple, champs eventuellement entre guillemets doubles). */
export function decouperLigneCsv(ligne: string, separateur = ";"): string[] {
  const champs: string[] = [];
  let courant = "";
  let entreGuillemets = false;
  for (let i = 0; i < ligne.length; i += 1) {
    const caractere = ligne[i];
    if (caractere === '"') {
      if (entreGuillemets && ligne[i + 1] === '"') {
        courant += '"';
        i += 1;
      } else {
        entreGuillemets = !entreGuillemets;
      }
    } else if (caractere === separateur && !entreGuillemets) {
      champs.push(courant);
      courant = "";
    } else {
      courant += caractere;
    }
  }
  champs.push(courant);
  return champs;
}

/**
 * Lit un flux CSV ligne a ligne sans le charger en memoire.
 * Renvoie pour chaque ligne un objet indexe par le nom de colonne de l'en-tete.
 */
export async function* lignesCsv(
  flux: NodeJS.ReadableStream,
  separateur = ";",
): AsyncGenerator<Record<string, string>> {
  const lecteur = createInterface({ input: flux, crlfDelay: Infinity });
  let entete: string[] | null = null;
  for await (const brute of lecteur) {
    const ligne = entete === null ? brute.replace(/^﻿/, "") : brute;
    if (ligne.trim() === "") continue;
    const champs = decouperLigneCsv(ligne, separateur);
    if (entete === null) {
      entete = champs.map((c) => c.trim());
      continue;
    }
    const objet: Record<string, string> = {};
    entete.forEach((nom, index) => {
      objet[nom] = champs[index] ?? "";
    });
    yield objet;
  }
}

export function nombre(valeur: string | undefined): number {
  if (valeur === undefined || valeur === "") return 0;
  const n = Number(valeur.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
