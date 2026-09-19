/**
 * Fonctions pures de l'écran Analyste (CLAUDE.md : aucun nombre calculé dans un composant) : total du jour du
 * journal IA, jour courant en heure de Paris, mise en forme d'affichage d'une requête SQL, traduction d'un code
 * en libellé, libellé de nature des données. Testées par Vitest (tests/analyste.test.ts).
 */

export interface UsageIa {
  jour: string;
  fonction: string;
  appels: number;
  cout_eur: number;
}

/** Date AAAA-MM-JJ en Europe/Paris : le journal IA compte les jours en heure de Paris, pas en UTC. */
export function jourParis(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Coût et appels d'un jour, toutes fonctions IA confondues (analyste et explication d'écart). */
export function totalDuJour(usages: readonly UsageIa[] | undefined, jour: string): { cout: number; appels: number } {
  let cout = 0;
  let appels = 0;
  for (const u of usages ?? []) {
    if (u.jour !== jour) continue;
    cout += u.cout_eur;
    appels += u.appels;
  }
  return { cout: Math.round(cout * 10_000) / 10_000, appels };
}

const CLAUSES = ["from", "left join", "right join", "inner join", "full join", "cross join", "join", "where", "group by", "having", "order by", "limit", "union all", "union", "except", "intersect"];

/**
 * Requête SQL sur plusieurs lignes pour la lecture : un retour à la ligne avant chaque clause de premier niveau
 * (from, where, group by, order by, limit, jointures, union), les sous-requêtes entre parenthèses restant en ligne.
 * La requête copiée dans le presse-papiers reste celle du modèle, inchangée.
 */
export function formaterSql(sql: string): string {
  const texte = sql.replace(/\s+/g, " ").trim();
  let sortie = "";
  let profondeur = 0;
  let i = 0;
  while (i < texte.length) {
    const c = texte[i] ?? "";
    if (c === "(") profondeur += 1;
    else if (c === ")") profondeur = Math.max(0, profondeur - 1);
    if (profondeur === 0 && (i === 0 || texte[i - 1] === " ")) {
      const reste = texte.slice(i).toLowerCase();
      const clause = CLAUSES.find((k) => reste.startsWith(`${k} `) || reste === k);
      if (clause && sortie.length > 0) {
        sortie = `${sortie.trimEnd()}\n`;
      }
    }
    sortie += c;
    i += 1;
  }
  return sortie;
}

export interface Referentiel {
  code: string;
  libelle: string;
}

/** Libellé d'un code d'agence, de canal ou de produit tel que le site le nomme ; la valeur inchangée sinon. */
export function libelleCode(valeur: string, referentiels: readonly Referentiel[]): string {
  if (valeur === "RESEAU") return "Réseau";
  if (valeur === "TOUS") return "Tous";
  return referentiels.find((r) => r.code === valeur)?.libelle ?? valeur;
}

export type NatureDonnees = "simule" | "reel" | "mixte";

export function libelleNature(nature: NatureDonnees | undefined): string {
  if (nature === "reel") return "marché réel";
  if (nature === "mixte") return "simulé et marché réel";
  return "simulé";
}
