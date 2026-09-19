import { useEffect, useRef } from "react";
import type { Signal } from "@/lib/signaux";

/** Marge autour de la carte pour que les éclats et les gerbes puissent en sortir. */
const MARGE = 48;

interface Particule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  naissance: number;
  vie: number;
  taille: number;
  couleur: string;
}

interface Couleurs {
  ambre: string;
  menthe: string;
  succes: string;
  bleu: string;
  rose: string;
  alerte: string;
}

function lireCouleurs(): Couleurs {
  const style = getComputedStyle(document.documentElement);
  const lire = (nom: string, defaut: string) => style.getPropertyValue(nom).trim() || defaut;
  return {
    ambre: lire("--ambre", "#f5b700"),
    menthe: lire("--menthe", "#2dd4bf"),
    succes: lire("--succes", "#34d399"),
    bleu: lire("--bleu", "#60a5fa"),
    rose: lire("--rose", "#f472b6"),
    alerte: lire("--alerte", "#fb7185"),
  };
}

/** Générateur déterministe (même graine, même gerbe) pour que deux rendus d'une carte se ressemblent. */
function graine(depart: number) {
  let etat = depart >>> 0 || 1;
  return () => {
    etat = (etat * 1664525 + 1013904223) >>> 0;
    return etat / 4294967296;
  };
}

interface Flamme {
  x: number;
  naissance: number;
  vie: number;
  vitesse: number;
  rayon: number;
  phase: number;
  derive: number;
  braise: boolean;
}

/** Couleur d'une langue de flamme selon son âge : cœur pâle, puis ambre, puis rouge qui s'éteint. */
function couleurFlamme(x: number, alpha: number): string {
  const r = 255;
  const g = Math.round(x < 0.35 ? 236 - (x / 0.35) * 70 : 166 - ((x - 0.35) / 0.65) * 120);
  const b = Math.round(x < 0.35 ? 170 - (x / 0.35) * 160 : 10 + ((x - 0.35) / 0.65) * 80);
  return `rgba(${r}, ${Math.max(0, g)}, ${Math.max(0, b)}, ${alpha})`;
}

/**
 * Signal animé d'une carte KPI (DESIGN.md §11) : « célébration » (trois gerbes qui montent depuis
 * la valeur et retombent, couleurs des séries) ou « alarme » (la carte s'enflamme : des langues de
 * feu montent du bord bas et lèchent les côtés pendant une seconde, puis quelques braises
 * s'éteignent). Canvas posé au-dessus de la carte, sans effet sur la mise en page, jamais en
 * boucle ; le composant se retire de lui-même à la fin.
 */
