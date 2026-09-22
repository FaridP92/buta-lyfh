/**
 * Présentation par écran (lot 6) : un document A4 pour des interlocuteurs de métiers différents, pas
 * forcément du pilotage (direction des ressources humaines, régionale, commerciale, financière). Pour chacun
 * des onze écrans : ce qu'il permet de décider, ce qu'on y trouve, d'où viennent les données, ce qu'il vise,
 * et ce qu'y lit chaque direction. Le texte vient de `src/lib/guideEcrans.ts` (le même que le panneau
 * « Comprendre cet écran » de l'application) et le glossaire de `src/lib/indicateurs.ts` : aucun chiffre
 * n'est écrit ici, les captures (docs/captures/presentation/, `npm run captures:presentation`) portent la
 * journée publiée du jour de la capture.
 * Écrit docs/PRESENTATION.html puis docs/PRESENTATION.pdf (Playwright). `npm run presentation`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { GUIDES_ECRANS, PROFILS } from "../src/lib/guideEcrans";
import { INDICATEURS } from "../src/lib/indicateurs";
import { AUTEUR, coordonneesHtml } from "./lib/auteur";

const RACINE = process.cwd();
const SORTIE_HTML = join(RACINE, "docs", "PRESENTATION.html");
const SORTIE_PDF = join(RACINE, "docs", "PRESENTATION.pdf");
const META_CAPTURES = join(RACINE, "docs", "captures", "presentation", "_meta.json");
const ADRESSE = "https://buta.lyfh.fr";

function slugEcran(chemin: string): string {
  return chemin === "/" ? "vue-ensemble" : chemin.replace(/^\//, "");
}

function echapper(texte: string): string {
  return texte.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function dateLongue(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(iso));
}

interface MetaCaptures {
  capture_le: string;
  badge: string | null;
}

function lireMeta(): MetaCaptures {
  if (!existsSync(META_CAPTURES)) return { capture_le: new Date().toISOString(), badge: null };
  return JSON.parse(readFileSync(META_CAPTURES, "utf-8")) as MetaCaptures;
}

const STYLE = `
:root {
  --papier: #ffffff; --encre: #0f172a; --encre-2: #475569; --encre-3: #64748b; --filet: #d9dee8; --fond-doux: #f4f6fa;
  --titre: #14306b; --bleu: #1e5fcf; --menthe: #12b5a5; --menthe-pale: #e3f7f4;
  --serif: "Instrument Serif", Georgia, "Times New Roman", serif;
  --sans: "Instrument Sans", "Helvetica Neue", Arial, sans-serif;
  --mono: "JetBrains Mono", Menlo, Consolas, monospace;
}
@page { size: A4; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--papier); color: var(--encre); font-family: var(--sans); font-size: 9.2pt; line-height: 1.38; }
a { color: inherit; text-decoration: none; }
p { margin: 0 0 2mm; }
ul { margin: 0; padding-left: 0; list-style: none; }
h1, h2, h3, h4 { margin: 0; font-weight: 400; }
.sur-titre { font-family: var(--mono); font-size: 7.4pt; letter-spacing: 0.08em; text-transform: uppercase; color: var(--encre-3); margin: 0 0 1.5mm; }
.marque { font-family: "Montserrat", var(--sans); font-weight: 800; text-transform: uppercase; color: var(--titre); letter-spacing: 0.01em; }
.marque .point { color: var(--menthe); }
.mention { color: var(--encre-3); border-left: 1.2pt solid var(--menthe); padding-left: 2.5mm; font-size: 8.4pt; }
.mention strong { color: var(--encre-2); font-weight: 600; }
.puces li { position: relative; padding-left: 4mm; margin-bottom: 1.1mm; }
.puces li::before { content: ""; position: absolute; left: 0.6mm; top: 2.1mm; width: 1.4mm; height: 1.4mm; border-radius: 50%; background: var(--menthe); }
figure { margin: 0; }
figure img { display: block; width: 100%; height: auto; border: 0.4pt solid var(--filet); border-radius: 1.5mm; }
figcaption { font-size: 7.8pt; color: var(--encre-3); margin-top: 1.2mm; }
section { break-after: page; }
section:last-of-type { break-after: auto; }

/* Couverture */
.couverture { min-height: 250mm; display: flex; flex-direction: column; }
.couverture header { display: grid; grid-template-columns: 30mm 1fr; gap: 8mm; align-items: center; margin-top: 18mm; }
.couverture header img { width: 30mm; height: auto; display: block; }
.couverture h1 { font-size: 34pt; line-height: 1; }
.couverture .objet { font-family: var(--serif); font-size: 19pt; line-height: 1.2; margin: 10mm 0 4mm; max-width: 150mm; }
.couverture .pitch { color: var(--encre-2); font-size: 10.5pt; max-width: 150mm; }
.profils-couverture { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 10mm; }
.profils-couverture div { border: 0.5pt solid var(--filet); border-radius: 2mm; padding: 3mm 3.5mm; }
.profils-couverture h3 { font-size: 9.6pt; font-weight: 600; color: var(--titre); margin-bottom: 1mm; }
.profils-couverture p { font-size: 8.4pt; color: var(--encre-2); margin: 0; }
.couverture footer { margin-top: auto; border-top: 0.6pt solid var(--encre); padding-top: 3mm; display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; font-size: 8.4pt; }
.nom { font-family: "Montserrat", var(--sans); font-weight: 800; font-size: 10pt; color: var(--titre); margin-bottom: 1mm; }
.coordonnees { font-family: var(--mono); font-size: 8pt; color: var(--encre-2); }
.coordonnees a { border-bottom: 0.4pt solid var(--menthe); }
.adresse { font-family: var(--mono); font-size: 8pt; color: var(--bleu); }

