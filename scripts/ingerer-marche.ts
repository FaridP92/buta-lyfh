/**
 * Ingestion du marche réel (DONNEES.md §1 et §2) : Insee Logement 2022, ADEME RGE,
 * RTE registre solaire, ADEME DPE, contours geographiques. Rejouable : téléchargements
 * caches dans .cache/marche/, upserts en base. `--charger` rejoue seulement le chargement
 * depuis .cache/marche/aggregats.json. Requiert `unzip` pour lire l'archive Insee en flux.
 */
import { spawn, execFile } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { lignesCsv, nombre } from "./lib/csv.ts";
import { limiteur, pause, requeterJson, telechargerVersFichier } from "./lib/http.ts";
import { chargerEnv, creerPool, upsertParLots, urlBase, type Ligne } from "./lib/bd.ts";

const executer = promisify(execFile);

const CACHE = ".cache/marche";
const GEO_SORTIE = "public/geo";
const DEPARTEMENTS_PERIMETRE = ["16", "17", "79", "85", "24", "33", "47", "32", "40", "64", "59"];
const DIX_DEPARTEMENTS = DEPARTEMENTS_PERIMETRE.filter((d) => d !== "59");
const AUJOURDHUI = new Date().toISOString().slice(0, 10);
const DATE_RTE = "2026-07-31";
const DATE_INSEE = "2022-01-01";
const DOMAINES_RGE = {
  rge_pac: "Pompe à chaleur : chauffage",
  rge_pv: "Panneaux solaires photovoltaïques",
  rge_cet: "Chauffe-Eau Thermodynamique",
} as const;
const URL_INSEE = "https://www.insee.fr/fr/statistiques/fichier/8581474/base-cc-logement-2022_csv.zip";
const URL_RTE =
  "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/registre-national-installation-production-stockage-electricite-agrege/exports/csv?delimiter=%3B";
const URL_RGE = "https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines";
const URL_DPE = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/values_agg";
const URL_DEPARTEMENTS_100M =
  "https://etalab-datasets.geo.data.gouv.fr/contours-administratifs/latest/geojson/departements-100m.geojson";
const URL_DEPARTEMENTS_100M_REPLI =
  "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson";
const TAILLE_MAX_COMMUNES = 300 * 1024;
const TAILLE_MAX_DEPARTEMENTS = 1200 * 1024;

interface Departement {
  code: string;
  nom: string;
  region: string;
}

interface Commune {
  code_insee: string;
  nom: string;
  departement: string;
  latitude: number | null;
  longitude: number | null;
  codes_postaux: string[];
}

interface Marche {
  rp: number;
  maisons: number;
  proprietaires: number;
  fioul: number;
  gaz_citerne: number;
  gaz_ville: number;
  electricite: number;
  maisons_fg: number;
  maisons_diag: number;
  maisons_fioul_dpe: number;
  maisons_gpl_dpe: number;
  solaire_nb: number;
  solaire_kw: number;
  solaire_nb_36: number;
  rge_pac: number;
  rge_pv: number;
  rge_cet: number;
}

interface Installateur {
  siret: string;
  nom: string;
  commune: string;
  code_insee: string | null;
  latitude: number | null;
  longitude: number | null;
  domaines: string[];
  departement: string;
}

interface Controle {
  libelle: string;
  attendu: number;
  obtenu: number;
  ecart_pct: number;
  ok: boolean;
}

interface Aggregats {
  genere_le: string;
  date_reference: Record<string, string>;
  departements: Departement[];
  communes: Commune[];
  marche_commune: Array<{ code_insee: string; departement: string } & Marche>;
  marche_departement: Array<
    { code: string } & Marche & {
        c_volume: number;
        c_intensite_fioul: number;
        c_intensite_fg: number;
        c_frein: number;
        c_saturation: number;
        indice: number;
      }
  >;
  rge_installateurs: Installateur[];
  rge_brut_17: { pac: number; pv: number };
  /** Totaux France entière (outre-mer et non geocodes compris), pour les seuls chiffres de contrôle. */
  france_entiere: { rp: number; maisons: number; fioul: number; gaz_citerne: number; dpe_maisons_fg: number };
  controles: Controle[];
  geo_tailles: Record<string, number>;
}

