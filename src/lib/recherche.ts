/** Recherche tolérante de la palette : sans accents ni casse, chaque mot de la requête doit apparaître dans la cible. */
export function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function correspond(cible: string, requete: string): boolean {
  const mots = normaliser(requete).split(/\s+/).filter(Boolean);
  return mots.every((m) => cible.includes(m));
}