/* Pages de texte */
h2.titre-page { font-family: var(--serif); font-size: 20pt; line-height: 1.1; color: var(--titre); margin-bottom: 4mm; }
h3.rubrique { font-family: var(--mono); font-size: 7.4pt; letter-spacing: 0.08em; text-transform: uppercase; color: var(--encre-3); margin: 3mm 0 1.4mm; padding-bottom: 1mm; border-bottom: 0.4pt solid var(--filet); }
.deux-colonnes { display: grid; grid-template-columns: 1fr 1fr; gap: 7mm; }
.bloc { break-inside: avoid; }
.encadre { background: var(--fond-doux); border-radius: 2mm; padding: 3.5mm 4mm; margin-bottom: 3mm; }
.encadre h3 { font-weight: 600; font-size: 10pt; color: var(--titre); margin-bottom: 1mm; }
table { width: 100%; border-collapse: collapse; font-size: 8.6pt; line-height: 1.35; }
th { text-align: left; font-family: var(--mono); font-weight: 500; font-size: 7pt; letter-spacing: 0.06em; text-transform: uppercase; color: var(--encre-3); padding: 0 2.5mm 1.5mm 0; border-bottom: 0.6pt solid var(--encre); }
td { vertical-align: top; padding: 1.6mm 2.5mm 1.6mm 0; border-bottom: 0.4pt solid var(--filet); }
td.cle { width: 40mm; font-weight: 600; color: var(--titre); }
td.chemin { font-family: var(--mono); font-size: 7.6pt; color: var(--bleu); }
.sommaire { counter-reset: ecran; }
.sommaire li { display: grid; grid-template-columns: 8mm 1fr; gap: 2mm; padding: 1.4mm 0; border-bottom: 0.4pt solid var(--filet); }
.sommaire .num { font-family: var(--mono); color: var(--menthe); font-size: 8.5pt; }
.sommaire .lib { font-weight: 600; }
.sommaire .question { color: var(--encre-3); font-family: var(--serif); font-style: italic; }