function marcheVide(): Marche {
  return {
    rp: 0,
    maisons: 0,
    proprietaires: 0,
    fioul: 0,
    gaz_citerne: 0,
    gaz_ville: 0,
    electricite: 0,
    maisons_fg: 0,
    maisons_diag: 0,
    maisons_fioul_dpe: 0,
    maisons_gpl_dpe: 0,
    solaire_nb: 0,
    solaire_kw: 0,
    solaire_nb_36: 0,
    rge_pac: 0,
    rge_pv: 0,
    rge_cet: 0,
  };
}

function obtenir<K>(carte: Map<K, Marche>, cle: K): Marche {
  let valeur = carte.get(cle);
  if (!valeur) {
    valeur = marcheVide();
    carte.set(cle, valeur);
  }
  return valeur;
}

function departementDepuisCodeInsee(code: string): string | null {
  if (code.startsWith("2A") || code.startsWith("2B")) return code.slice(0, 2);
  const dep = code.slice(0, 2);
  if (!/^\d{2}$/.test(dep) || dep === "97" || dep === "98" || dep === "99") return null;
  return dep;
}

function departementDepuisCodePostal(codePostal: string): string | null {
  if (!/^\d{5}$/.test(codePostal)) return null;
  const prefixe = codePostal.slice(0, 2);
  if (prefixe === "20") return Number(codePostal) < 20200 ? "2A" : "2B";
  if (prefixe === "97" || prefixe === "98" || prefixe === "99") return null;
  return prefixe;
}

function normaliserNom(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\bSAINTE\b/g, "STE")
    .replace(/\bSAINT\b/g, "ST");
}

function distanceCarre(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const kx = Math.cos((lat1 * Math.PI) / 180);
  return ((lat1 - lat2) ** 2) + (((lon1 - lon2) * kx) ** 2);
}

function journal(message: string): void {
  process.stdout.write(`${message}\n`);
}

// ---------------------------------------------------------------------------
// Geographie : départements, regions, communes
// ---------------------------------------------------------------------------

async function chargerGeo(): Promise<{ departements: Departement[]; communes: Commune[] }> {
  const cheminDep = `${CACHE}/geo-departements.json`;
  const cheminReg = `${CACHE}/geo-regions.json`;
  await telechargerVersFichier("https://geo.api.gouv.fr/departements?fields=code,nom,codeRegion", cheminDep);
  await telechargerVersFichier("https://geo.api.gouv.fr/regions", cheminReg);
  const regions = JSON.parse(await readFile(cheminReg, "utf-8")) as Array<{ code: string; nom: string }>;
  const nomRegion = new Map(regions.map((r) => [r.code, r.nom]));
  const brutsDep = JSON.parse(await readFile(cheminDep, "utf-8")) as Array<{ code: string; nom: string; codeRegion: string }>;
  const departements = brutsDep
    .filter((d) => departementDepuisCodeInsee(`${d.code}000`) !== null)
    .map((d) => ({ code: d.code, nom: d.nom, region: nomRegion.get(d.codeRegion) ?? d.codeRegion }));

  const communes: Commune[] = [];
  for (const dep of DEPARTEMENTS_PERIMETRE) {
    const chemin = `${CACHE}/geo-communes-${dep}.json`;
    await telechargerVersFichier(`https://geo.api.gouv.fr/departements/${dep}/communes?fields=code,nom,codesPostaux,centre`, chemin);
    const brutes = JSON.parse(await readFile(chemin, "utf-8")) as Array<{
      code: string;
      nom: string;
      codesPostaux?: string[];
      centre?: { coordinates: [number, number] };
    }>;
    for (const c of brutes) {
      communes.push({
        code_insee: c.code,
        nom: c.nom,
        departement: dep,
        latitude: c.centre ? c.centre.coordinates[1] : null,
        longitude: c.centre ? c.centre.coordinates[0] : null,
        codes_postaux: c.codesPostaux ?? [],
      });
    }
  }
  journal(`geo : ${departements.length} départements, ${communes.length} communes du périmètre`);
  return { departements, communes };
}

// ---------------------------------------------------------------------------
// Insee Logement 2022
// ---------------------------------------------------------------------------

