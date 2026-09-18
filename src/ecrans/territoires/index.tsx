import { useId, useMemo, useState } from "react";
import { Link } from "react-router";
import { nomAgence } from "@/app/filtres";
import { useDeclarerExport } from "@/app/exportEcran";
import { useVue } from "@/donnees/useVue";
import { Carte } from "@/composants/Carte";
import { CarteGraphique } from "@/composants/CarteGraphique";
import { Tableau, type Colonne } from "@/composants/Tableau";
import { Badge } from "@/composants/Badge";
import { BoutonFiche } from "@/composants/FicheIndicateur";
import { LigneSources } from "@/composants/LigneSources";
import { Squelette } from "@/composants/Squelette";
import { useTokensGraphique } from "@/graphiques/theme";
import { useCarte } from "@/graphiques/cartes";
import { useEstMobile } from "@/lib/useEstMobile";
import { formatDateCourte, formatNombre, formatTaux } from "@/lib/format";
import { LIBELLES_COMPOSANTES, POIDS_DEFAUT, poidsParDefaut, recalculerIndices, type Composantes, type Poids } from "@/lib/indice";
import { optionCommunes, optionFrance, optionGazCiterne, type CommuneCarte, type DepartementCarte } from "./options";

const COMPOSANTES: (keyof Composantes)[] = ["volume", "intensiteFioul", "intensiteFg", "frein", "saturation"];
const BORNES: Record<keyof Poids, { max: number; pas: number }> = {
  volume: { max: 1, pas: 0.05 }, intensiteFioul: { max: 1, pas: 0.05 }, intensiteFg: { max: 1, pas: 0.05 }, frein: { max: 0.6, pas: 0.05 }, saturation: { max: 0.6, pas: 0.05 },
};

function composantesDe(d: { c_volume: number | null; c_intensite_fioul: number | null; c_intensite_fg: number | null; c_frein: number | null; c_saturation: number | null }): Composantes {
  return { volume: d.c_volume ?? Number.NaN, intensiteFioul: d.c_intensite_fioul ?? Number.NaN, intensiteFg: d.c_intensite_fg ?? Number.NaN, frein: d.c_frein ?? Number.NaN, saturation: d.c_saturation ?? Number.NaN };
}

function dateDe(reference: unknown, cle: string): string | null {
  if (reference && typeof reference === "object" && cle in reference) {
    const v = (reference as Record<string, unknown>)[cle];
    return typeof v === "string" ? v : null;
  }
  return null;
}