/* Fiche d'écran */
.ecran .en-tete { display: grid; grid-template-columns: 14mm 1fr; gap: 3mm; align-items: start; margin-bottom: 3mm; }
.ecran .numero { font-family: var(--mono); font-size: 20pt; color: var(--menthe); line-height: 1; padding-top: 1mm; }
.ecran h2 { font-family: var(--serif); font-size: 22pt; line-height: 1.05; color: var(--titre); }
.ecran .question { font-family: var(--serif); font-style: italic; font-size: 11.5pt; color: var(--encre-2); margin-top: 1mm; }
.ecran .decision { font-size: 10.4pt; color: var(--encre); border-left: 1.4pt solid var(--menthe); padding-left: 3mm; margin: 2.5mm 0 3mm; }
.ecran figure { margin-bottom: 0; }
.ecran .haut { display: grid; grid-template-columns: 102mm 1fr; gap: 5mm; align-items: start; margin-bottom: 2mm; }
.ecran .haut h3.rubrique:first-child { margin-top: 0; }
.ecran .haut .lectures { grid-template-columns: 1fr; gap: 2mm; }
.ecran .contenu { columns: 2; column-gap: 7mm; }
.ecran .contenu li { break-inside: avoid; }
.lectures { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5mm; break-inside: avoid; }
.lectures div { background: var(--menthe-pale); border-radius: 2mm; padding: 2.4mm 3mm; }
.lectures h4 { font-family: var(--mono); font-size: 7pt; letter-spacing: 0.06em; text-transform: uppercase; color: var(--titre); margin-bottom: 1mm; }
.lectures p { margin: 0; font-size: 8.5pt; color: var(--encre); }
.glossaire td.code { font-family: var(--mono); font-size: 7.4pt; color: var(--bleu); width: 22mm; }
.glossaire td.lib { width: 42mm; font-weight: 600; }
.fin .documents li { padding: 1.6mm 0; border-bottom: 0.4pt solid var(--filet); display: grid; grid-template-columns: 1fr auto; gap: 4mm; }
.fin .documents a { font-family: var(--mono); font-size: 8pt; color: var(--bleu); }
`;

function liste(items: readonly string[]): string {
  return `<ul class="puces">${items.map((i) => `<li>${echapper(i)}</li>`).join("")}</ul>`;
}

function libelleEcran(chemin: string): string {
  return GUIDES_ECRANS.find((g) => g.chemin === chemin)?.libelle ?? chemin;
}

function couverture(meta: MetaCaptures): string {
  return `<section class="couverture">
  <header>
    <img src="logo/monogramme.png" alt="Monogramme Buta.Lyfh" width="512" height="449">
    <div>
      <p class="sur-titre">Présentation par écran · pour lecteurs de tous métiers</p>
      <h1 class="marque">Buta<span class="point">.</span>Lyfh</h1>
    </div>
  </header>
  <p class="objet">Onze écrans pour piloter un réseau d'installateurs du lead à l'encaissement : ce que chacun montre, d'où viennent ses données, ce qu'il vise.</p>
  <p class="pitch">Démonstrateur personnel de ${echapper(AUTEUR.nom)}, en ligne sur <a href="${ADRESSE}">${ADRESSE.replace("https://", "")}</a>, construit à l'appui d'une candidature au poste de Responsable Performance. Ce document accompagne la visite : il s'adresse à des interlocuteurs de directions différentes, pas forcément concernés par le pilotage au quotidien, et dit pour chaque écran ce qu'ils peuvent y lire.</p>
  <div class="profils-couverture">
${PROFILS.map((p) => `    <div><h3>${echapper(p.libelle)}</h3><p>${echapper(p.attente)}</p></div>`).join("\n")}
  </div>
  <footer>
    <div>
      <p class="nom">${echapper(AUTEUR.nom)}</p>
      <p class="coordonnees">${coordonneesHtml().replace(`${AUTEUR.nom} · `, "")}</p>
      <p class="adresse"><a href="${ADRESSE}">${ADRESSE}</a></p>
      <p class="coordonnees">Captures du ${dateLongue(meta.capture_le)}${meta.badge ? `, ${echapper(meta.badge.replace(/^Journée/, "journée simulée").replace(/^Instantané/, "instantané"))}` : ""}.</p>
    </div>
    <p class="mention"><strong>Sans lien avec Butagaz : activité simulée, marché réel.</strong> Données de marché publiques (Insee, ADEME, RTE), données d'activité générées par simulation ; aucune agence, personne ou entité réelle n'est associée à une performance simulée. Aucun logo, aucune couleur, aucun chiffre présenté comme celui de l'entreprise.</p>
  </footer>