async function chargerInsee(
  parCommune: Map<string, Marche>,
  parDepartement: Map<string, Marche>,
  franceEntiere: Aggregats["france_entiere"],
): Promise<void> {
  const chemin = `${CACHE}/insee-logement-2022.zip`;
  if (await telechargerVersFichier(URL_INSEE, chemin)) journal("insee : archive téléchargée");
  const enfant = spawn("unzip", ["-p", chemin, "base-cc-logement-2022.CSV"]);
  let lignes = 0;
  for await (const ligne of lignesCsv(enfant.stdout, ";")) {
    const code = ligne["CODGEO"] ?? "";
    const valeurs = {
      rp: nombre(ligne["P22_RP"]),
      maisons: nombre(ligne["P22_RPMAISON"]),
      proprietaires: nombre(ligne["P22_RP_PROP"]),
      fioul: nombre(ligne["P22_RP_CFIOUL"]),
      gaz_citerne: nombre(ligne["P22_RP_CGAZB"]),
      gaz_ville: nombre(ligne["P22_RP_CGAZV"]),
      electricite: nombre(ligne["P22_RP_CELEC"]),
    };
    franceEntiere.rp += valeurs.rp;
    franceEntiere.maisons += valeurs.maisons;
    franceEntiere.fioul += valeurs.fioul;
    franceEntiere.gaz_citerne += valeurs.gaz_citerne;
    const dep = departementDepuisCodeInsee(code);
    if (!dep) continue;
    lignes += 1;
    const d = obtenir(parDepartement, dep);
    for (const [cle, valeur] of Object.entries(valeurs)) d[cle as keyof typeof valeurs] += valeur;
    if (DEPARTEMENTS_PERIMETRE.includes(dep)) {
      const c = obtenir(parCommune, code);
      for (const [cle, valeur] of Object.entries(valeurs)) c[cle as keyof typeof valeurs] += valeur;
    }
  }
  await new Promise<void>((resoudre, rejeter) => {
    enfant.on("close", (code) => (code === 0 ? resoudre() : rejeter(new Error(`unzip a echoue (${code})`))));
  });
  journal(`insee : ${lignes} communes lues`);
}

// ---------------------------------------------------------------------------
// ADEME RGE
// ---------------------------------------------------------------------------

interface LigneRge {
  siret?: string;
  nom_entreprise?: string;
  code_postal?: string;
  commune?: string;
  latitude?: number;
  longitude?: number;
  domaine?: string;
  lien_date_fin?: string;
}

async function chargerRge(
  communes: Commune[],
  parCommune: Map<string, Marche>,
  parDepartement: Map<string, Marche>,
): Promise<{ installateurs: Installateur[]; brut17: { pac: number; pv: number } }> {
  const qs = `domaine:(${Object.values(DOMAINES_RGE)
    .map((d) => `"${d}"`)
    .join(" OR ")})`;
  const champs = "siret,nom_entreprise,code_postal,commune,latitude,longitude,domaine,lien_date_fin";
  let url: string | null = `${URL_RGE}?size=10000&qs=${encodeURIComponent(qs)}&select=${champs}`;
  let page = 0;
  const lignes: LigneRge[] = [];
  while (url) {
    page += 1;
    const chemin = `${CACHE}/rge-page-${page}.json`;
    if (!existsSync(chemin)) {
      const reponse = await requeterJson<{ next?: string; results: LigneRge[] }>(url, { timeoutMs: 120_000 });
      await writeFile(chemin, JSON.stringify(reponse));
      await pause(300);
    }
    const contenu = JSON.parse(await readFile(chemin, "utf-8")) as { next?: string; results: LigneRge[] };
    lignes.push(...contenu.results);
    url = contenu.next ?? null;
  }
  journal(`rge : ${lignes.length} qualifications lues en ${page} pages`);

  const parCodePostal = new Map<string, Commune[]>();
  const parDep = new Map<string, Commune[]>();
  for (const c of communes) {
    for (const cp of c.codes_postaux) {
      const liste = parCodePostal.get(cp) ?? [];
      liste.push(c);
      parCodePostal.set(cp, liste);
    }
    const liste = parDep.get(c.departement) ?? [];
    liste.push(c);
    parDep.set(c.departement, liste);
  }

  const resoudreCommune = (ligne: LigneRge, dep: string): Commune | null => {
    const candidats = parCodePostal.get(ligne.code_postal ?? "") ?? [];
    if (candidats.length === 1) return candidats[0] ?? null;
    const nom = normaliserNom(ligne.commune ?? "");
    const parNom = candidats.find((c) => normaliserNom(c.nom) === nom);
    if (parNom) return parNom;
    const bassin = candidats.length > 0 ? candidats : (parDep.get(dep) ?? []);
    if (ligne.latitude !== undefined && ligne.longitude !== undefined && bassin.length > 0) {
      let meilleur: Commune | null = null;
      let meilleureDistance = Infinity;
      for (const c of bassin) {
        if (c.latitude === null || c.longitude === null) continue;
        const d = distanceCarre(ligne.latitude, ligne.longitude, c.latitude, c.longitude);
        if (d < meilleureDistance) {
          meilleureDistance = d;
          meilleur = c;
        }
      }
      return meilleur;
    }
    return candidats[0] ?? null;
  };

  const installateurs = new Map<string, Installateur>();
  const brut17 = { pac: 0, pv: 0 };
  let nonResolues = 0;
  for (const ligne of lignes) {
    const dep = departementDepuisCodePostal(ligne.code_postal ?? "");
    if (!dep) continue;
    const cle = (Object.entries(DOMAINES_RGE).find(([, libelle]) => libelle === ligne.domaine)?.[0] ?? null) as
      | keyof typeof DOMAINES_RGE
      | null;
    if (!cle) continue;
    if (dep === "17" && cle === "rge_pac") brut17.pac += 1;
    if (dep === "17" && cle === "rge_pv") brut17.pv += 1;
    const valide = (ligne.lien_date_fin ?? "") >= AUJOURDHUI;
    if (!valide) continue;
    obtenir(parDepartement, dep)[cle] += 1;
    if (!DEPARTEMENTS_PERIMETRE.includes(dep)) continue;
    const commune = resoudreCommune(ligne, dep);
    if (commune) {
      obtenir(parCommune, commune.code_insee)[cle] += 1;
    } else {
      nonResolues += 1;
    }
    const siret = ligne.siret ?? "";
    if (siret === "") continue;
    const existant = installateurs.get(siret);
    if (existant) {
      if (!existant.domaines.includes(ligne.domaine ?? "")) existant.domaines.push(ligne.domaine ?? "");
    } else {
      installateurs.set(siret, {
        siret,
        nom: ligne.nom_entreprise ?? "",
        commune: ligne.commune ?? "",
        code_insee: commune?.code_insee ?? null,
        latitude: ligne.latitude ?? null,
        longitude: ligne.longitude ?? null,
        domaines: [ligne.domaine ?? ""],
        departement: dep,
      });
    }
  }
  journal(`rge : ${installateurs.size} installateurs géolocalisés dans le périmètre, ${nonResolues} qualifications sans commune résolue`);
  return { installateurs: [...installateurs.values()], brut17 };
}

