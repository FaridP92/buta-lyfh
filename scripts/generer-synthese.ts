/**
 * Synthèse d'une page A4 : les cinq attentes de l'annonce face aux écrans qui y répondent, trois
 * captures, les coordonnées de l'auteur et la mention réglementaire. Écrit docs/SYNTHESE.html
 * puis docs/SYNTHESE.pdf (Playwright, format A4 défini en CSS). `npm run synthese`.
 * Aucun chiffre n'y est calculé : le texte reprend le guide de présentation (docs/GUIDE.md §2).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { AUTEUR, coordonneesHtml } from "./lib/auteur";

const RACINE = process.cwd();
const SORTIE_HTML = join(RACINE, "docs", "SYNTHESE.html");
const SORTIE_PDF = join(RACINE, "docs", "SYNTHESE.pdf");

interface Mission {
  attente: string;
  ecrans: string;
  reponse: string;
}

/** Les cinq attentes de l'annonce, dans l'ordre du guide de présentation (GUIDE.md §2). */
const MISSIONS: readonly Mission[] = [
  {
    attente: "Construire et fiabiliser le pilotage du lead à l'encaissement",
    ecrans: "Vue d'ensemble, Funnel, Qualité",
    reponse: "Un seul flux de données, des définitions écrites (fiche « i » sur chaque indicateur), douze contrôles de cohérence chaque matin, un badge de fraîcheur.",
  },
  {
    attente: "Analyser et éclairer la décision : écarts de CA, marge, conversion, forecast",
    ecrans: "Ventes et marge, Forecast",
    reponse: "Cascade de l'écart (volume, mix, prix, remise), atterrissage en éventail avec probabilité d'atteinte, hypothèses écrites et testables au curseur.",
  },
  {
    attente: "Transformer l'analyse en plans d'action : leads, mix, panier, remises, annulations, coûts d'acquisition, délais",
    ecrans: "Funnel, Ventes et marge, Forecast, Plans d'action",
    reponse: "Chaque anomalie est nommée, chiffrée, datée ; douze plans avec propriétaire, gain attendu, échéance et indicateur suivi.",
  },
  {
    attente: "Professionnaliser les rituels : revues de performance, de pipe, de marge, de forecast",
    ecrans: "Plans d'action et rituels, Vue d'ensemble, alertes du matin",
    reponse: "Quatre rituels avec ordre du jour et indicateurs ; revue hebdomadaire rédigée chaque lundi à partir des faits SQL, chaque nombre vérifié.",
  },
  {
    attente: "Faire évoluer outils, référentiels, BI, automatisation",
    ecrans: "Qualité, Automatisations, Méthode, Analyste",
    reponse: "Réconciliation des libellés d'une agence intégrée, export Power BI en modèle en étoile avec mesures DAX, workflows n8n et leur journal, analyste qui répond en SQL contrôlé.",
  },
];

/** Trois captures du guide (docs/captures/guide/), avec leur légende. */
const CAPTURES = [
  { fichier: "captures/guide/accueil-00-compteurs.png", legende: "Vue d'ensemble : les quatre compteurs du mois contre l'objectif au prorata", large: true },
  { fichier: "captures/guide/ventes-01-cascade-de-l-ecart-de-ca.png", legende: "Ventes et marge : la cascade de l'écart de CA", large: false },
  { fichier: "captures/guide/forecast-01-eventail-d-atterrissage-2026.png", legende: "Forecast : l'éventail d'atterrissage 2026", large: false },
] as const;

const STYLE = `
:root {
  --papier: #ffffff; --encre: #0f172a; --encre-2: #475569; --encre-3: #64748b; --filet: #d9dee8; --fond-doux: #f4f6fa;
  --titre: #14306b; --bleu: #1e5fcf; --menthe: #12b5a5;
  --serif: "Instrument Serif", Georgia, "Times New Roman", serif;
  --sans: "Instrument Sans", "Helvetica Neue", Arial, sans-serif;
  --mono: "JetBrains Mono", Menlo, Consolas, monospace;
}
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #e9ecf2; color: var(--encre); font-family: var(--sans); font-size: 9.5pt; line-height: 1.4; }
a { color: inherit; text-decoration: none; }
.page { width: 210mm; height: 297mm; margin: 0 auto; padding: 12mm 14mm 10mm; background: var(--papier); overflow: hidden; display: flex; flex-direction: column; gap: 4mm; position: relative; }
.page::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 5mm; background: linear-gradient(180deg, var(--titre), var(--bleu) 55%, var(--menthe)); }
@media screen { body { padding: 12mm 0; } .page { box-shadow: 0 4px 24px rgba(15, 23, 42, 0.16); } }
@media print { html, body { background: var(--papier); } .page { box-shadow: none; margin: 0; } }
header { display: grid; grid-template-columns: 22mm 1fr; gap: 6mm; align-items: center; }
header img { width: 22mm; height: auto; display: block; }
.sur-titre { font-family: var(--mono); font-size: 7.5pt; letter-spacing: 0.08em; text-transform: uppercase; color: var(--encre-3); margin: 0 0 1.5mm; }
h1 { font-family: "Montserrat", var(--sans); font-weight: 800; text-transform: uppercase; font-size: 24pt; line-height: 1; letter-spacing: 0.01em; margin: 0 0 2mm; color: var(--titre); }
h1 .point { color: var(--menthe); }
.objet { font-family: var(--serif); font-size: 13pt; line-height: 1.25; margin: 0; color: var(--encre); }
.pitch { margin: 0; color: var(--encre-2); font-size: 9.5pt; max-width: 175mm; }
h2 { font-family: var(--serif); font-weight: 400; font-size: 13pt; margin: 0 0 2mm; color: var(--titre); }
table { width: 100%; border-collapse: collapse; font-size: 8.6pt; line-height: 1.35; }
th { text-align: left; font-family: var(--mono); font-weight: 500; font-size: 7pt; letter-spacing: 0.06em; text-transform: uppercase; color: var(--encre-3); padding: 0 2.5mm 1.5mm 0; border-bottom: 0.6pt solid var(--encre); }
td { vertical-align: top; padding: 1.5mm 2.5mm 1.5mm 0; border-bottom: 0.4pt solid var(--filet); }
td.attente { width: 52mm; font-weight: 600; color: var(--encre); }
td.ecrans { width: 42mm; color: var(--bleu); font-family: var(--mono); font-size: 7.8pt; }
td.reponse { color: var(--encre-2); }
figure { margin: 0; }
figure img { display: block; width: 100%; height: auto; border: 0.4pt solid var(--filet); border-radius: 1.5mm; }
figure.large img { height: auto; }
.deux { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
.deux figure img { height: 46mm; object-fit: cover; object-position: left top; }
figcaption { font-size: 7.8pt; color: var(--encre-3); margin-top: 1.2mm; }
.pied { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; border-top: 0.6pt solid var(--encre); padding-top: 3mm; font-size: 8.4pt; }
.pied p { margin: 0 0 1.2mm; }
.pied .nom { font-family: "Montserrat", var(--sans); font-weight: 800; font-size: 10pt; color: var(--titre); }
.pied .coordonnees { font-family: var(--mono); font-size: 8pt; color: var(--encre-2); }
.pied .coordonnees a { border-bottom: 0.4pt solid var(--menthe); }
.pied .adresse { font-family: var(--mono); font-size: 8pt; color: var(--bleu); }
.mention { color: var(--encre-3); border-left: 1.2pt solid var(--menthe); padding-left: 2.5mm; }
.mention strong { color: var(--encre-2); font-weight: 600; }
`;