</section>`;
}

function avantDeLire(): string {
  const parcours = PROFILS.map(
    (p) => `<tr><td class="cle">${echapper(p.libelle)}</td><td>${echapper(p.attente)}</td><td>${p.parcours.map((c) => echapper(libelleEcran(c))).join(", puis ")}</td></tr>`,
  ).join("\n");
  return `<section class="avant">
  <p class="sur-titre">Avant de lire</p>
  <h2 class="titre-page">Ce que c'est, comment lire ce document, par où commencer</h2>
  <div class="deux-colonnes">
    <div>
      <div class="encadre bloc"><h3>Ce que c'est</h3><p>Un cockpit de pilotage d'un réseau d'installateurs (photovoltaïque, pompes à chaleur, chauffe-eau thermodynamiques, poêles, bornes), du lead à l'encaissement : ventes, marge, funnel, forecast, pose et encaissement, plans d'action et rituels, qualité des données, territoires, automatisations, analyste. Construit seul, en quelques jours, documentation écrite avant le code.</p></div>
      <div class="encadre bloc"><h3>Ce que ce n'est pas</h3><p>Ni un outil Butagaz, ni une base de données Butagaz, ni une recommandation d'implantation. Le nom reprend la racine de la marque par choix personnel ; il tient dans une constante et un sous-domaine, un renommage prend dix minutes.</p></div>
      <div class="encadre bloc"><h3>Deux familles de données, toujours distinguées</h3><p><strong>Le marché est réel</strong> et sourcé : Insee (Logement 2022), ADEME (installateurs RGE, base DPE), RTE (registre solaire), contours Etalab. Chaque écran affiche source, licence et date. <strong>L'activité est simulée</strong> : leads, rendez-vous, devis, ventes, poses, encaissements, coûts, objectifs, effectifs, sur neuf agences nommées par bassin géographique. Chaque écran d'activité porte le badge « simulé ».</p></div>
      <div class="encadre bloc"><h3>La règle qui fonde la crédibilité</h3><p>Aucun nombre affiché n'est calculé dans l'interface : tout vient de vues SQL documentées ou d'une bibliothèque testée. Chaque indicateur a une fiche (définition, formule, grain, source) derrière le bouton « i ». Le modèle de langage, quand il intervient, commente des faits calculés en base et ne produit jamais un chiffre.</p></div>
    </div>
    <div>
      <h3 class="rubrique">Comment lire chaque fiche d'écran</h3>
      ${liste([
        "La question : le titre de l'écran, tel qu'il se lit en ligne.",
        "Ce que l'écran permet de décider : une phrase, avant la liste.",
        "Ce qu'on y trouve : bloc par bloc, dans l'ordre de lecture.",
        "D'où viennent les données : réelles ou simulées, avec la source.",
        "Ce que l'écran vise : l'intention, au-delà de l'affichage.",
        "Ce qu'y lit chaque direction : quatre lectures, une par profil.",
      ])}
      <h3 class="rubrique">Le même guide, dans l'application</h3>
      <figure><img src="captures/presentation/guide-ouvert.jpg" alt="Le panneau Comprendre cet écran ouvert sur la Vue d'ensemble"><figcaption>Le bouton « Comprendre cet écran » de la barre haute ouvre ce guide sur n'importe quel écran ; la touche P passe en mode présentation (plein écran, flèches pour changer d'écran).</figcaption></figure>
      <h3 class="rubrique">Conventions communes à tous les écrans</h3>
      ${liste([
        "Barre haute : période (mois, trimestre, année à date), comparaison (objectif ou année précédente), agence, guide de l'écran, recherche (Cmd K), export, présentation, badge de fraîcheur « journée du JJ/MM intégrée à HH:MM ».",
        "Les filtres vivent dans l'adresse de la page : un lien partagé montre la même vue.",
        "Le mois en cours est comparé à l'objectif au prorata des jours publiés ; les taux de conversion ne sont affichés que sur des cohortes closes à quatre-vingt-dix jours.",
        "En bas de chaque écran, la ligne « Sources et hypothèses » : source, licence, date de référence, badge « données d'activité simulées » quand il y a lieu.",
        "Chaque graphique a un menu : plein écran, image, export CSV, requête SQL. Chaque tableau se trie et s'exporte.",
      ])}
    </div>
  </div>
</section>
<section class="sommaire-page">
  <p class="sur-titre">Les onze écrans</p>
  <h2 class="titre-page">Chaque titre dit ce que l'écran permet de décider</h2>
  <div class="deux-colonnes">
    <div>
      <ul class="sommaire">