// ---------------------------------------------------------------------------
// RTE registre solaire
// ---------------------------------------------------------------------------

async function chargerRte(parCommune: Map<string, Marche>, parDepartement: Map<string, Marche>): Promise<void> {
  const chemin = `${CACHE}/rte-registre.csv`;
  if (await telechargerVersFichier(URL_RTE, chemin)) journal("rte : export téléchargé");
  let lignes = 0;
  for await (const ligne of lignesCsv(createReadStream(chemin), ";")) {
    if (ligne["codefiliere"] !== "SOLAI") continue;
    const dep = ligne["codedepartement"] ?? "";
    if (departementDepuisCodeInsee(`${dep}000`) === null) continue;
    lignes += 1;
    const nb = nombre(ligne["nbinstallations"]) || 1;
    const kw = nombre(ligne["puismaxinstallee"]);
    const petites = kw > 0 && kw / nb <= 36 ? nb : 0;
    const d = obtenir(parDepartement, dep);
    d.solaire_nb += nb;
    d.solaire_kw += kw;
    d.solaire_nb_36 += petites;
    const commune = ligne["codeinseecommune"] ?? "";
    if (DEPARTEMENTS_PERIMETRE.includes(dep) && commune !== "") {
      const c = obtenir(parCommune, commune);
      c.solaire_nb += nb;
      c.solaire_kw += kw;
      c.solaire_nb_36 += petites;
    }
  }
  journal(`rte : ${lignes} lignes solaires agrégées`);
}

// ---------------------------------------------------------------------------
// ADEME DPE
// ---------------------------------------------------------------------------

const CRITERES_DPE = {
  maisons_fg: "etiquette_dpe:(F OR G)",
  maisons_diag: "",
  maisons_fioul_dpe: 'type_energie_principale_chauffage:"Fioul domestique"',
  maisons_gpl_dpe: "type_energie_principale_chauffage:(GPL OR Propane OR Butane)",
} as const;

