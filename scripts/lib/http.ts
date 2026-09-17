import { createWriteStream, existsSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const pause = (ms: number): Promise<void> => new Promise((resoudre) => setTimeout(resoudre, ms));

interface OptionsHttp {
  timeoutMs?: number;
  essais?: number;
}

export async function requeter(url: string, options: OptionsHttp = {}): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const essais = options.essais ?? 3;
  let derniereErreur: unknown;
  for (let essai = 1; essai <= essais; essai += 1) {
    try {
      const reponse = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (reponse.status >= 500) {
        derniereErreur = new Error(`HTTP ${reponse.status} sur ${url}`);
      } else if (!reponse.ok) {
        throw new Error(`HTTP ${reponse.status} sur ${url}`);
      } else {
        return reponse;
      }
    } catch (erreur) {
      if (erreur instanceof Error && erreur.message.startsWith("HTTP 4")) throw erreur;
      derniereErreur = erreur;
    }
    await pause(800 * essai);
  }
  throw derniereErreur instanceof Error ? derniereErreur : new Error(`Echec apres ${essais} essais : ${url}`);
}

export async function requeterJson<T>(url: string, options: OptionsHttp = {}): Promise<T> {
  const reponse = await requeter(url, options);
  return (await reponse.json()) as T;
}

/** Telecharge vers un fichier de cache, sans rien refaire si le fichier existe et n'est pas vide. */
export async function telechargerVersFichier(url: string, chemin: string, options: OptionsHttp = {}): Promise<boolean> {
  if (existsSync(chemin) && statSync(chemin).size > 0) return false;
  await mkdir(dirname(chemin), { recursive: true });
  const reponse = await requeter(url, { timeoutMs: options.timeoutMs ?? 900_000, essais: options.essais ?? 3 });
  if (!reponse.body) throw new Error(`Reponse sans corps : ${url}`);
  const temporaire = `${chemin}.partiel`;
  await pipeline(Readable.fromWeb(reponse.body as never), createWriteStream(temporaire));
  const { rename } = await import("node:fs/promises");
  await rename(temporaire, chemin);
  return true;
}

/** Limite le nombre de promesses en cours d'exécution. */
export function limiteur(concurrence: number): <T>(tache: () => Promise<T>) => Promise<T> {
  let enCours = 0;
  const attente: Array<() => void> = [];
  const suivant = () => {
    enCours -= 1;
    const prochain = attente.shift();
    if (prochain) prochain();
  };
  return async <T>(tache: () => Promise<T>): Promise<T> => {
    if (enCours >= concurrence) {
      await new Promise<void>((resoudre) => attente.push(resoudre));
    }
    enCours += 1;
    try {
      return await tache();
    } finally {
      suivant();
    }
  };
}
