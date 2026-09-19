/**
 * Fiche de présentation illustrée (BACKLOG US-053) : docs/FICHE.html, et docs/FICHE.pdf
 * avec --pdf, générés depuis docs/GUIDE_ILLUSTRE.md et rien d'autre, pour que toute
 * correction du guide se retrouve dans la fiche. Les captures restent dans
 * docs/captures/guide/ et sont référencées en relatif (la page se publie telle quelle
 * avec ce dossier à côté d'elle).
 *
 * Le sous-ensemble Markdown compris est celui du guide : titres # ## ###, paragraphes,
 * images seules sur leur ligne, listes à puces et numérotées, tableaux, gras, italique,
 * code en ligne, adresses https. Les puces « Ce que ça montre », « Comment le lire »,
 * « Ce qu'on en fait » deviennent une liste de définitions ; un paragraphe qui commence
 * par un titre en gras devient le titre d'un visuel.
 *
 * Usage : tsx scripts/generer-fiche.ts [--pdf]
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const RACINE = process.cwd();
const SOURCE = join(RACINE, "docs", "GUIDE_ILLUSTRE.md");
const SORTIE_HTML = join(RACINE, "docs", "FICHE.html");
const SORTIE_PDF = join(RACINE, "docs", "FICHE.pdf");
const LOGO_SOURCE = join(RACINE, "public", "logo", "monogramme.png");
const LOGO_PETIT = join(RACINE, "public", "logo", "monogramme-96.png");
const LOGO_DOCS = join(RACINE, "docs", "logo", "monogramme.png");

const LABELS_DEFINITION = ["Ce que ça montre", "Comment le lire", "Ce qu'on en fait"];

type Bloc =
  | { type: "h1"; texte: string }
  | { type: "h2"; numero: string; texte: string }
  | { type: "h3"; numero: string; texte: string }
  | { type: "p"; texte: string }
  | { type: "legende"; texte: string }
  | { type: "images"; images: { alt: string; src: string }[] }
  | { type: "liste"; ordonnee: boolean; items: string[] }
  | { type: "tableau"; entetes: string[]; lignes: string[][] };

function echapper(texte: string): string {
  return texte.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** Gras, italique, code en ligne et adresses, après échappement HTML. */
function enLigne(texte: string): string {
  let html = echapper(texte);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[\s(«])\*([^*]+)\*(?=[\s).,;:»]|$)/g, "$1<em>$2</em>");
  html = html.replace(/https?:\/\/[^\s<]+?(?=[.,;:)]?(\s|$))/g, (adresse) => `<a href="${adresse}">${adresse}</a>`);
  return html;
}

function ancre(numero: string): string {
  return `s${numero.replaceAll(".", "-")}`;
}