async function chargerDpe(
  departements: Departement[],
  parCommune: Map<string, Marche>,
  parDepartement: Map<string, Marche>,
): Promise<void> {
  const limite = limiteur(4);
  let appels = 0;
  const taches = departements.flatMap((dep) =>
    (Object.keys(CRITERES_DPE) as Array<keyof typeof CRITERES_DPE>).map((critere) =>
      limite(async () => {
        const chemin = `${CACHE}/dpe-${dep.code}-${critere}.json`;
        if (!existsSync(chemin)) {
          const filtre = CRITERES_DPE[critere];
          const qs = `code_departement_ban:${dep.code} AND type_batiment:maison${filtre ? ` AND ${filtre}` : ""}`;
          const url = `${URL_DPE}?field=code_insee_ban&agg_size=1000&size=0&qs=${encodeURIComponent(qs)}`;
          const reponse = await requeterJson<{ total: number; aggs: Array<{ total: number; value: string }> }>(url, {
            timeoutMs: 60_000,
          });
          await writeFile(chemin, JSON.stringify(reponse));
          appels += 1;
          await pause(300);
        }
        const contenu = JSON.parse(await readFile(chemin, "utf-8")) as {
          total: number;
          aggs: Array<{ total: number; value: string }>;
        };
        obtenir(parDepartement, dep.code)[critere] = contenu.total;
        if (DEPARTEMENTS_PERIMETRE.includes(dep.code)) {
          for (const agg of contenu.aggs) {
            if (departementDepuisCodeInsee(agg.value) !== dep.code) continue;
            obtenir(parCommune, agg.value)[critere] = agg.total;
          }
        }
      }),
    ),
  );
  await Promise.all(taches);
  journal(`dpe : ${departements.length * 4} agrégats (${appels} appels réseau, le reste en cache)`);
}

/** Total France entière des maisons F ou G, non geocodees et outre-mer comprises (chiffre de contrôle). */
async function chargerDpeFranceEntiere(): Promise<number> {
  const chemin = `${CACHE}/dpe-FR-maisons_fg.json`;
  if (!existsSync(chemin)) {
    const qs = `type_batiment:maison AND ${CRITERES_DPE.maisons_fg}`;
    const reponse = await requeterJson<{ total: number }>(
      `${URL_DPE}?field=code_departement_ban&agg_size=1&size=0&qs=${encodeURIComponent(qs)}`,
      { timeoutMs: 60_000 },
    );
    await writeFile(chemin, JSON.stringify(reponse));
  }
  return (JSON.parse(await readFile(chemin, "utf-8")) as { total: number }).total;
}

// ---------------------------------------------------------------------------
// Contours
// ---------------------------------------------------------------------------

async function simplifier(entree: string, sortie: string, pourcentages: number[], tailleMax: number): Promise<number> {
  if (existsSync(sortie) && statSync(sortie).size > 0 && statSync(sortie).size <= tailleMax) return statSync(sortie).size;
  const binaire = "node_modules/.bin/mapshaper";
  for (const pct of pourcentages) {
    await executer(binaire, [
      "-i", entree,
      "-filter-fields", "code,nom",
      "-simplify", `${pct}%`, "keep-shapes",
      "-o", "precision=0.0001", "format=geojson", "force", sortie,
    ], { maxBuffer: 64 * 1024 * 1024 });
    const taille = statSync(sortie).size;
    if (taille <= tailleMax) return taille;
  }
  return statSync(sortie).size;
}

async function chargerContours(): Promise<Record<string, number>> {
  await mkdir(GEO_SORTIE, { recursive: true });
  const tailles: Record<string, number> = {};
  const brutDep = `${CACHE}/departements-100m.geojson`;
  try {
    await telechargerVersFichier(URL_DEPARTEMENTS_100M, brutDep);
  } catch (erreur) {
    journal(`contours : etalab indisponible (${erreur instanceof Error ? erreur.message : "erreur"}), repli france-geojson`);
    await telechargerVersFichier(URL_DEPARTEMENTS_100M_REPLI, brutDep);
  }
  const sortieDep = `${GEO_SORTIE}/departements-100m.geojson`;
  if (statSync(brutDep).size <= TAILLE_MAX_DEPARTEMENTS) {
    await copyFile(brutDep, sortieDep);
    tailles["departements-100m"] = statSync(sortieDep).size;
  } else {
    tailles["departements-100m"] = await simplifier(brutDep, sortieDep, [40, 30, 20, 15, 10], TAILLE_MAX_DEPARTEMENTS);
  }
  for (const dep of DEPARTEMENTS_PERIMETRE) {
    const brut = `${CACHE}/communes-${dep}-brut.geojson`;
    await telechargerVersFichier(`https://geo.api.gouv.fr/departements/${dep}/communes?format=geojson&geometry=contour`, brut);
    const sortie = `${GEO_SORTIE}/communes-${dep}.geojson`;
    tailles[`communes-${dep}`] = await simplifier(brut, sortie, [6, 5, 4, 3, 2.5, 2, 1.5, 1], TAILLE_MAX_COMMUNES);
  }
  journal(`contours : ${Object.keys(tailles).length} fichiers écrits dans ${GEO_SORTIE}/`);
  return tailles;
}