${GUIDES_ECRANS.map((g, i) => `        <li><span class="num">${String(i + 1).padStart(2, "0")}</span><span><span class="lib">${echapper(g.libelle)}</span><br><span class="question">« ${echapper(g.question)} »</span></span></li>`).join("\n")}
      </ul>
    </div>
    <div>
      <figure><img src="captures/presentation/mobile-vue-ensemble.jpg" alt="La Vue d'ensemble sur téléphone" style="width: 58mm; margin: 0 auto;"><figcaption style="text-align: center;">Sur téléphone, tout se lit sans zoom ; les filtres sont dans le tiroir de navigation.</figcaption></figure>
    </div>
  </div>
  <div class="bloc">
    <h3 class="rubrique">Par où commencer, selon votre direction</h3>
    <table>
      <thead><tr><th>Direction</th><th>Ce que vous y cherchez</th><th>Écrans à ouvrir d'abord</th></tr></thead>
      <tbody>
${parcours}
      </tbody>
    </table>
  </div>
</section>`;
}

function ficheEcran(index: number): string {
  const g = GUIDES_ECRANS[index];
  if (!g) return "";
  const lectures = PROFILS.map((p) => `      <div><h4>${echapper(p.libelle)}</h4><p>${echapper(g.lectures[p.code])}</p></div>`).join("\n");
  return `<section class="ecran">
  <div class="en-tete">
    <span class="numero">${String(index + 1).padStart(2, "0")}</span>
    <div>
      <h2>${echapper(g.libelle)}</h2>
      <p class="question">« ${echapper(g.question)} »</p>
    </div>
  </div>
  <p class="decision">${echapper(g.decision)}</p>
  <div class="haut">
    <figure><img src="captures/presentation/${slugEcran(g.chemin)}.jpg" alt="Capture de l'écran ${echapper(g.libelle)}"><figcaption>${echapper(g.libelle)} en ligne (${ADRESSE.replace("https://", "")}${g.chemin === "/" ? "" : g.chemin}), thème sombre, haut de l'écran.</figcaption></figure>
    <div>
      <h3 class="rubrique">Ce qu'y lit chaque direction</h3>
      <div class="lectures">
${lectures}
      </div>
    </div>
  </div>
  <h3 class="rubrique">Ce qu'on y trouve</h3>
  <div class="contenu">${liste(g.contenu)}</div>
  <div class="deux-colonnes">
    <div>
      <h3 class="rubrique">D'où viennent les données</h3>
      ${liste(g.sources)}
    </div>
    <div>
      <h3 class="rubrique">Ce que l'écran vise</h3>
      ${liste(g.vise)}
    </div>
  </div>
</section>`;
}

function glossaire(): string {
  const lignes = INDICATEURS.map((i) => `<tr><td class="code">${echapper(i.code)}</td><td class="lib">${echapper(i.libelle)}</td><td>${echapper(i.definition)}</td></tr>`).join("\n");
  return `<section class="glossaire">
  <p class="sur-titre">Glossaire</p>
  <h2 class="titre-page">Les indicateurs, tels que l'application les définit</h2>
  <p style="color: var(--encre-2); max-width: 160mm;">Définitions reprises du catalogue de l'application (bouton « i » de chaque indicateur) ; la formule, le grain et la vue SQL de chacun s'y lisent. Sauf mention, les indicateurs portent sur l'activité simulée.</p>
  <table>
    <thead><tr><th>Code</th><th>Indicateur</th><th>Définition</th></tr></thead>
    <tbody>
${lignes}
    </tbody>
  </table>
