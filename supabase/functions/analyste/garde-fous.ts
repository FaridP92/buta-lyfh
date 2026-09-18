/**
 * Garde-fous SQL de l'analyste (IA.md §4) : un seul SELECT (CTE acceptée), aucun point-virgule ni commentaire,
 * liste blanche de mots, vues autorisées seulement, LIMIT forcé à 200 au plus, longueur bornée.
 * Module pur, testé par Vitest ; la base ajoute le rôle en lecture seule et le délai de 5 secondes.
 */

export const LIMITE_LIGNES = 200;
const LONGUEUR_MAX = 4000;

const MOTS_INTERDITS = [
  "insert", "update", "delete", "merge", "drop", "alter", "create", "truncate", "grant", "revoke", "copy", "execute",
  "call", "do", "set", "reset", "show", "lock", "vacuum", "analyze", "analyse", "explain", "listen", "notify", "into",
  "returning", "security", "session_user", "current_setting", "set_config", "dblink", "pg_sleep", "prepare", "deallocate", "declare", "fetch",
];
const MOTIF_INTERDITS = new RegExp(`\\b(${MOTS_INTERDITS.join("|")})\\b`, "i");
const FONCTIONS_TABLE = new Set(["generate_series", "unnest", "jsonb_array_elements", "json_array_elements"]);
const FIN_DE_LISTE = /^(where|on|using|group|order|limit|offset|having|union|except|intersect|window|left|right|inner|full|cross|natural|join|lateral|fetch|for)$/i;
// Mots-clés qui terminent une liste de sources (« on » et « using » ouvrent une condition, ils n'en font pas partie).
const CLAUSE_SUIVANTE = /^(where|group|order|limit|offset|having|union|except|intersect|window|left|right|inner|full|cross|natural|join|fetch|for)$/i;

export interface Validation {
  ok: boolean;
  sql: string;
  motif: string | null;
}