// ---------------------------------------------------------------------------
// Centiles, indice, contrôles
// ---------------------------------------------------------------------------

function centiles(valeurs: number[]): number[] {
  const n = valeurs.length;
  if (n <= 1) return valeurs.map(() => 0);
  return valeurs.map((v) => (valeurs.filter((autre) => autre < v).length / (n - 1)) * 100);
}

function calculerIndice(departements: Departement[], parDepartement: Map<string, Marche>): Aggregats["marche_departement"] {
  const codes = departements.map((d) => d.code);
  const m = codes.map((c) => obtenir(parDepartement, c));
  const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
  const cVolume = centiles(m.map((x) => x.proprietaires));
  const cFioul = centiles(m.map((x) => ratio(x.fioul + x.gaz_citerne, x.rp)));
  const cFg = centiles(m.map((x) => ratio(x.maisons_fg, x.maisons_diag)));
  const cFrein = centiles(m.map((x) => ratio(x.rge_pac + x.rge_pv, x.maisons) * 10_000));
  const cSaturation = centiles(m.map((x) => ratio(x.solaire_nb, x.maisons) * 1_000));
  return codes.map((code, i) => {
    const volume = cVolume[i] ?? 0;
    const fioul = cFioul[i] ?? 0;
    const fg = cFg[i] ?? 0;
    const frein = cFrein[i] ?? 0;
    const saturation = cSaturation[i] ?? 0;
    const indice = (0.4 * volume + 0.3 * fioul + 0.3 * fg) * (1 - (0.3 * frein) / 100) * (1 - (0.3 * saturation) / 100);
    return {
      code,
      ...arrondir(m[i] ?? marcheVide()),
      c_volume: +volume.toFixed(2),
      c_intensite_fioul: +fioul.toFixed(2),
      c_intensite_fg: +fg.toFixed(2),
      c_frein: +frein.toFixed(2),
      c_saturation: +saturation.toFixed(2),
      indice: +indice.toFixed(2),
    };
  });
}

function arrondir(m: Marche): Marche {
  const r = { ...m };
  for (const cle of Object.keys(r) as Array<keyof Marche>) {
    r[cle] = cle === "solaire_kw" ? +r[cle].toFixed(1) : Math.round(r[cle]);
  }
  return r;
}

function controler(agg: Aggregats): Controle[] {
  const dep = new Map(agg.marche_departement.map((d) => [d.code, d]));
  const somme = (codes: string[], cle: keyof Marche) => codes.reduce((s, c) => s + (dep.get(c)?.[cle] ?? 0), 0);
  const tous = agg.marche_departement.map((d) => d.code);
  const fe = agg.france_entiere;
  const lignes: Array<[string, number, number]> = [
    ["France entière, résidences principales (Insee)", 32_699_970, Math.round(fe.rp)],
    ["France entière, maisons (Insee)", 17_342_742, Math.round(fe.maisons)],
    ["France entière, fioul (Insee)", 2_616_667, Math.round(fe.fioul)],
    ["France entière, gaz citerne ou bouteille (Insee)", 448_868, Math.round(fe.gaz_citerne)],
    ["Métropole (96 départements), résidences principales (Insee)", 31_911_516, somme(tous, "rp")],
    ["Dix départements, maisons", 2_006_852, somme(DIX_DEPARTEMENTS, "maisons")],
    ["Dix départements, propriétaires", 1_755_553, somme(DIX_DEPARTEMENTS, "proprietaires")],
    ["Dix départements, fioul", 220_802, somme(DIX_DEPARTEMENTS, "fioul")],
    ["Dix départements, citerne", 56_672, somme(DIX_DEPARTEMENTS, "gaz_citerne")],
    ["Nord, maisons", 760_086, somme(["59"], "maisons")],
    ["Nord, propriétaires", 623_436, somme(["59"], "proprietaires")],
    ["Nord, fioul", 41_248, somme(["59"], "fioul")],
    ["France entière, maisons F ou G (DPE, non géocodées comprises)", 739_580, fe.dpe_maisons_fg],
    ["Métropole (96 départements géocodés), maisons F ou G (DPE)", 730_791, somme(tous, "maisons_fg")],
    ["Nord, maisons F ou G (DPE)", 31_576, somme(["59"], "maisons_fg")],
    ["Charente-Maritime, maisons F ou G (DPE)", 10_841, somme(["17"], "maisons_fg")],
    ["Charente-Maritime, installations solaires (RTE)", 23_520, somme(["17"], "solaire_nb")],
    ["Nord, installations solaires (RTE)", 23_394, somme(["59"], "solaire_nb")],
    ["Charente-Maritime, qualifications RGE pompe à chaleur (toutes)", 239, agg.rge_brut_17.pac],
    ["Charente-Maritime, qualifications RGE photovoltaïque (toutes)", 113, agg.rge_brut_17.pv],
  ];
  return lignes.map(([libelle, attendu, obtenu]) => {
    const ecart = attendu > 0 ? ((obtenu - attendu) / attendu) * 100 : 0;
    return { libelle, attendu, obtenu, ecart_pct: +ecart.toFixed(2), ok: Math.abs(ecart) <= 0.5 };
  });
}

