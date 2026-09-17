/** Generateur pseudo-aleatoire deterministe (mulberry32) : meme graine, meme jeu. */
export class Alea {
  private etat: number;

  constructor(graine: number) {
    this.etat = graine >>> 0;
  }

  /** Uniforme dans [0, 1). */
  uniforme(): number {
    this.etat = (this.etat + 0x6d2b79f5) >>> 0;
    let t = this.etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniforme dans [min, max). */
  entre(min: number, max: number): number {
    return min + (max - min) * this.uniforme();
  }

  /** Entier uniforme dans [min, max] inclus. */
  entier(min: number, max: number): number {
    return Math.floor(this.entre(min, max + 1));
  }

  /** Normale centree reduite (Box-Muller). */
  normale(): number {
    let u = 0;
    while (u === 0) u = this.uniforme();
    const v = this.uniforme();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Log-normale de mediane donnee et d'ecart-type sigma sur le log. */
  logNormale(mediane: number, sigma: number): number {
    return mediane * Math.exp(sigma * this.normale());
  }

  /** Vrai avec la probabilite p. */
  bernoulli(p: number): boolean {
    return this.uniforme() < p;
  }

  /** Tirage pondere : renvoie l'indice choisi. */
  indicePondere(poids: readonly number[]): number {
    let total = 0;
    for (const p of poids) total += p;
    let seuil = this.uniforme() * total;
    for (let i = 0; i < poids.length; i++) {
      seuil -= poids[i] ?? 0;
      if (seuil < 0) return i;
    }
    return poids.length - 1;
  }

  choix<T>(elements: readonly T[]): T {
    const element = elements[this.entier(0, elements.length - 1)];
    if (element === undefined) throw new Error("choix sur une liste vide");
    return element;
  }
}