function echapper(texte: string): string {
  return texte.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function html(): string {
  const lignes = MISSIONS.map(
    (m) => `<tr><td class="attente">${echapper(m.attente)}</td><td class="ecrans">${echapper(m.ecrans)}</td><td class="reponse">${echapper(m.reponse)}</td></tr>`,
  ).join("\n");
  const [banniere, ...paire] = CAPTURES;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Buta.Lyfh, synthèse</title>
<meta name="description" content="Synthèse d'une page de Buta.Lyfh : les cinq attentes du poste de Responsable Performance face aux écrans qui y répondent.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Montserrat:wght@800&display=swap">
<style>${STYLE}</style>
</head>
<body>
<main class="page">
  <header>
    <img src="logo/monogramme.png" alt="Monogramme Buta.Lyfh" width="512" height="449">
    <div>
      <p class="sur-titre">Synthèse d'une page · candidature Responsable Performance</p>
      <h1>Buta<span class="point">.</span>Lyfh</h1>
      <p class="objet">Le cockpit d'un Responsable Performance, du lead à l'encaissement, sur un réseau d'installateurs simulé posé sur le marché réel.</p>
    </div>
  </header>
  <p class="pitch">Onze écrans en ligne sur https://buta.lyfh.fr : ventes et marge, funnel, forecast, pose et encaissement, plans d'action et rituels, qualité des données, territoires, automatisations, analyste. Chaque chiffre vient d'une vue SQL documentée, chaque écran affiche ses sources ; les cinq attentes de l'annonce se retrouvent écran par écran.</p>
  <section>
    <h2>Ce que demande l'annonce, et où on le voit</h2>
    <table>
      <thead><tr><th>Attente du poste</th><th>Écrans</th><th>Ce que l'écran montre</th></tr></thead>
      <tbody>
${lignes}
      </tbody>
    </table>
  </section>
  <figure class="large">
    <img src="${banniere.fichier}" alt="${echapper(banniere.legende)}">
    <figcaption>${echapper(banniere.legende)}</figcaption>
  </figure>
  <div class="deux">
${paire.map((c) => `    <figure><img src="${c.fichier}" alt="${echapper(c.legende)}"><figcaption>${echapper(c.legende)}</figcaption></figure>`).join("\n")}
  </div>
  <footer class="pied">
    <div>
      <p class="nom">${echapper(AUTEUR.nom)}</p>
      <p class="coordonnees">${coordonneesHtml().replace(`${AUTEUR.nom} · `, "")}</p>
      <p class="adresse"><a href="https://buta.lyfh.fr">https://buta.lyfh.fr</a> · fiche complète : <a href="https://buta.lyfh.fr/fiche.pdf">buta.lyfh.fr/fiche.pdf</a></p>
    </div>
    <p class="mention"><strong>Démonstrateur personnel de ${echapper(AUTEUR.nom)} : activité simulée, marché réel, sans lien avec Butagaz.</strong> Données de marché publiques (Insee, ADEME, RTE), données d'activité générées par simulation ; aucune agence, personne ou entité réelle n'est associée à une performance simulée. Captures du site en ligne, journée publiée du 18 septembre 2026.</p>
  </footer>
</main>
</body>
</html>
`;
}

async function principal(): Promise<void> {
  writeFileSync(SORTIE_HTML, html());
  console.log(`docs/SYNTHESE.html écrit : ${MISSIONS.length} missions, ${CAPTURES.length} captures.`);
  const { chromium } = await import("playwright");
  const navigateur = await chromium.launch();
  try {
    const page = await navigateur.newPage();
    await page.goto(pathToFileURL(SORTIE_HTML).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: SORTIE_PDF, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  } finally {
    await navigateur.close();
  }
  console.log("docs/SYNTHESE.pdf écrit (A4, une page attendue).");
}

principal().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});