// ---------------------------------------------------------------------------
// Chargement en base
// ---------------------------------------------------------------------------

async function charger(agg: Aggregats): Promise<boolean> {
  const url = urlBase();
  if (!url) {
    journal("chargement : SUPABASE_DB_URL absent, agrégats laissés dans le cache (rejouer avec --charger)");
    return false;
  }
  const pool = creerPool(url);
  const client = await pool.connect();
  try {
    try {
      await client.query("select 1 from buta.marche_commune limit 0");
    } catch {
      journal("chargement : tables buta absentes (migrations non appliquées), rejouer avec --charger plus tard");
      return false;
    }
    await client.query("begin");
    const dateRef = JSON.stringify(agg.date_reference);
    const colonnesMarche: Array<keyof Marche> = [
      "rp", "maisons", "proprietaires", "fioul", "gaz_citerne", "gaz_ville", "electricite",
      "maisons_fg", "maisons_diag", "maisons_fioul_dpe", "maisons_gpl_dpe",
      "solaire_nb", "solaire_kw", "solaire_nb_36", "rge_pac", "rge_pv", "rge_cet",
    ];
    const nDep = await upsertParLots(client, "buta.dim_departement", ["code", "nom", "region"], ["code"], agg.departements as unknown as Ligne[]);
    const nCom = await upsertParLots(
      client,
      "buta.dim_commune",
      ["code_insee", "nom", "departement", "latitude", "longitude"],
      ["code_insee"],
      agg.communes.map(({ codes_postaux: _cp, ...reste }) => reste) as unknown as Ligne[],
    );
    const nMc = await upsertParLots(
      client,
      "buta.marche_commune",
      ["code_insee", "departement", ...colonnesMarche, "date_reference"],
      ["code_insee"],
      agg.marche_commune.map((m) => ({ ...m, date_reference: dateRef })) as unknown as Ligne[],
    );
    const nMd = await upsertParLots(
      client,
      "buta.marche_departement",
      ["code", ...colonnesMarche, "c_volume", "c_intensite_fioul", "c_intensite_fg", "c_frein", "c_saturation", "indice", "date_reference"],
      ["code"],
      agg.marche_departement.map((m) => ({ ...m, date_reference: dateRef })) as unknown as Ligne[],
    );
    await client.query("delete from buta.rge_installateur where departement = any($1)", [DEPARTEMENTS_PERIMETRE]);
    const nRge = await upsertParLots(
      client,
      "buta.rge_installateur",
      ["siret", "nom", "commune", "code_insee", "latitude", "longitude", "domaines", "departement"],
      ["siret"],
      agg.rge_installateurs as unknown as Ligne[],
    );
    const prochaine = (jours: number) => new Date(Date.now() + jours * 86_400_000).toISOString().slice(0, 10);
    const nSrc = await upsertParLots(
      client,
      "buta.source_fraicheur",
      ["source", "date_reference", "ingere_le", "prochaine"],
      ["source"],
      [
        { source: "insee_logement_2022", date_reference: DATE_INSEE, ingere_le: new Date().toISOString(), prochaine: "2027-06-30" },
        { source: "ademe_rge", date_reference: agg.date_reference["rge"], ingere_le: new Date().toISOString(), prochaine: prochaine(30) },
        { source: "rte_registre", date_reference: DATE_RTE, ingere_le: new Date().toISOString(), prochaine: prochaine(30) },
        { source: "ademe_dpe", date_reference: agg.date_reference["dpe"], ingere_le: new Date().toISOString(), prochaine: prochaine(30) },
        { source: "contours_geo", date_reference: agg.date_reference["contours"], ingere_le: new Date().toISOString(), prochaine: "2027-01-31" },
      ],
    );
    await client.query("commit");
    journal(`chargement : dim_departement ${nDep}, dim_commune ${nCom}, marche_commune ${nMc}, marche_departement ${nMd}, rge_installateur ${nRge}, source_fraicheur ${nSrc}`);
    const verif = await client.query<{ rp: string; communes: string }>(
      "select (select sum(rp) from buta.marche_departement) as rp, (select count(*) from buta.marche_commune) as communes",
    );
    journal(`vérification base : France RP ${verif.rows[0]?.rp ?? "?"}, communes ${verif.rows[0]?.communes ?? "?"}`);
    return true;
  } catch (erreur) {
    await client.query("rollback").catch(() => undefined);
    throw erreur;
  } finally {
    client.release();
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function construire(): Promise<Aggregats> {
  await mkdir(CACHE, { recursive: true });
  const { departements, communes } = await chargerGeo();
  const parCommune = new Map<string, Marche>();
  const parDepartement = new Map<string, Marche>();
  const franceEntiere: Aggregats["france_entiere"] = { rp: 0, maisons: 0, fioul: 0, gaz_citerne: 0, dpe_maisons_fg: 0 };
  await chargerInsee(parCommune, parDepartement, franceEntiere);
  const { installateurs, brut17 } = await chargerRge(communes, parCommune, parDepartement);
  await chargerRte(parCommune, parDepartement);
  await chargerDpe(departements, parCommune, parDepartement);
  franceEntiere.dpe_maisons_fg = await chargerDpeFranceEntiere();
  const geoTailles = await chargerContours();

  const agg: Aggregats = {
    genere_le: new Date().toISOString(),
    date_reference: { insee: DATE_INSEE, rge: AUJOURDHUI, rte: DATE_RTE, dpe: AUJOURDHUI, contours: AUJOURDHUI },
    departements,
    communes,
    marche_commune: [...parCommune.entries()]
      .filter(([code]) => DEPARTEMENTS_PERIMETRE.includes(departementDepuisCodeInsee(code) ?? ""))
      .map(([code, m]) => ({ code_insee: code, departement: departementDepuisCodeInsee(code) ?? "", ...arrondir(m) })),
    marche_departement: calculerIndice(departements, parDepartement),
    rge_installateurs: installateurs,
    rge_brut_17: brut17,
    france_entiere: franceEntiere,
    controles: [],
    geo_tailles: geoTailles,
  };
  agg.controles = controler(agg);
  await writeFile(`${CACHE}/aggregats.json`, JSON.stringify(agg));
  return agg;
}

function afficherControles(controles: Controle[]): boolean {
  journal("\ncontrôles (tolérance 0,5 %) :");
  for (const c of controles) {
    journal(`  ${c.ok ? "OK" : "KO"}  ${c.libelle} : attendu ${c.attendu.toLocaleString("fr-FR")}, obtenu ${c.obtenu.toLocaleString("fr-FR")}, écart ${c.ecart_pct} %`);
  }
  return controles.every((c) => c.ok);
}

async function principal(): Promise<void> {
  chargerEnv();
  const chargerSeulement = process.argv.includes("--charger");
  let agg: Aggregats;
  if (chargerSeulement) {
    agg = JSON.parse(await readFile(`${CACHE}/aggregats.json`, "utf-8")) as Aggregats;
    journal(`agrégats du ${agg.genere_le} relus depuis le cache`);
  } else {
    agg = await construire();
  }
  journal(`geo : ${Object.entries(agg.geo_tailles).map(([k, v]) => `${k} ${Math.round(v / 1024)} Ko`).join(", ")}`);
  const controlesOk = afficherControles(agg.controles);
  await charger(agg);
  if (!controlesOk) {
    journal("\nau moins un chiffre de contrôle est hors tolérance");
    process.exitCode = 1;
  }
}

principal().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.stack ?? erreur.message : erreur);
  process.exit(1);
});
