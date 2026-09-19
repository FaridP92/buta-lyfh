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
  angle: number;
  rotation: number;
}

interface Onde {
  naissance: number;
  vie: number;
  rayon: number;
  couleur: string;
}

interface Couleurs {
  ambre: string;
  menthe: string;
  succes: string;
  bleu: string;
  rose: string;
  alerte: string;
  gris: string;
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
    gris: lire("--texte-3", "#808a9d"),
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

/**
 * Signal animé d'une carte KPI (DESIGN.md §11) : « célébration » (trois gerbes qui montent depuis
 * la valeur et retombent, couleurs des séries) ou « alarme » (éclats rouges projetés depuis la
 * valeur et une onde qui s'éteint). Canvas posé au-dessus de la carte, sans effet sur la mise en
 * page, jamais en boucle ; le composant se retire de lui-même à la fin.
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
    const ondes: Onde[] = [];
    let duree: number;
    let gravite: number;

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
            couleur: palette[i % palette.length] ?? couleurs.ambre, angle: entre(0, Math.PI), rotation: entre(-6, 6),
          });
        }
      });
    } else {
      duree = 900;
      gravite = 680;
      for (let i = 0; i < 30; i += 1) {
        const angle = entre(0, Math.PI * 2);
        const vitesse = entre(160, 380);
        particules.push({
          x: origineX + entre(-6, 6), y: origineY + entre(-6, 6), vx: Math.cos(angle) * vitesse, vy: Math.sin(angle) * vitesse - 80,
          naissance: depart, vie: entre(520, 800), taille: entre(2, 4.5),
          couleur: i % 4 === 3 ? couleurs.gris : couleurs.alerte, angle: entre(0, Math.PI), rotation: entre(-14, 14),
        });
      }
      ondes.push({ naissance: depart, vie: 420, rayon: 90, couleur: couleurs.alerte });
    }

    let image = 0;
    const dessiner = (t: number) => {
      contexte.clearRect(0, 0, largeur, hauteur);
      for (const onde of ondes) {
        const x = (t - onde.naissance) / onde.vie;
        if (x < 0 || x > 1) continue;
        contexte.beginPath();
        contexte.arc(origineX, origineY, onde.rayon * (0.2 + 0.8 * x), 0, Math.PI * 2);
        contexte.strokeStyle = onde.couleur;
        contexte.globalAlpha = 0.55 * (1 - x);
        contexte.lineWidth = 2 * (1 - x) + 0.5;
        contexte.stroke();
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
        if (signal === "celebration") {
          contexte.beginPath();
          contexte.arc(px, py, p.taille, 0, Math.PI * 2);
          contexte.fill();
        } else {
          contexte.save();
          contexte.translate(px, py);
          contexte.rotate(p.angle + p.rotation * age);
          contexte.fillRect(-p.taille, -p.taille * 0.35, p.taille * 2, p.taille * 0.7);
          contexte.restore();
        }
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