</section>`;
}

function fin(): string {
  return `<section class="fin">
  <p class="sur-titre">Pour aller plus loin</p>
  <h2 class="titre-page">Ouvrir le cockpit, télécharger les documents, joindre l'auteur</h2>
  <div class="deux-colonnes">
    <div>
      <h3 class="rubrique">Le site</h3>
      <p><a class="adresse" href="${ADRESSE}">${ADRESSE}</a></p>
      <p style="color: var(--encre-2);">Sur ordinateur ou téléphone, sans compte. Le badge de fraîcheur dit quelle journée simulée est publiée ; chaque matin à 06 h 00 un workflow publie la veille. Si la base ne répond pas, l'application bascule sur un instantané et le dit.</p>
      <h3 class="rubrique">Documents</h3>
      <ul class="documents">
        <li><span>Cette présentation par écran</span><a href="${ADRESSE}/presentation.pdf">buta.lyfh.fr/presentation.pdf</a></li>
        <li><span>Fiche de présentation illustrée (guide complet, environ quatre-vingts pages)</span><a href="${ADRESSE}/fiche.pdf">buta.lyfh.fr/fiche.pdf</a></li>
        <li><span>Synthèse d'une page : les cinq attentes du poste face aux écrans</span><a href="${ADRESSE}/synthese.pdf">buta.lyfh.fr/synthese.pdf</a></li>
        <li><span>Curriculum vitae</span><a href="${ADRESSE}/cv-frederic-poissonnier.pdf">buta.lyfh.fr/cv-frederic-poissonnier.pdf</a></li>
        <li><span>Export pour Power BI (tables, modèle en étoile, mesures)</span><a href="${ADRESSE}/methode">page Méthode</a></li>
      </ul>
    </div>
    <div>
      <h3 class="rubrique">Questions fréquentes</h3>
      ${liste([
        "Ce sont vos données ? Non. Le marché est public et sourcé, l'activité est simulée par un générateur dont les hypothèses sont écrites. Rien de ce qui est affiché ne décrit l'activité de l'entreprise.",
        "Et avec des données réelles ? Le modèle de données (dossier avec ses dates, agence, canal, produit, montants) est celui d'un CRM d'installateur ; l'ingestion remplacerait le générateur, les vues et les écrans resteraient.",
        "L'IA calcule quoi ? Rien. Elle commente des faits calculés en SQL qui lui sont transmis ; tout nombre absent des faits fait rejeter la phrase.",
        "Combien ça coûte à faire tourner ? Un serveur mutualisé, une base, un orchestrateur : quelques dizaines d'euros par mois, et un budget IA plafonné et affiché.",
      ])}
      <h3 class="rubrique">L'auteur</h3>
      <p class="nom">${echapper(AUTEUR.nom)}</p>
      <p class="coordonnees">${coordonneesHtml().replace(`${AUTEUR.nom} · `, "")}</p>
      <p class="mention" style="margin-top: 6mm;"><strong>Démonstrateur personnel de ${echapper(AUTEUR.nom)} : activité simulée, marché réel, sans lien avec Butagaz.</strong> Aucune agence, personne ou entité réelle n'est associée à une performance simulée.</p>
    </div>
  </div>
</section>`;
}

function html(meta: MetaCaptures): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Buta.Lyfh, présentation par écran</title>
<meta name="description" content="Les onze écrans de Buta.Lyfh expliqués à des lecteurs de tous métiers : ce que chacun montre, d'où viennent ses données, ce qu'il vise, ce qu'y lit chaque direction.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Montserrat:wght@800&display=swap">
<style>${STYLE}</style>
</head>
<body>
${couverture(meta)}
${avantDeLire()}
${GUIDES_ECRANS.map((_, i) => ficheEcran(i)).join("\n")}
${glossaire()}
${fin()}
</body>
</html>
`;
}

async function principal(): Promise<void> {
  const meta = lireMeta();
  writeFileSync(SORTIE_HTML, html(meta));
  console.log(`docs/PRESENTATION.html écrit : ${GUIDES_ECRANS.length} écrans, ${PROFILS.length} profils, ${INDICATEURS.length} indicateurs au glossaire.`);
  const { chromium } = await import("playwright");
  const navigateur = await chromium.launch();
  try {
    const page = await navigateur.newPage();
    await page.goto(pathToFileURL(SORTIE_HTML).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const pied = `<div style="width: 100%; font-family: 'Instrument Sans', Arial, sans-serif; font-size: 7pt; color: #64748b; padding: 0 14mm; display: flex; justify-content: space-between;"><span>Buta.Lyfh · présentation par écran · démonstrateur personnel, sans lien avec Butagaz</span><span>page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
    await page.pdf({
      path: SORTIE_PDF,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: pied,
      margin: { top: "14mm", right: "14mm", bottom: "16mm", left: "14mm" },
    });
  } finally {
    await navigateur.close();
  }
  console.log("docs/PRESENTATION.pdf écrit (A4).");
}

principal().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});