function decouper(markdown: string): Bloc[] {
  const lignes = markdown.split("\n");
  const blocs: Bloc[] = [];
  let i = 0;
  while (i < lignes.length) {
    const ligne = lignes[i] ?? "";
    const propre = ligne.trim();
    if (propre === "" || propre === "---") {
      i += 1;
      continue;
    }
    const titre = /^(#{1,3})\s+(.*)$/.exec(propre);
    if (titre) {
      const niveau = (titre[1] ?? "#").length;
      const contenu = titre[2] ?? "";
      if (niveau === 1) blocs.push({ type: "h1", texte: contenu });
      else {
        const numerote = /^(\d+(?:\.\d+)?)\.?\s+(.*)$/.exec(contenu);
        const numero = numerote?.[1] ?? "";
        const texte = numerote?.[2] ?? contenu;
        blocs.push({ type: niveau === 2 ? "h2" : "h3", numero, texte });
      }
      i += 1;
      continue;
    }
    if (propre.startsWith("![")) {
      const images: { alt: string; src: string }[] = [];
      while (i < lignes.length) {
        const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec((lignes[i] ?? "").trim());
        if (!image) break;
        images.push({ alt: image[1] ?? "", src: image[2] ?? "" });
        i += 1;
      }
      blocs.push({ type: "images", images });
      continue;
    }
    if (propre.startsWith("|")) {
      const rangees: string[][] = [];
      while (i < lignes.length && (lignes[i] ?? "").trim().startsWith("|")) {
        const cellules = (lignes[i] ?? "").trim().slice(1, -1).split("|").map((c) => c.trim());
        if (!cellules.every((c) => /^-+$/.test(c))) rangees.push(cellules);
        i += 1;
      }
      const [entetes = [], ...corps] = rangees;
      blocs.push({ type: "tableau", entetes, lignes: corps });
      continue;
    }
    const puce = /^(-|\d+\.)\s+/.exec(propre);
    if (puce) {
      const ordonnee = puce[1] !== "-";
      const items: string[] = [];
      while (i < lignes.length) {
        const item = /^(-|\d+\.)\s+(.*)$/.exec((lignes[i] ?? "").trim());
        if (!item || (item[1] !== "-") !== ordonnee) break;
        items.push(item[2] ?? "");
        i += 1;
      }
      blocs.push({ type: "liste", ordonnee, items });
      continue;
    }
    if (/^\*[^*].*\*$/.test(propre)) {
      blocs.push({ type: "legende", texte: propre.slice(1, -1) });
      i += 1;
      continue;
    }
    const paragraphe: string[] = [];
    while (i < lignes.length) {
      const suite = (lignes[i] ?? "").trim();
      if (suite === "" || /^(#|!\[|\||-\s|\d+\.\s|---)/.test(suite)) break;
      paragraphe.push(suite);
      i += 1;
    }
    blocs.push({ type: "p", texte: paragraphe.join(" ") });
  }
  return blocs;
}

/** Un paragraphe « **Titre.** suite » ouvre un visuel : titre en h4, suite en paragraphe. */
function titreDeVisuel(texte: string): { titre: string; suite: string } | null {
  const gras = /^\*\*([^*]+)\*\*\s*(.*)$/.exec(texte);
  if (!gras) return null;
  const titre = (gras[1] ?? "").replace(/[.:]\s*$/, "");
  return { titre, suite: gras[2] ?? "" };
}

function rendreListe(bloc: Extract<Bloc, { type: "liste" }>): string {
  if (bloc.ordonnee) return `<ol>${bloc.items.map((item) => `<li>${enLigne(item)}</li>`).join("")}</ol>`;
  const definitions = bloc.items.map((item) => {
    const label = LABELS_DEFINITION.find((l) => item.startsWith(`${l} :`));
    return label ? { label, texte: item.slice(label.length + 2).trim() } : null;
  });
  if (definitions.every((d) => d !== null)) {
    return `<dl class="lecture">${definitions
      .map((d) => `<div><dt>${echapper(d.label)}</dt><dd>${enLigne(d.texte)}</dd></div>`)
      .join("")}</dl>`;
  }
  return `<ul>${bloc.items.map((item) => `<li>${enLigne(item)}</li>`).join("")}</ul>`;
}

function rendreTableau(bloc: Extract<Bloc, { type: "tableau" }>): string {
  const entetes = bloc.entetes.map((e) => `<th scope="col">${enLigne(e)}</th>`).join("");
  const lignes = bloc.lignes.map((l) => `<tr>${l.map((c) => `<td>${enLigne(c)}</td>`).join("")}</tr>`).join("");
  return `<div class="tableau"><table><thead><tr>${entetes}</tr></thead><tbody>${lignes}</tbody></table></div>`;
}

/** Les figures ; la légende est omise quand le visuel qui suit porte déjà ce titre. */
function rendreImages(bloc: Extract<Bloc, { type: "images" }>, titreSuivant: string | null): string {
  const figures = bloc.images
    .map(({ alt, src }) => {
      const classes = [src.includes("/mobile-") ? "tel" : "", /page entière/i.test(alt) ? "entiere" : ""]
        .filter(Boolean)
        .join(" ");
      const redondante = titreSuivant !== null && alt.toLocaleLowerCase("fr") === titreSuivant.toLocaleLowerCase("fr");
      const legende = redondante ? "" : `<figcaption>${enLigne(alt)}</figcaption>`;
      return `<figure class="${classes}"><img src="${echapper(src)}" alt="${echapper(alt)}">${legende}</figure>`;
    })
    .join("");
  const groupe = bloc.images.length > 1 ? (bloc.images.every((i) => i.src.includes("/mobile-")) ? "figures tels" : "figures") : "figure-seule";
  return `<div class="${groupe}">${figures}</div>`;
}

type EntreeSommaire = { numero: string; texte: string; sous: { numero: string; texte: string }[] };

function rendreSommaire(blocs: Bloc[]): string {
  const sections: EntreeSommaire[] = [];
  for (const bloc of blocs) {
    if (bloc.type === "h2") sections.push({ numero: bloc.numero, texte: bloc.texte, sous: [] });
    else if (bloc.type === "h3") sections.at(-1)?.sous.push({ numero: bloc.numero, texte: bloc.texte });
  }
  const lien = (e: { numero: string; texte: string }) =>
    `<a href="#${ancre(e.numero)}"><span class="num">${e.numero}</span>${enLigne(e.texte)}</a>`;
  const entree = (s: EntreeSommaire) => `<li>${lien(s)}${s.sous.length ? `<ol>${s.sous.map((x) => `<li>${lien(x)}</li>`).join("")}</ol>` : ""}</li>`;
  // Deux colonnes explicites (sections 1 à 4, puis 5 à 9) : équilibrées à l'écran et paginables à l'impression.
  const coupure = Math.min(4, sections.length);
  const gauche = sections.slice(0, coupure).map(entree).join("");
  const droite = sections.slice(coupure).map(entree).join("");
  return `<nav class="sommaire" aria-label="Sommaire"><h2>Sommaire</h2><div class="colonnes"><ol>${gauche}</ol><ol start="${coupure + 1}">${droite}</ol></div></nav>`;
}

function rendreCorps(blocs: Bloc[]): { couverture: string; corps: string } {
  const introduction: string[] = [];
  const corps: string[] = [];
  let sectionOuverte = false;
  let visuelOuvert = false;
  const fermerVisuel = () => {
    if (visuelOuvert) corps.push("</div>");
    visuelOuvert = false;
  };
  blocs.forEach((bloc, index) => {
    if (!sectionOuverte && bloc.type !== "h2") {
      if (bloc.type === "p" && !bloc.texte.startsWith("Sommaire")) introduction.push(`<p>${enLigne(bloc.texte)}</p>`);
      return;
    }
    switch (bloc.type) {
      case "h2":
        fermerVisuel();
        if (sectionOuverte) corps.push("</section>");
        sectionOuverte = true;
        corps.push(`<section id="${ancre(bloc.numero)}"><h2><span class="num">${bloc.numero}</span>${enLigne(bloc.texte)}</h2>`);
        break;
      case "h3":
        fermerVisuel();
        corps.push(`<h3 id="${ancre(bloc.numero)}"><span class="num">${bloc.numero}</span>${enLigne(bloc.texte)}</h3>`);
        break;
      case "p": {
        const visuel = titreDeVisuel(bloc.texte);
        if (visuel) {
          fermerVisuel();
          visuelOuvert = true;
          corps.push(`<div class="visuel"><h4>${enLigne(visuel.titre)}</h4>${visuel.suite ? `<p>${enLigne(visuel.suite)}</p>` : ""}`);
        } else {
          fermerVisuel();
          corps.push(`<p>${enLigne(bloc.texte)}</p>`);
        }
        break;
      }
      case "legende":
        fermerVisuel();
        corps.push(`<p class="legende">${enLigne(bloc.texte)}</p>`);
        break;
      case "images": {
        fermerVisuel();
        const suivant = blocs[index + 1];
        const titreSuivant = suivant?.type === "p" ? (titreDeVisuel(suivant.texte)?.titre ?? null) : null;
        corps.push(rendreImages(bloc, titreSuivant));
        break;
      }
      case "liste":
        corps.push(rendreListe(bloc));
        break;
      case "tableau":
        fermerVisuel();
        corps.push(rendreTableau(bloc));
        break;
      case "h1":
        break;
    }
  });
  fermerVisuel();
  if (sectionOuverte) corps.push("</section>");
  return { couverture: introduction.join(""), corps: corps.join("\n") };
}

const STYLE = `
:root {
  --fond: #f7f8fb; --surface: #ffffff; --surface-2: #f1f3f8; --bordure: rgba(15, 23, 42, 0.08);
  --texte: #0f172a; --texte-2: #475569; --texte-3: #5b677d;
  --ambre: #a67c00; --ambre-doux: rgba(166, 124, 0, 0.10); --menthe: #127a70; --succes: #157a55; --alerte: #c42d47;
  --nuit: #0b0f17; --ombre: 0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 10px rgba(15, 23, 42, 0.06);
  --titre: #14306b; --marque-bleu: #1e5fcf; --marque-menthe: #12b5a5;
  --serif: "Instrument Serif", Georgia, "Times New Roman", serif;
  --sans: "Instrument Sans", "Helvetica Neue", Arial, sans-serif;
  --mono: "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --fond: #0b0f17; --surface: #111827; --surface-2: #161f2e; --bordure: rgba(255, 255, 255, 0.08);
    --texte: #e6eaf2; --texte-2: #9aa4b8; --texte-3: #808a9d;
    --ambre: #f5b700; --ambre-doux: rgba(245, 183, 0, 0.12); --menthe: #2dd4bf; --succes: #34d399; --alerte: #fb7185; --ombre: none;
    --titre: #e6eaf2; --marque-bleu: #7fb0ff; --marque-menthe: #2ee0c9;
  }
}
:root[data-theme="dark"] {
  --fond: #0b0f17; --surface: #111827; --surface-2: #161f2e; --bordure: rgba(255, 255, 255, 0.08);
  --texte: #e6eaf2; --texte-2: #9aa4b8; --texte-3: #808a9d;
  --ambre: #f5b700; --ambre-doux: rgba(245, 183, 0, 0.12); --menthe: #2dd4bf; --succes: #34d399; --alerte: #fb7185; --ombre: none;
  --titre: #e6eaf2; --marque-bleu: #7fb0ff; --marque-menthe: #2ee0c9;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
body {
  margin: 0; background: var(--fond); color: var(--texte); font-family: var(--sans); font-size: 16px; line-height: 1.55;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.page { max-width: 1080px; margin: 0 auto; padding-block: 32px 80px; padding-inline: 24px; }
a { color: inherit; text-decoration-color: var(--marque-bleu); text-underline-offset: 3px; }
a:hover { color: var(--marque-bleu); }
:focus-visible { outline: 2px solid var(--marque-bleu); outline-offset: 3px; border-radius: 4px; }
code { font-family: var(--mono); font-size: 0.86em; background: var(--surface-2); border: 1px solid var(--bordure); border-radius: 6px; padding: 1px 5px; white-space: nowrap; }
strong { font-weight: 600; }
.num { font-family: var(--mono); font-weight: 500; color: var(--marque-bleu); font-variant-numeric: tabular-nums; margin-right: 0.6em; font-size: 0.8em; letter-spacing: 0.02em; }

/* Couverture */
.couverture { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px 52px; align-items: end; padding-block: 20px 52px; border-bottom: 1px solid var(--bordure); }
.couverture .logo { display: block; width: 132px; height: auto; margin: 0 0 20px; }
.couverture .sur-titre { font-family: var(--mono); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--texte-3); margin: 0 0 12px; }
.couverture h1 { font-family: var(--serif); font-weight: 400; font-size: clamp(56px, 9vw, 104px); line-height: 0.95; letter-spacing: -0.01em; margin: 0 0 20px; color: var(--titre); text-wrap: balance; }
.couverture h1 .point { color: var(--marque-menthe); font-size: 1.12em; line-height: 0; }
.couverture .objet { font-family: var(--serif); font-size: clamp(22px, 2.6vw, 30px); line-height: 1.25; margin: 0 0 20px; color: var(--texte); text-wrap: balance; }
.couverture .adresse { font-family: var(--mono); font-size: 15px; margin: 0; }
.couverture .adresse a { text-decoration: none; border-bottom: 1px solid var(--marque-menthe); }
.couverture .intro p { margin: 0 0 12px; color: var(--texte-2); }
.couverture .intro p:last-child { margin-bottom: 0; }
.mention { font-size: 13px; color: var(--texte-3); margin: 0; border-left: 2px solid var(--marque-menthe); padding-left: 12px; }

/* En bref */
.en-bref { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 32px 0 0; padding: 0; list-style: none; }
.en-bref li { background: var(--surface); border: 1px solid var(--bordure); border-radius: 14px; padding: 14px 16px 12px; box-shadow: var(--ombre); }
.en-bref .valeur { display: block; font-family: var(--mono); color: var(--titre); font-size: 26px; font-weight: 500; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; line-height: 1.1; }
.en-bref .valeur small { font-size: 15px; color: var(--texte-2); font-weight: 400; }
.en-bref .libelle { display: block; margin-top: 6px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--texte-3); }

/* Sommaire */
.sommaire { margin: 40px 0 12px; padding: 24px 24px 20px; background: var(--surface); border: 1px solid var(--bordure); border-radius: 14px; box-shadow: var(--ombre); }
.sommaire h2 { font-family: var(--mono); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--texte-3); font-weight: 500; margin: 0 0 14px; }
.sommaire ol { list-style: none; margin: 0; padding: 0; }
.sommaire .colonnes { display: grid; grid-template-columns: 1fr 1fr; gap: 0 40px; align-items: start; }
.sommaire .colonnes > ol > li { margin-bottom: 10px; }
.sommaire .colonnes > ol > li > a { font-family: var(--serif); font-size: 20px; text-decoration: none; }
.sommaire ol ol { margin: 4px 0 0 1.6em; }
.sommaire ol ol li { font-size: 14px; color: var(--texte-2); line-height: 1.5; }
.sommaire ol ol a { text-decoration: none; }
.sommaire ol ol .num { font-size: 11px; }

/* Sections */
section { padding-block: 52px 12px; border-top: 1px solid var(--bordure); margin-top: 32px; }
section:first-of-type { border-top: 0; margin-top: 8px; }
section > * { max-width: 760px; }
section > .figures, section > .figure-seule, section > .tableau { max-width: none; }
h2 { font-family: var(--serif); font-weight: 400; font-size: clamp(34px, 4.4vw, 46px); line-height: 1.05; margin: 0 0 24px; letter-spacing: -0.01em; color: var(--titre); text-wrap: balance; }
h2 .num { font-size: 0.5em; vertical-align: 0.5em; }
h3 { font-family: var(--serif); font-weight: 400; font-size: 27px; line-height: 1.15; margin: 44px 0 14px; color: var(--titre); text-wrap: balance; }
h3 .num { font-size: 0.55em; vertical-align: 0.45em; }
h4 { font-family: var(--sans); font-weight: 600; font-size: 17px; margin: 0 0 6px; }
p { margin: 0 0 14px; }
p.legende { color: var(--texte-3); font-size: 14px; margin-top: -4px; }
ul, ol { margin: 0 0 14px; padding-left: 1.3em; }
li { margin-bottom: 5px; }
li::marker { color: var(--marque-menthe); }

.visuel { background: var(--surface); border: 1px solid var(--bordure); border-radius: 14px; padding: 18px 20px 8px; margin: 12px 0 28px; box-shadow: var(--ombre); }
.visuel > p:first-of-type { color: var(--texte-2); }
.visuel ul { margin-bottom: 10px; }
.lecture { margin: 8px 0 12px; display: grid; gap: 10px; }
.lecture div { display: grid; grid-template-columns: 138px minmax(0, 1fr); gap: 12px; align-items: start; }
.lecture dt { font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--marque-bleu); padding-top: 4px; }
.lecture dd { margin: 0; }

/* Figures */
.figure-seule, .figures { margin: 20px 0 22px; }
.figures { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); align-items: start; }
.figures.tels { grid-template-columns: repeat(auto-fit, minmax(200px, 300px)); }
figure { margin: 0; width: fit-content; max-width: 100%; background: var(--nuit); border: 1px solid var(--bordure); border-radius: 14px; overflow: hidden; }
figure img { display: block; width: auto; height: auto; max-width: 100%; }
figure.tel { max-width: 320px; }
figcaption { font-size: 13px; color: var(--texte-2); background: var(--surface); border-top: 1px solid var(--bordure); padding: 8px 12px; }

/* Tableaux */
.tableau { overflow-x: auto; margin: 12px 0 24px; border: 1px solid var(--bordure); border-radius: 14px; background: var(--surface); box-shadow: var(--ombre); }
table { border-collapse: collapse; width: 100%; font-size: 14.5px; }
th { font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500; color: var(--texte-3); text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--bordure); background: var(--surface-2); }
td { padding: 10px 14px; border-bottom: 1px solid var(--bordure); vertical-align: top; }
tr:last-child td { border-bottom: 0; }
td:first-child { font-weight: 600; white-space: nowrap; }

/* Pied */
.pied { margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--bordure); color: var(--texte-3); font-size: 13px; display: grid; gap: 8px; }
.pied p { margin: 0; }

@media (max-width: 760px) {
  .page { padding-inline: 16px; padding-block: 20px 56px; }
  .couverture { grid-template-columns: 1fr; gap: 20px; }
  .sommaire .colonnes { grid-template-columns: 1fr; }
  .lecture div { grid-template-columns: 1fr; gap: 2px; }
  td:first-child { white-space: normal; }
  figure.tel { max-width: none; }
  code { white-space: normal; overflow-wrap: anywhere; }
}

@media print {
  :root, :root:not([data-theme="light"]), :root[data-theme="dark"] {
    --fond: #ffffff; --surface: #ffffff; --surface-2: #f1f3f8; --bordure: rgba(15, 23, 42, 0.14);
    --texte: #0f172a; --texte-2: #475569; --texte-3: #5b677d; --ambre: #a67c00; --ambre-doux: rgba(166, 124, 0, 0.10); --ombre: none;
    --titre: #14306b; --marque-bleu: #1e5fcf; --marque-menthe: #12b5a5;
  }
  body { font-size: 10.5pt; line-height: 1.45; }
  .page { max-width: none; padding: 0; }
  a { text-decoration: none; }
  .couverture { padding-block: 10mm 16mm; min-height: 0; grid-template-columns: 1fr; gap: 12mm; border-bottom: 0; }
  .couverture .logo { width: 42mm; margin-bottom: 8mm; }
  .couverture h1 { font-size: 64pt; }
  .couverture .objet { font-size: 18pt; }
  .en-bref { margin-top: 10mm; break-after: page; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .sommaire { box-shadow: none; margin-top: 0; }
  .sommaire { padding: 6mm 7mm 4mm; }
  .sommaire .colonnes { grid-template-columns: 1fr 1fr; gap: 0 8mm; }
  .sommaire .colonnes > ol > li { margin-bottom: 5px; }
  .sommaire .colonnes > ol > li > a { font-size: 12pt; }
  .sommaire ol ol { margin-top: 2px; }
  .sommaire ol ol li { font-size: 8pt; line-height: 1.35; }
  .lecture div { grid-template-columns: 120px minmax(0, 1fr); gap: 8px; }
  section { break-before: page; border-top: 0; margin-top: 0; padding-top: 0; }
  section > * { max-width: none; }
  h2 { font-size: 28pt; }
  h3 { font-size: 17pt; margin-top: 9mm; break-after: avoid; }
  h4 { break-after: avoid; }
  .visuel, figure, .tableau, .en-bref li, tr { break-inside: avoid; }
  .figures { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .figures.tels { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  figure.entiere img { max-height: 215mm; width: auto; margin: 0 auto; }
  figure.tel img { max-height: 150mm; }
  figure img { max-height: 235mm; }
  code { white-space: normal; }
}
`;

function assembler(blocs: Bloc[]): string {
  const { couverture, corps } = rendreCorps(blocs);
  const sommaire = rendreSommaire(blocs);
  return `<title>Buta.Lyfh</title>
<meta name="description" content="Fiche de présentation illustrée de Buta.Lyfh : contexte, vocabulaire, données, lecture de chaque écran et notice d'utilisation, avec les captures du site.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>${STYLE}</style>
<main class="page">
<header class="couverture">
  <div>
    <img class="logo" src="logo/monogramme.png" alt="Monogramme Buta.Lyfh" width="512" height="449">
    <p class="sur-titre">Fiche de présentation illustrée</p>
    <h1>Buta<span class="point">.</span>Lyfh</h1>
    <p class="objet">Le cockpit d'un Responsable Performance, du lead à l'encaissement, sur un réseau d'installateurs simulé posé sur le marché réel.</p>
    <p class="adresse"><a href="https://buta.lyfh.fr">buta.lyfh.fr</a></p>
  </div>
  <div class="intro">
    ${couverture}
    <p class="mention">Démonstrateur personnel de Frédéric Poissonnier, à l'appui d'une candidature. Sans lien avec Butagaz. Données de marché publiques, données d'activité simulées.</p>
  </div>
</header>
<ul class="en-bref" aria-label="En bref">
  <li><span class="valeur">11</span><span class="libelle">écrans</span></li>
  <li><span class="valeur">21</span><span class="libelle">vues de calcul SQL</span></li>
  <li><span class="valeur">72 261</span><span class="libelle">dossiers simulés</span></li>
  <li><span class="valeur">96</span><span class="libelle">départements de marché réel</span></li>
  <li><span class="valeur">12</span><span class="libelle">contrôles chaque matin</span></li>
  <li><span class="valeur">7</span><span class="libelle">histoires plantées</span></li>
</ul>
${sommaire}
${corps}
<footer class="pied">
  <p>Démonstrateur personnel de Frédéric Poissonnier, à l'appui d'une candidature. Sans lien avec Butagaz. Données de marché publiques, données d'activité simulées.</p>
  <p>Fiche générée depuis le guide illustré du dépôt (docs/GUIDE_ILLUSTRE.md) ; captures du site en ligne, prises le 18 septembre 2026 au soir (journée publiée du 17 septembre), écran Analyste le 19 septembre.</p>
</footer>
</main>
`;
}

async function exporterPdf(): Promise<void> {
  const { chromium } = await import("playwright");
  const navigateur = await chromium.launch();
  try {
    const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(pathToFileURL(SORTIE_HTML).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });
    const logo = `data:image/png;base64,${readFileSync(LOGO_PETIT).toString("base64")}`;
    await page.pdf({
      path: SORTIE_PDF,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "18mm", bottom: "16mm", left: "14mm", right: "14mm" },
      displayHeaderFooter: true,
      headerTemplate:
        '<div style="font-family: Helvetica, Arial, sans-serif; font-size: 8px; color: #5b677d; width: 100%; padding: 4mm 14mm 0; display: flex; align-items: center; gap: 6px;">' +
        `<img src="${logo}" style="width: 14px; height: auto;" alt="">` +
        "<span>Buta.Lyfh · fiche de présentation illustrée</span></div>",
      footerTemplate:
        '<div style="font-family: Helvetica, Arial, sans-serif; font-size: 8px; color: #5b677d; width: 100%; padding: 0 14mm; display: flex; justify-content: space-between;">' +
        "<span>Démonstrateur personnel de Frédéric Poissonnier · sans lien avec Butagaz · données d'activité simulées</span>" +
        '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    });
  } finally {
    await navigateur.close();
  }
}

async function principal(): Promise<void> {
  mkdirSync(join(RACINE, "docs", "logo"), { recursive: true });
  cpSync(LOGO_SOURCE, LOGO_DOCS);
  const markdown = readFileSync(SOURCE, "utf8");
  const blocs = decouper(markdown);
  const html = assembler(blocs);
  writeFileSync(SORTIE_HTML, html, "utf8");
  const images = blocs.filter((b) => b.type === "images").reduce((n, b) => n + (b.type === "images" ? b.images.length : 0), 0);
  console.log(`docs/FICHE.html écrit : ${blocs.length} blocs, ${images} captures référencées.`);
  if (process.argv.includes("--pdf")) {
    await exporterPdf();
    console.log("docs/FICHE.pdf écrit.");
  }
}

principal().catch((erreur: unknown) => {
  console.error(erreur);
  process.exit(1);
});