export function SignalCarte({ signal, onFin }: { signal: Signal; onFin: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const finRef = useRef(onFin);
  finRef.current = onFin;

  useEffect(() => {
    const canvas = ref.current;
    const carte = canvas?.parentElement;
    if (!canvas || !carte) return;
    const contexte = canvas.getContext("2d");
    if (!contexte) return;

    const rect = carte.getBoundingClientRect();
    const largeur = rect.width + 2 * MARGE;
    const hauteur = rect.height + 2 * MARGE;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(largeur * dpr);
    canvas.height = Math.round(hauteur * dpr);
    contexte.scale(dpr, dpr);

    const couleurs = lireCouleurs();
    const alea = graine(Math.round(rect.width * 31 + rect.height * 17));
    const entre = (a: number, b: number) => a + (b - a) * alea();
    // La valeur est en bas à gauche de la carte : les gerbes et les éclats partent de là.
    const origineX = MARGE + Math.min(rect.width * 0.28, 120);
    const origineY = MARGE + rect.height * 0.62;
    const depart = performance.now();
    const particules: Particule[] = [];
    const flammes: Flamme[] = [];
    let duree: number;
    let gravite: number;
    // Bord bas de la carte et tiers inférieur des côtés : là où le feu prend.
    const basY = MARGE + rect.height - 1;
    const gauche = MARGE;
    const droite = MARGE + rect.width;
    let derniereNaissance = depart;

    if (signal === "celebration") {
      duree = 1400;
      gravite = 520;
      const palette = [couleurs.ambre, couleurs.menthe, couleurs.succes, couleurs.bleu, couleurs.rose];
      [0, 260, 520].forEach((decalage, salve) => {
        const cx = origineX + entre(-24, 24) + salve * 18;
        const cy = origineY - entre(0, 12);
        for (let i = 0; i < 24; i += 1) {
          const angle = -Math.PI / 2 + entre(-1.25, 1.25);
          const vitesse = entre(140, 300);
          particules.push({
            x: cx, y: cy, vx: Math.cos(angle) * vitesse, vy: Math.sin(angle) * vitesse,
            naissance: depart + decalage, vie: entre(650, 950), taille: entre(1.8, 3.4),
            couleur: palette[i % palette.length] ?? couleurs.ambre,
          });
        }
      });
    } else {
      duree = 1500;
      gravite = 0;
    }
    const PHASE_FEU = 950;

    /** Fait naître des langues de feu le long du bord bas (et un peu sur les côtés) tant que le feu dure. */
    const allumer = (t: number) => {
      if (t - depart > PHASE_FEU) return;
      const intensite = t - depart < 250 ? (t - depart) / 250 : 1;
      while (derniereNaissance < t) {
        derniereNaissance += 14;
        const nombre = Math.round(3 * intensite);
        for (let i = 0; i < nombre; i += 1) {
          const cote = alea();
          const x = cote < 0.12 ? gauche + entre(-2, 6) : cote > 0.88 ? droite + entre(-6, 2) : entre(gauche + 6, droite - 6);
          flammes.push({
            x, naissance: derniereNaissance, vie: entre(420, 780), vitesse: entre(70, 165), rayon: entre(7, 16),
            phase: entre(0, Math.PI * 2), derive: entre(-18, 18), braise: false,
          });
        }
      }
      // Quelques braises isolées, plus vives, montent plus haut.
      if (alea() < 0.18 * intensite) {
        flammes.push({ x: entre(gauche + 10, droite - 10), naissance: t, vie: entre(600, 900), vitesse: entre(120, 190), rayon: entre(1.2, 2.2), phase: entre(0, Math.PI * 2), derive: entre(-30, 30), braise: true });
      }
    };

    let image = 0;
    const dessiner = (t: number) => {
      contexte.clearRect(0, 0, largeur, hauteur);
      if (signal === "alarme") {
        allumer(t);
        const ecoule = t - depart;
        // Halo chaud au pied de la carte, qui monte puis s'éteint.
        const chaleur = ecoule < 200 ? ecoule / 200 : ecoule < PHASE_FEU ? 1 : Math.max(0, 1 - (ecoule - PHASE_FEU) / (duree - PHASE_FEU));
        if (chaleur > 0) {
          const halo = contexte.createLinearGradient(0, basY - 90, 0, basY + 6);
          halo.addColorStop(0, "rgba(255, 120, 40, 0)");
          halo.addColorStop(1, `rgba(255, 150, 50, ${0.3 * chaleur})`);
          contexte.fillStyle = halo;
          contexte.fillRect(gauche, basY - 90, droite - gauche, 96);
        }
        for (const f of flammes) {
          const x = (t - f.naissance) / f.vie;
          if (x < 0 || x > 1) continue;
          const age = (t - f.naissance) / 1000;
          const depuisBas = f.vitesse * age;
          const px = f.x + f.derive * age + Math.sin(f.phase + age * 9) * (f.braise ? 3 : 5) * x;
          const py = basY - depuisBas;
          if (f.braise) {
            contexte.globalAlpha = 1 - x;
            contexte.fillStyle = couleurs.ambre;
            contexte.beginPath();
            contexte.arc(px, py, f.rayon, 0, Math.PI * 2);
            contexte.fill();
            continue;
          }
          const rayon = f.rayon * (1 - 0.85 * x);
          const degrade = contexte.createRadialGradient(px, py, 0, px, py, rayon);
          degrade.addColorStop(0, couleurFlamme(x, 0.85 * (1 - x)));
          degrade.addColorStop(0.55, couleurFlamme(Math.min(1, x + 0.25), 0.45 * (1 - x)));
          degrade.addColorStop(1, couleurFlamme(1, 0));
          contexte.globalAlpha = 1;
          contexte.fillStyle = degrade;
          contexte.beginPath();
          // Langue de feu : un disque étiré vers le haut.
          contexte.ellipse(px, py, rayon, rayon * 1.6, 0, 0, Math.PI * 2);
          contexte.fill();
        }
        contexte.globalAlpha = 1;
        if (t - depart < duree) image = requestAnimationFrame(dessiner);
        else {
          contexte.clearRect(0, 0, largeur, hauteur);
          finRef.current();
        }
        return;
      }
      for (const p of particules) {
        const age = (t - p.naissance) / 1000;
        if (age < 0) continue;
        const x = (t - p.naissance) / p.vie;
        if (x > 1) continue;
        const px = p.x + p.vx * age;
        const py = p.y + p.vy * age + 0.5 * gravite * age * age;
        contexte.globalAlpha = x < 0.6 ? 1 : 1 - (x - 0.6) / 0.4;
        contexte.fillStyle = p.couleur;
        contexte.beginPath();
        contexte.arc(px, py, p.taille, 0, Math.PI * 2);
        contexte.fill();
      }
      contexte.globalAlpha = 1;
      if (t - depart < duree) image = requestAnimationFrame(dessiner);
      else {
        contexte.clearRect(0, 0, largeur, hauteur);
        finRef.current();
      }
    };
    image = requestAnimationFrame(dessiner);
    return () => cancelAnimationFrame(image);
  }, [signal]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute z-10"
      style={{ left: -MARGE, top: -MARGE, width: `calc(100% + ${2 * MARGE}px)`, height: `calc(100% + ${2 * MARGE}px)` }}
    />
  );
}