function nomsCte(sql: string): Set<string> {
  const noms = new Set<string>();
  for (const m of sql.matchAll(/\b(?:with\s+(?:recursive\s+)?|,\s*)([a-z_][\w]*)\s+as\s*\(/gi)) if (m[1]) noms.add(m[1].toLowerCase());
  return noms;
}

/** Sources de données citées après FROM ou JOIN (noms de tables ou de vues, sans alias, sans les sous-requêtes). */
export function sourcesCitees(sql: string): { tables: string[]; fonctions: string[] } {
  const tables: string[] = [];
  const fonctions: string[] = [];
  for (const m of sql.matchAll(/\b(?:from|join)\s+/gi)) {
    let reste = sql.slice((m.index ?? 0) + m[0].length);
    // Liste séparée par des virgules jusqu'au prochain mot-clé de clause.
    for (;;) {
      reste = reste.replace(/^\s+/, "");
      if (reste.startsWith("(")) {
        // Sous-requête : son propre FROM est visité par la boucle principale ; on saute jusqu'à la parenthèse fermante.
        let profondeur = 0;
        let i = 0;
        for (; i < reste.length; i += 1) {
          if (reste[i] === "(") profondeur += 1;
          else if (reste[i] === ")") { profondeur -= 1; if (profondeur === 0) { i += 1; break; } }
        }
        reste = reste.slice(i);
      } else {
        const nom = /^("?[a-z_][\w]*"?(?:\."?[a-z_][\w]*"?)?)(\s*\()?/i.exec(reste);
        if (!nom || !nom[1]) break;
        const identifiant = nom[1].replace(/"/g, "").toLowerCase();
        if (nom[2]) fonctions.push(identifiant); else tables.push(identifiant);
        reste = reste.slice(nom[0].length);
        if (nom[2]) {
          // Appel de fonction : sauter ses arguments.
          let profondeur = 1;
          let i = 0;
          for (; i < reste.length && profondeur > 0; i += 1) {
            if (reste[i] === "(") profondeur += 1;
            else if (reste[i] === ")") profondeur -= 1;
          }
          reste = reste.slice(i);
        }
      }
      // Alias éventuel (avec ou sans AS), puis, en sautant une condition ON ou USING, virgule pour continuer, sinon fin de liste.
      const alias = /^\s*(?:as\s+)?([a-z_][\w]*)/i.exec(reste);
      if (alias && alias[1] && !FIN_DE_LISTE.test(alias[1])) reste = reste.slice(alias[0].length);
      const suite = jusquaVirguleOuClause(reste);
      if (!suite.virgule) break;
      reste = suite.reste;
    }
  }
  return { tables, fonctions };
}

/** Avance au niveau zéro de parenthèses jusqu'à une virgule (liste qui continue) ou un mot-clé de clause (fin de liste). */
function jusquaVirguleOuClause(texte: string): { reste: string; virgule: boolean } {
  let profondeur = 0;
  for (let i = 0; i < texte.length; i += 1) {
    const c = texte[i] ?? "";
    if (c === "(") profondeur += 1;
    else if (c === ")") { profondeur -= 1; if (profondeur < 0) return { reste: "", virgule: false }; }
    else if (profondeur === 0) {
      if (c === ",") return { reste: texte.slice(i + 1), virgule: true };
      if (/[a-z]/i.test(c) && (i === 0 || !/[\w.]/.test(texte[i - 1] ?? ""))) {
        const mot = /^[a-z_]+/i.exec(texte.slice(i))?.[0] ?? "";
        if (CLAUSE_SUIVANTE.test(mot)) return { reste: texte.slice(i), virgule: false };
        i += mot.length - 1;
      }
    }
  }
  return { reste: "", virgule: false };
}

/** Valide et normalise la requête du modèle ; renvoie la requête prête à exécuter ou le motif du refus. */
export function validerSql(brut: string, vuesAutorisees: readonly string[]): Validation {
  let sql = brut.trim().replace(/;\s*$/, "").trim();
  const refus = (motif: string): Validation => ({ ok: false, sql, motif });
  if (sql.length === 0) return refus("requête vide");
  if (sql.length > LONGUEUR_MAX) return refus(`requête trop longue (${sql.length} caractères)`);
  if (sql.includes(";")) return refus("point-virgule refusé");
  if (sql.includes("--") || sql.includes("/*")) return refus("commentaire refusé");
  if (!/^(select|with)\b/i.test(sql)) return refus("seule une requête SELECT est acceptée");
  const interdit = MOTIF_INTERDITS.exec(sql);
  if (interdit) return refus(`mot interdit : ${interdit[1]}`);
  if (/\bpg_|\binformation_schema\b/i.test(sql)) return refus("catalogue système refusé");
  if (/\b(public|pg_catalog|auth|storage|extensions)\./i.test(sql)) return refus("schéma refusé");

  const autorisees = new Set(vuesAutorisees.map((v) => v.toLowerCase()));
  const cte = nomsCte(sql);
  const { tables, fonctions } = sourcesCitees(sql);
  if (tables.length === 0 && fonctions.length === 0) return refus("aucune vue citée");
  for (const t of tables) {
    const nu = t.startsWith("buta.") ? t.slice(5) : t;
    if (nu.includes(".")) return refus(`schéma refusé : ${t}`);
    if (!autorisees.has(nu) && !cte.has(nu)) return refus(`vue non autorisée : ${nu}`);
  }
  for (const f of fonctions) if (!FONCTIONS_TABLE.has(f)) return refus(`fonction de table refusée : ${f}`);

  // LIMIT forcé : au plus 200 lignes ; ajouté s'il manque (dernier LIMIT de la requête, hors sous-requêtes non gérées : le plafond reste le même).
  const limites = [...sql.matchAll(/\blimit\s+(\d+)/gi)];
  const derniere = limites.at(-1);
  if (!derniere) sql = `${sql} limit ${LIMITE_LIGNES}`;
  else if (Number(derniere[1]) > LIMITE_LIGNES) sql = `${sql.slice(0, derniere.index)}limit ${LIMITE_LIGNES}${sql.slice((derniere.index ?? 0) + derniere[0].length)}`;
  return { ok: true, sql, motif: null };
}