export function EcranTerritoires() {
  const tokens = useTokensGraphique();
  const mobile = useEstMobile();
  const idBase = useId();
  const [poids, setPoids] = useState<Poids>({ ...POIDS_DEFAUT });
  const [selection, setSelection] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [afficherRge, setAfficherRge] = useState(false);
  const [tableauComplet, setTableauComplet] = useState(false);

  const departements = useVue("mart_marche_departement", { ordre: "departement" });
  const agencesDim = useVue("dim_agence");
  const communes = useVue("mart_marche_commune", zoom ? { egal: { departement: zoom }, partition: "departement", ordre: "-indice" } : { egal: { departement: "aucun" }, partition: "departement" });
  const carteFrance = useCarte("departements", "/geo/departements-100m.geojson");
  const carteCommunes = useCarte(zoom ? `communes-${zoom}` : "communes-aucun", zoom ? `/geo/communes-${zoom}.geojson` : "");

  const personnalise = !poidsParDefaut(poids);
  const lignes = useMemo(() => {
    const brutes = (departements.donnees ?? []).map((d) => ({ ...d, composantes: composantesDe(d) }));
    const recalculees = recalculerIndices(brutes, poids);
    // Indice affiché : celui de la vue aux poids par défaut, recalculé sinon.
    return recalculees.map((d) => ({ ...d, indiceAffiche: personnalise ? d.indiceRecalcule : d.indice }));
  }, [departements.donnees, poids, personnalise]);
  const selectionne = lignes.find((d) => d.departement === selection) ?? lignes.find((d) => d.perimetre) ?? null;
  const reference = lignes[0]?.date_reference;

  const pourCarte: DepartementCarte[] = lignes.map((d) => ({ code: d.departement, nom: d.nom, perimetre: d.perimetre, indice: d.indiceAffiche, proprietaires: d.proprietaires, fioul: d.fioul, gaz_citerne: d.gaz_citerne, maisons_fg: d.maisons_fg, solaire_nb: d.solaire_nb, rge_pac: d.rge_pac, rge_pv: d.rge_pv, agences: d.agences_simulees }));
  const optionCarte = carteFrance.prete && pourCarte.length > 0 ? optionFrance(pourCarte, tokens, selectionne?.departement ?? null, mobile) : null;
  const optionCiterne = carteFrance.prete && lignes.length > 0 ? optionGazCiterne(lignes.map((d) => ({ code: d.departement, nom: d.nom, gaz_citerne: d.gaz_citerne, rp: d.rp })), tokens, mobile) : null;

  const communesCarte: CommuneCarte[] = useMemo(() => (communes.donnees ?? []).map((c) => ({ code: c.code_insee, nom: c.nom ?? c.code_insee, indice: c.indice, proprietaires: c.proprietaires, fioul: c.fioul, gaz_citerne: c.gaz_citerne, maisons_fg: c.maisons_fg, rge_pac: c.rge_pac, rge_pv: c.rge_pv, latitude: c.latitude, longitude: c.longitude })), [communes.donnees]);
  const agencesDuDepartement = (agencesDim.donnees ?? []).filter((a) => a.departement === zoom).map((a) => ({ nom: a.nom_bassin, latitude: a.latitude, longitude: a.longitude }));
  const optionZoom = zoom && carteCommunes.prete && communesCarte.length > 0 ? optionCommunes(`communes-${zoom}`, communesCarte, agencesDuDepartement, afficherRge, tokens, mobile) : null;
  const vingtCommunes = [...communesCarte].sort((a, b) => (b.indice ?? -1) - (a.indice ?? -1)).slice(0, 20);
  const nomZoom = lignes.find((d) => d.departement === zoom)?.nom ?? zoom;

  const colonnes: Colonne<(typeof lignes)[number]>[] = [
    { cle: "departement", libelle: "Département", valeur: (l) => `${l.departement} ${l.nom}`, rendu: (l) => <span className={l.perimetre ? "whitespace-nowrap text-texte" : "whitespace-nowrap text-texte-2"}>{l.departement} · {l.nom}</span> },
    { cle: "indice", libelle: "Indice", numerique: true, largeur: "72px", valeur: (l) => l.indiceAffiche, rendu: (l) => (l.indiceAffiche === null ? "n. d." : formatNombre(Math.round(l.indiceAffiche))) },
    { cle: "proprietaires", libelle: "Propriétaires", numerique: true, largeur: "104px", rendu: (l) => formatNombre(l.proprietaires) },
    { cle: "part_fioul_citerne", libelle: "Fioul et citerne", numerique: true, largeur: "104px", rendu: (l) => formatTaux(l.part_fioul_citerne) },
    { cle: "part_maisons_fg", libelle: "F ou G", numerique: true, largeur: "80px", rendu: (l) => formatTaux(l.part_maisons_fg) },
    { cle: "maisons", libelle: "Maisons", numerique: true, largeur: "92px", secondaire: true, rendu: (l) => formatNombre(l.maisons) },
    { cle: "fioul", libelle: "Fioul", numerique: true, largeur: "84px", secondaire: true, rendu: (l) => formatNombre(l.fioul) },
    { cle: "gaz_citerne", libelle: "Citerne", numerique: true, largeur: "84px", secondaire: true, rendu: (l) => formatNombre(l.gaz_citerne) },
    { cle: "solaire_pour_1000_maisons", libelle: "Solaire / 1 000", numerique: true, largeur: "104px", secondaire: true, rendu: (l) => (l.solaire_pour_1000_maisons === null ? "n. d." : formatNombre(Math.round(l.solaire_pour_1000_maisons))) },
    { cle: "rge_pour_10000_maisons", libelle: "RGE / 10 000", numerique: true, largeur: "96px", secondaire: true, rendu: (l) => (l.rge_pour_10000_maisons === null ? "n. d." : formatNombre(Math.round(l.rge_pour_10000_maisons))) },
    { cle: "agences_simulees", libelle: "Agence simulée", triable: false, valeur: (l) => l.agences_simulees ?? "", rendu: (l) => <span className="block max-w-[220px] text-[12px] leading-[1.3] text-texte-2">{l.agences_simulees ? l.agences_simulees.split(",").map((c) => nomAgence(c.trim())).join(", ") : ""}</span> },
  ];
  const lignesTableau = useMemo(() => [...lignes].sort((a, b) => Number(b.perimetre) - Number(a.perimetre) || (b.indiceAffiche ?? -1) - (a.indiceAffiche ?? -1)), [lignes]);
  // Par défaut : les onze du périmètre et les quinze départements suivants ; le bouton déplie les 96 (l'export porte toujours les 96).
  const lignesVisibles = tableauComplet ? lignesTableau : lignesTableau.slice(0, 26);

  useDeclarerExport("territoires-departements", lignes.length ? {
    nom: "Marché par département",
    colonnes: [{ cle: "departement", libelle: "Département" }, { cle: "nom", libelle: "Nom" }, { cle: "perimetre", libelle: "Périmètre simulé" }, { cle: "indice", libelle: "Indice" }, { cle: "proprietaires", libelle: "Propriétaires occupants" }, { cle: "part_fioul_citerne", libelle: "Fioul et citerne (%)" }, { cle: "part_maisons_fg", libelle: "Maisons F ou G (%)" }, { cle: "maisons", libelle: "Maisons" }, { cle: "fioul", libelle: "Fioul" }, { cle: "gaz_citerne", libelle: "Gaz citerne" }, { cle: "solaire_nb", libelle: "Installations solaires" }, { cle: "rge_pac", libelle: "RGE PAC" }, { cle: "rge_pv", libelle: "RGE PV" }],
    lignes: lignesTableau.map((l) => ({ departement: l.departement, nom: l.nom, perimetre: l.perimetre, indice: l.indiceAffiche, proprietaires: l.proprietaires, part_fioul_citerne: l.part_fioul_citerne, part_maisons_fg: l.part_maisons_fg, maisons: l.maisons, fioul: l.fioul, gaz_citerne: l.gaz_citerne, solaire_nb: l.solaire_nb, rge_pac: l.rge_pac, rge_pv: l.rge_pv })),
  } : null);

  const sources = [
    { nom: "Insee, Logement 2022", licence: "Licence Ouverte 2.0", ...(dateDe(reference, "insee") ? { reference: `millésime ${dateDe(reference, "insee")?.slice(0, 4)}` } : {}) },
    { nom: "ADEME, liste des installateurs RGE", licence: "Licence Ouverte 2.0", ...(dateDe(reference, "rge") ? { reference: `ingérée le ${formatDateCourte(dateDe(reference, "rge") as string)}` } : {}) },
    { nom: "RTE, registre des installations", licence: "Licence Ouverte 2.0", ...(dateDe(reference, "rte") ? { reference: `au ${formatDateCourte(dateDe(reference, "rte") as string)}` } : {}) },
    { nom: "ADEME, base DPE", licence: "Licence Ouverte 2.0", ...(dateDe(reference, "dpe") ? { reference: `ingérée le ${formatDateCourte(dateDe(reference, "dpe") as string)}` } : {}) },
  ];

  return (
    <div className="flex flex-col gap-[var(--esp-5)]">
      <header className="flex flex-wrap items-end justify-between gap-[var(--esp-3)]">
        <div>
          <h1 className="font-serif-titre text-[32px] leading-[1.1] text-texte max-md:text-[26px]">Où est le potentiel non servi</h1>
          <p className="mt-1 text-[13px] text-texte-2">96 départements de métropole, données publiques · {departements.source === "instantane" ? <Badge variante="instantane">instantané</Badge> : <Badge variante="reel">réel, sources publiques</Badge>}</p>
        </div>
        <p className="text-[12px] text-texte-3">Aucune donnée simulée ici, sauf la position des neuf agences simulées.</p>
      </header>

      <div className="grid gap-[var(--esp-3)] lg:grid-cols-12">
        {zoom ? (
          optionZoom ? (
            <CarteGraphique className="lg:col-span-8" titre={`Communes : ${nomZoom}`} sousTitre={`${formatNombre(communesCarte.length)} communes, potentiel calculé parmi les communes des onze départements ; molette pour zoomer`} option={optionZoom} hauteur={520} hauteurMobile={380}
              description={`Carte des communes du département ${zoom} colorée par l'indice de potentiel`} codeIndicateur="INDICE"
              requete={`select * from buta.mart_marche_commune where departement = '${zoom}' order by indice desc`}
              exportCSV={{ colonnes: [{ cle: "code", libelle: "Code Insee" }, { cle: "nom", libelle: "Commune" }, { cle: "indice", libelle: "Indice" }, { cle: "proprietaires", libelle: "Propriétaires" }, { cle: "fioul", libelle: "Fioul" }, { cle: "gaz_citerne", libelle: "Gaz citerne" }, { cle: "maisons_fg", libelle: "Maisons F ou G" }, { cle: "rge_pac", libelle: "RGE PAC" }, { cle: "rge_pv", libelle: "RGE PV" }],
                lignes: communesCarte.map((c) => ({ code: c.code, nom: c.nom, indice: c.indice, proprietaires: c.proprietaires, fioul: c.fioul, gaz_citerne: c.gaz_citerne, maisons_fg: c.maisons_fg, rge_pac: c.rge_pac, rge_pv: c.rge_pv })) }}
              enfantsSous={(
                <div className="flex flex-col gap-[var(--esp-3)]">
                  <div className="flex flex-wrap items-center gap-[var(--esp-3)]">
                    <button type="button" onClick={() => setZoom(null)} className="inline-flex h-8 items-center rounded-[10px] border border-bordure px-[var(--esp-2)] text-[12px] text-texte-2 hover:bg-surface-2 hover:text-texte">Retour à la France</button>
                    <label className="flex items-center gap-2 text-[12px] text-texte-2">
                      <input type="checkbox" checked={afficherRge} onChange={(e) => setAfficherRge(e.target.checked)} className="accent-ambre" />
                      Installateurs RGE PAC ou PV (points par commune, sans nom)
                    </label>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">Vingt premières communes par indice</p>
                    <ol className="grid gap-x-[var(--esp-4)] gap-y-[2px] text-[12px] text-texte-2 sm:grid-cols-2">
                      {vingtCommunes.map((c, i) => <li key={c.code} className="flex justify-between gap-2"><span><span className="chiffre mr-1 text-texte-3">{i + 1}</span>{c.nom}</span><span className="chiffre text-texte">{c.indice === null ? "n. d." : formatNombre(Math.round(c.indice))}</span></li>)}
                    </ol>
                  </div>
                </div>
              )} />
          ) : <Carte className="lg:col-span-8" titre={`Communes : ${nomZoom}`}>{carteCommunes.erreur ? <p className="text-[13px] text-texte-2">Contours indisponibles : {carteCommunes.erreur}</p> : <Squelette hauteur={520} />}</Carte>
        ) : optionCarte ? (
          <CarteGraphique className="lg:col-span-8" titre="Indice de potentiel par département" sousTitre={`Rangs centiles sur 96 départements ; les onze du périmètre simulé sont détourés en ambre${personnalise ? " ; poids personnalisés" : ""}. Clic : sélectionner un département.`} option={optionCarte} hauteur={520} hauteurMobile={380}
            description="Carte de France par département colorée par l'indice de potentiel, périmètre simulé détouré" codeIndicateur="INDICE"
            requete="select * from buta.mart_marche_departement order by indice desc"
            onEvenements={{ click: (p: unknown) => { const { name } = p as { name?: string }; if (name && lignes.some((l) => l.departement === name)) setSelection(name); } }}
            exportCSV={{ colonnes: [{ cle: "departement", libelle: "Département" }, { cle: "nom", libelle: "Nom" }, { cle: "indice", libelle: "Indice" }], lignes: lignesTableau.map((l) => ({ departement: l.departement, nom: l.nom, indice: l.indiceAffiche })) }} />
        ) : <Carte className="lg:col-span-8" titre="Indice de potentiel par département">{carteFrance.erreur ? <p className="text-[13px] text-texte-2">Contours indisponibles : {carteFrance.erreur}</p> : <Squelette hauteur={520} />}</Carte>}

        <Carte className="lg:col-span-4" titre="Composantes de l'indice" sousTitre={selectionne ? `${selectionne.nom} (${selectionne.departement}), rangs centiles sur 96 départements` : "Sélectionner un département sur la carte"} actions={<BoutonFiche code="INDICE" />}>
          {!selectionne ? <Squelette hauteur={300} /> : (
            <div className="flex flex-col gap-[var(--esp-3)]">
              <div className="flex items-baseline gap-[var(--esp-2)]">
                <span className="chiffre text-[32px] leading-none text-texte">{selectionne.indiceAffiche === null ? "n. d." : formatNombre(Math.round(selectionne.indiceAffiche))}</span>
                <span className="text-[12px] text-texte-2">indice{personnalise ? " (poids personnalisés)" : ""}{personnalise && selectionne.indice !== null ? ` · ${formatNombre(Math.round(selectionne.indice))} aux poids de référence` : ""}</span>
              </div>
              <ul className="flex flex-col gap-[var(--esp-2)]">
                {COMPOSANTES.map((cle) => {
                  const valeur = selectionne.composantes[cle];
                  const penalite = cle === "frein" || cle === "saturation";
                  const id = `${idBase}-${cle}`;
                  return (
                    <li key={cle} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2 text-[12px]">
                        <label htmlFor={id} className="text-texte-2">{LIBELLES_COMPOSANTES[cle]}</label>
                        <span className="chiffre text-texte">{Number.isNaN(valeur) ? "n. d." : formatNombre(Math.round(valeur))}<span className="ml-1 text-texte-3">· poids {formatNombre(Math.round(poids[cle] * 100))} %{penalite ? " (pénalité)" : ""}</span></span>
                      </div>
                      <div className="h-[6px] w-full overflow-hidden rounded-full bg-surface-2"><div className={penalite ? "h-full rounded-full bg-texte-3" : "h-full rounded-full bg-ambre"} style={{ width: `${Number.isNaN(valeur) ? 0 : Math.max(0, Math.min(100, valeur))}%`, transition: "width 500ms cubic-bezier(0.22, 1, 0.36, 1)" }} /></div>
                      <input id={id} type="range" min={0} max={BORNES[cle].max} step={BORNES[cle].pas} value={poids[cle]} onChange={(e) => setPoids((p) => ({ ...p, [cle]: Number(e.target.value) }))} className="h-1 w-full cursor-pointer accent-ambre" aria-valuetext={`poids ${formatNombre(Math.round(poids[cle] * 100))} %`} />
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-[var(--esp-2)]">
                <button type="button" onClick={() => setPoids({ ...POIDS_DEFAUT })} disabled={!personnalise} className="inline-flex h-8 items-center rounded-[10px] border border-bordure px-[var(--esp-2)] text-[12px] text-texte-2 hover:bg-surface-2 hover:text-texte disabled:opacity-40">Réinitialiser les poids</button>
                {!zoom && <button type="button" onClick={() => { setZoom(selectionne.departement); setAfficherRge(false); }} disabled={!selectionne.perimetre} title={selectionne.perimetre ? undefined : "Communes disponibles pour les onze départements du périmètre"} className="inline-flex h-8 items-center rounded-[10px] bg-ambre px-[var(--esp-3)] text-[12px] font-medium text-fond hover:opacity-90 disabled:opacity-40">Voir les communes</button>}
              </div>
              <p className="text-[11px] leading-relaxed text-texte-3">Indice = (0,4 × volume + 0,3 × fioul et citerne + 0,3 × F ou G) × (1 - 0,3 × frein / 100) × (1 - 0,3 × saturation / 100) aux poids de référence. Ce n'est pas une recommandation d'implantation : <Link to="/methode" className="underline-offset-2 hover:underline">méthode</Link>.</p>
            </div>
          )}
        </Carte>
      </div>

      <Carte titre="Les 96 départements" sousTitre={`Les onze du périmètre simulé en tête, puis les autres par indice${personnalise ? " recalculé avec les poids personnalisés" : ""} ; clic : sélectionner`} nu>
        <div className="px-[var(--esp-2)] pb-[var(--esp-3)]">
          {departements.donnees === undefined ? <Squelette hauteur={400} /> : (
            <>
              <Tableau colonnes={colonnes} lignes={lignesVisibles} cleLigne={(l) => l.departement} compact nomExport="territoires-departements"
                estActive={(l) => l.departement === selectionne?.departement} onLigneClic={(l) => setSelection(l.departement)} />
              <button type="button" onClick={() => setTableauComplet((v) => !v)} className="mt-[var(--esp-2)] px-[var(--esp-2)] text-[12px] text-texte-2 underline-offset-2 hover:text-texte hover:underline">
                {tableauComplet ? "Réduire aux vingt-six premiers" : `Afficher les ${formatNombre(lignesTableau.length)} départements`}
              </button>
            </>
          )}
        </div>
      </Carte>

      <div className="grid gap-[var(--esp-3)] lg:grid-cols-12">
        {optionCiterne ? (
          <CarteGraphique className="lg:col-span-7" titre="Le parc gaz en citerne" sousTitre="Résidences principales chauffées au gaz en citerne ou en bouteille, par département (Insee)" option={optionCiterne} hauteur={380} hauteurMobile={320}
            description="Carte de chaleur des départements par résidences principales au gaz citerne ou bouteille"
            requete="select departement, nom, gaz_citerne, rp from buta.mart_marche_departement order by gaz_citerne desc"
            exportCSV={{ colonnes: [{ cle: "departement", libelle: "Département" }, { cle: "nom", libelle: "Nom" }, { cle: "gaz_citerne", libelle: "Résidences au gaz citerne ou bouteille" }], lignes: lignesTableau.map((l) => ({ departement: l.departement, nom: l.nom, gaz_citerne: l.gaz_citerne })) }} />
        ) : <Carte className="lg:col-span-7" titre="Le parc gaz en citerne"><Squelette hauteur={380} /></Carte>}
        <Carte className="lg:col-span-5" titre="Un parc à convertir" sousTitre="Ce que dit la carte">
          <p className="text-[15px] leading-relaxed text-texte-2">Mode de chauffage fréquent hors réseau de gaz, souvent en maison individuelle : un parc à convertir, à lire comme tel. Les départements les plus foncés cumulent des résidences principales au gaz en citerne ou en bouteille, chauffage coûteux et sensible aux prix, où pompe à chaleur, chauffe-eau thermodynamique et photovoltaïque trouvent leur place.</p>
          <p className="mt-[var(--esp-3)] text-[12px] text-texte-3">Recensement Insee 2022, variable « combustible principal du logement ». Le comptage porte sur les résidences principales, pas sur des clients ; aucune base commerciale n'est mobilisée.</p>
        </Carte>
      </div>

      <LigneSources sources={sources} hypotheses="Composantes en rangs centiles sur les 96 départements de métropole ; communes classées parmi celles des onze départements. Contours : Etalab, admin express simplifié." />
    </div>
  );
}
