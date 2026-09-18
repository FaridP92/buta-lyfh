import { useMemo } from "react";
import { AGENCES, nomAgence, useFiltres } from "@/app/filtres";
import { useDeclarerExport } from "@/app/exportEcran";
import { useVue } from "@/donnees/useVue";
import { Carte } from "@/composants/Carte";
import { CarteGraphique } from "@/composants/CarteGraphique";
import { CarteKPI } from "@/composants/CarteKPI";
import { Tableau, type Colonne } from "@/composants/Tableau";
import { Pastille, statutEcart } from "@/composants/Pastille";
import { Badge } from "@/composants/Badge";
import { BoutonFiche } from "@/composants/FicheIndicateur";
import { LigneSources } from "@/composants/LigneSources";
import { Squelette } from "@/composants/Squelette";
import { useTokensGraphique } from "@/graphiques/theme";
import { useEstMobile } from "@/lib/useEstMobile";
import { agregerKpi, ajouterMois, ecartPct, ecartPoints, moisDe, moisEntre, periodeN1, type LigneKpi } from "@/lib/periode";
import { formatDateCourte, formatMontant, formatNombreDecimal, formatTaux } from "@/lib/format";
import { expliquerEcart, sommerEffets } from "@/lib/phrases";
import { ExplicationEcart } from "@/composants/ExplicationEcart";
import { estimerElasticite, phraseRemise } from "@/lib/remise";
import { agregerVentes, agregerVentesPar, serieMensuelleParProduit, type LigneVenteProduit } from "@/lib/ventes";
import { optionAnnulations, optionCascade, optionMatrice, optionProduitsMensuels, optionRemises } from "./options";

/** Libellés courts des produits pour les axes ; le libellé complet reste dans les infobulles et la légende. */
const PRODUITS_COURTS: Record<string, string> = {
  PVB: "PV + batterie", PACAE: "PAC air-eau", PV6: "PV 6 kWc", PV3: "PV 3 kWc", PACAA: "PAC air-air", POELE: "Poêle", CET: "CET", BORNE: "Borne",
};

export function EcranVentes() {
  const filtres = useFiltres();
  const { periode, comparaison, agenceVue, agence, perimetreLibelle } = filtres;
  const tokens = useTokensGraphique();
  const mobile = useEstMobile();

  const n1 = periodeN1(periode);
  const debutSerie = ajouterMois(periode.fin, -11);
  const debutVentes = debutSerie < periode.debut ? debutSerie : periode.debut;

  const kpiTous = useVue("mart_kpi_mensuel", { ordre: "mois" });
  const ecarts = useVue("mart_ecarts", { egal: { agence: agenceVue, comparaison }, entre: { colonne: "mois", de: `${periode.debut}-01`, a: `${periode.fin}-01` } });
  const ventesProduit = useVue("mart_ventes_produit", { entre: { colonne: "mois", de: `${debutVentes}-01`, a: `${periode.fin}-01` } });
  const produitsDim = useVue("dim_produit");
  const remisesMois = useVue("mart_remises", { egal: { grain: "mois" } });
  const remisesPeriode = useVue("mart_remises", { egal: { grain: periode.type, periode: `${periode.debut}-01` } });

  const lignesKpi = useMemo(() => ((kpiTous.donnees ?? []) as unknown as (LigneKpi & { agence: string })[]), [kpiTous.donnees]);
  const lignesVue = useMemo(() => lignesKpi.filter((l) => l.agence === agenceVue), [lignesKpi, agenceVue]);
  const actuel = useMemo(() => agregerKpi(lignesVue, periode.debut, periode.fin), [lignesVue, periode.debut, periode.fin]);
  const prorata = actuel?.prorata ?? 1;
  const precedent = useMemo(() => (n1 ? agregerKpi(lignesVue, n1.debut, n1.fin, { prorataDernierMois: prorata }) : null), [lignesVue, n1, prorata]);

  const partiel = prorata < 1 && actuel !== null;
  const mentionProrata = partiel ? ` au prorata (${actuel.jours_publies} j sur ${actuel.jours_mois})` : "";
  const comparaisonLibelle = comparaison === "objectif" ? `vs objectif${partiel ? " prorata" : ""}` : `vs N-1${partiel ? " prorata" : ""}`;
  const libelleN1 = n1 ? `vs N-1${partiel ? " prorata" : ""}` : "vs N-1 : pas d'historique 2024";
  const caComparaison = comparaison === "objectif" ? actuel?.objectif_ca_prorata ?? null : precedent?.ca_signe ?? null;

  const douzeMois = useMemo(() => moisEntre(debutSerie, periode.fin), [debutSerie, periode.fin]);
  const serie = (cle: keyof LigneKpi) => douzeMois.map((m) => {
    const l = lignesVue.find((x) => moisDe(x.mois) === m);
    return l ? ((l[cle] as number | null | undefined) ?? null) : null;
  });
  const serieRatio = (cle: "taux_marge" | "taux_remise" | "taux_annulation" | "panier_moyen") => douzeMois.map((m) => {
    const l = kpiTous.donnees?.find((x) => x.agence === agenceVue && moisDe(x.mois) === m);
    return l ? l[cle] : null;
  });

  // Cascade et explication.
  const effets = useMemo(() => sommerEffets((ecarts.donnees ?? []).filter((e) => e.comparaison_disponible).map((e) => ({ total: e.ecart_total, volume: e.effet_volume, mix: e.effet_mix, prix: e.effet_prix, remise: e.effet_remise, residuel: e.residuel }))), [ecarts.donnees]);
  const ecartsDisponibles = (ecarts.donnees ?? []).filter((e) => e.comparaison_disponible);
  const motifSansComparaison = (ecarts.donnees ?? []).find((e) => !e.comparaison_disponible)?.motif ?? null;
  const caComparaisonEcarts = ecartsDisponibles.reduce((s, e) => s + e.ca_comparaison, 0);
  const caRealiseEcarts = ecartsDisponibles.reduce((s, e) => s + e.ca_realise, 0);
  const ventesEcarts = ecartsDisponibles.reduce((s, e) => s + e.ventes, 0);
  const ventesComparaisonEcarts = ecartsDisponibles.reduce((s, e) => s + e.ventes_comparaison, 0);
  const remiseEcarts = ecartsDisponibles.at(-1);
  const explication = useMemo(() => {
    if (!effets || !filtres.journeePubliee) return null;
    return expliquerEcart({
      perimetre: perimetreLibelle, periodeLibelle: periode.libelle, comparaisonLibelle: comparaison === "objectif" ? "l'objectif" : "N-1",
      caRealise: caRealiseEcarts, caComparaison: caComparaisonEcarts, ventes: ventesEcarts, ventesComparaison: ventesComparaisonEcarts,
      tauxRemise: remiseEcarts?.taux_remise ?? null, tauxRemiseComparaison: remiseEcarts?.taux_remise_comparaison ?? null,
      effets, journeePubliee: formatDateCourte(filtres.journeePubliee),
      ...(partiel && actuel ? { prorata: { joursPublies: actuel.jours_publies, joursMois: actuel.jours_mois } } : {}),
    });
  }, [effets, filtres.journeePubliee, perimetreLibelle, periode.libelle, comparaison, caRealiseEcarts, caComparaisonEcarts, ventesEcarts, ventesComparaisonEcarts, remiseEcarts, partiel, actuel]);
  const cascade = effets ? optionCascade({ comparaisonLibelle: comparaison === "objectif" ? "Objectif" : "N-1", caComparaison: caComparaisonEcarts, caRealise: caRealiseEcarts, effets }, tokens, mobile) : null;
  const mentionAxe = cascade?.axeTronque ? ` ; axe des montants tronqué à ${formatMontant(cascade.axeTronque)}` : "";

  // Produits : série mensuelle sur douze mois et matrice agence × produit sur la période.
  const produits = useMemo(() => [...(produitsDim.donnees ?? [])].sort((a, b) => b.prix_catalogue - a.prix_catalogue).map((p) => ({ code: p.code, libelle: p.libelle, court: PRODUITS_COURTS[p.code] ?? p.libelle })), [produitsDim.donnees]);
  const lignesVentes = useMemo(() => ((ventesProduit.donnees ?? []) as unknown as LigneVenteProduit[]), [ventesProduit.donnees]);
  const serieProduits = useMemo(() => {
    const propres = lignesVentes.filter((l) => l.agence === agenceVue && l.produit !== "TOUS");
    return serieMensuelleParProduit(propres, produits.map((p) => p.code), debutSerie, periode.fin, "ca_signe");
  }, [lignesVentes, agenceVue, produits, debutSerie, periode.fin]);
  const optionProduits = serieProduits.mois.length > 0 && produits.length > 0
    ? optionProduitsMensuels(serieProduits.mois, serieProduits.series.map((s) => ({ ...s, libelle: produits.find((p) => p.code === s.produit)?.court ?? s.produit })), serieProduits.tauxMarge, tokens, mobile)
    : null;
  const cellules = useMemo(() => {
    const parCle = new Map<string, LigneVenteProduit[]>();
    for (const l of lignesVentes) {
      if (l.agence === "RESEAU" || l.produit === "TOUS") continue;
      const cle = `${l.agence}|${l.produit}`;
      const liste = parCle.get(cle) ?? [];
      liste.push(l);
      parCle.set(cle, liste);
    }
    const resultat = new Map<string, ReturnType<typeof agregerVentes>>();
    for (const [cle, liste] of parCle) resultat.set(cle, agregerVentes(liste, periode.debut, periode.fin));
    return new Map([...resultat].filter((e): e is [string, NonNullable<ReturnType<typeof agregerVentes>>] => e[1] !== null));
  }, [lignesVentes, periode.debut, periode.fin]);
  const matrice = produits.length > 0 && cellules.size > 0 ? optionMatrice(AGENCES, produits.map((p) => ({ code: p.code, libelle: p.court })), cellules, tokens, mobile) : null;

  // Annulations à distance contre sur place, par agence (produit TOUS).
  const annulations = useMemo(() => {
    const parAgence = agregerVentesPar(lignesVentes.filter((l) => l.produit === "TOUS" && l.agence !== "RESEAU"), "agence", periode.debut, periode.fin);
    return AGENCES.map((a) => {
      const v = parAgence.get(a.code);
      return { nom: a.nom, aDistance: v?.taux_annulation_a_distance ?? null, surPlace: v?.taux_annulation_sur_place ?? null, signaturesADistance: v?.signatures_a_distance ?? 0 };
    }).filter((l) => l.aDistance !== null || l.surPlace !== null);
  }, [lignesVentes, periode.debut, periode.fin]);

  // Tableau des agences : période et N-1 par agence.
  const lignesAgences = useMemo(() => {
    const parAgence = new Map<string, LigneKpi[]>();
    for (const l of lignesKpi) {
      if (l.agence === "RESEAU") continue;
      const liste = parAgence.get(l.agence) ?? [];
      liste.push(l);
      parAgence.set(l.agence, liste);
    }
    return AGENCES.map((a) => {
      const lignes = parAgence.get(a.code) ?? [];
      const kpi = agregerKpi(lignes, periode.debut, periode.fin);
      const kpiN1 = n1 && kpi ? agregerKpi(lignes, n1.debut, n1.fin, { prorataDernierMois: kpi.prorata }) : null;
      return { code: a.code, nom: a.nom, kpi, ecartN1: ecartPct(kpi?.ca_signe ?? null, kpiN1?.ca_signe ?? null) };
    }).filter((a) => a.kpi !== null);
  }, [lignesKpi, periode.debut, periode.fin, n1]);

  useDeclarerExport("ventes-agences", lignesAgences.length ? {
    nom: "Ventes par agence",
    colonnes: [
      { cle: "agence", libelle: "Agence" }, { cle: "ca_signe", libelle: "CA signé (€)" }, { cle: "ecart_objectif_pct", libelle: "Écart objectif (%)" }, { cle: "ecart_n1", libelle: "Écart N-1 (%)" },
      { cle: "taux_marge", libelle: "Marge brute (%)" }, { cle: "marge_apres_acquisition", libelle: "Marge après acquisition (€)" }, { cle: "resultat", libelle: "Résultat (€)" },
      { cle: "productivite_commerciale", libelle: "Ventes par commercial" },
      { cle: "taux_remise", libelle: "Remise (%)" }, { cle: "taux_annulation", libelle: "Annulations à 60 jours (%)" },
    ],
    lignes: lignesAgences.map((a) => ({ agence: a.nom, ca_signe: a.kpi?.ca_signe ?? null, ecart_objectif_pct: a.kpi?.ecart_objectif_pct ?? null, ecart_n1: a.ecartN1, taux_marge: a.kpi?.taux_marge ?? null, marge_apres_acquisition: a.kpi?.marge_apres_acquisition ?? null, resultat: a.kpi?.resultat ?? null, productivite_commerciale: a.kpi?.productivite_commerciale ?? null, taux_remise: a.kpi?.taux_remise ?? null, taux_annulation: a.kpi?.annulation_mature ? a.kpi.taux_annulation : null })),
  } : null);

  // Remises : boîtes par agence sur la période, régression sur les mois clos de toutes les agences.
  const boites = useMemo(() => {
    const lignes = remisesPeriode.donnees ?? [];
    return [...AGENCES.map((a) => ({ code: a.code, nom: a.nom })), { code: "RESEAU", nom: "Réseau" }].map((a) => {
      const r = lignes.find((l) => l.agence === a.code);
      if (!r || r.remise_p10 === null || r.remise_q1 === null || r.remise_mediane === null || r.remise_q3 === null || r.remise_p90 === null) return null;
      return { nom: a.nom, boite: [r.remise_p10, r.remise_q1, r.remise_mediane, r.remise_q3, r.remise_p90] as [number, number, number, number, number], devis: r.devis, active: a.code === agenceVue };
    }).filter((l): l is NonNullable<typeof l> => l !== null);
  }, [remisesPeriode.donnees, agenceVue]);
  const elasticite = useMemo(() => estimerElasticite(remisesMois.donnees ?? []), [remisesMois.donnees]);
  const optionBoites = boites.length > 0 ? optionRemises(boites, tokens, mobile) : null;

  const clePeriode = `${periode.param}|${agenceVue}|${comparaison}`;
  const chargement = kpiTous.donnees === undefined;

  const colonnesAgences: Colonne<(typeof lignesAgences)[number]>[] = [
    { cle: "agence", libelle: "Agence", valeur: (l) => l.nom, rendu: (l) => <span className="whitespace-nowrap text-texte">{l.nom}</span> },
    { cle: "ca", libelle: "CA signé", numerique: true, largeur: "92px", valeur: (l) => l.kpi?.ca_signe ?? null, rendu: (l) => formatMontant(l.kpi?.ca_signe ?? null) },
    { cle: "ecart", libelle: "Écart obj.", numerique: true, largeur: "88px", valeur: (l) => l.kpi?.ecart_objectif_pct ?? null, rendu: (l) => pctSigne(l.kpi?.ecart_objectif_pct) },
    { cle: "ecart_n1", libelle: "Écart N-1", numerique: true, largeur: "88px", secondaire: true, valeur: (l) => l.ecartN1, rendu: (l) => pctSigne(l.ecartN1) },
    { cle: "marge", libelle: "Marge brute", numerique: true, largeur: "96px", valeur: (l) => l.kpi?.taux_marge ?? null, rendu: (l) => formatTaux(l.kpi?.taux_marge ?? null) },
    { cle: "marge_acq", libelle: "Après acquisition", numerique: true, largeur: "120px", secondaire: true, valeur: (l) => l.kpi?.marge_apres_acquisition ?? null, rendu: (l) => formatMontant(l.kpi?.marge_apres_acquisition ?? null) },
    { cle: "resultat", libelle: "Résultat", numerique: true, largeur: "92px", valeur: (l) => l.kpi?.resultat ?? null, rendu: (l) => <span className={(l.kpi?.resultat ?? 0) < 0 ? "text-alerte" : "text-texte"}>{formatMontant(l.kpi?.resultat ?? null)}</span> },
    { cle: "productivite", libelle: "Ventes / commercial", numerique: true, largeur: "112px", secondaire: true, valeur: (l) => l.kpi?.productivite_commerciale ?? null, rendu: (l) => formatNombreDecimal(l.kpi?.productivite_commerciale ?? null, 1) },
    { cle: "remise", libelle: "Remise", numerique: true, largeur: "76px", secondaire: true, valeur: (l) => l.kpi?.taux_remise ?? null, rendu: (l) => formatTaux(l.kpi?.taux_remise ?? null) },
    // Le taux d'annulation à 60 jours n'est affiché que si toutes les signatures de la période ont 60 jours (sinon « n. d. »).
    { cle: "annulations", libelle: "Annul. 60 j", numerique: true, largeur: "84px", secondaire: true, valeur: (l) => (l.kpi?.annulation_mature ? l.kpi.taux_annulation : null), rendu: (l) => formatTaux(l.kpi?.annulation_mature ? l.kpi.taux_annulation : null) },
    { cle: "statut", libelle: "Statut", triable: false, valeur: (l) => statutEcart(l.kpi?.ecart_objectif_pct), rendu: (l) => <Pastille statut={statutEcart(l.kpi?.ecart_objectif_pct)} texte={libelleStatut(l.kpi?.ecart_objectif_pct)} /> },
  ];

  const requeteEcarts = `select * from buta.mart_ecarts where agence = '${agenceVue}' and comparaison = '${comparaison}' and mois between '${periode.debut}-01' and '${periode.fin}-01'`;

  return (
    <div className="flex flex-col gap-[var(--esp-5)]">
      <header className="flex flex-wrap items-end justify-between gap-[var(--esp-3)]">
        <div>
          <h1 className="font-serif-titre text-[32px] leading-[1.1] text-texte max-md:text-[26px]">
            {agence === "toutes" ? "D'où vient l'écart de chiffre d'affaires" : `${nomAgence(agence)} : d'où vient l'écart`}
          </h1>
          <p className="mt-1 text-[13px] text-texte-2 max-md:min-h-[2lh]">
            {periode.libelle} · {comparaison === "objectif" ? "vs objectif" : "vs N-1"}{mentionProrata} · {kpiTous.source === "instantane" ? <Badge variante="instantane">instantané</Badge> : <Badge variante="simule">simulé</Badge>}
          </p>
        </div>
        <p className="text-[12px] text-texte-3">Journée publiée : {filtres.journeePubliee ? formatDateCourte(filtres.journeePubliee) : "n. d."}</p>
      </header>

      {chargement ? (
        <div className="grid grid-cols-1 gap-[var(--esp-3)] sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((i) => <Squelette key={i} hauteur={132} />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--esp-3)] sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6">
          <CarteKPI libelle="CA signé HT" valeur={actuel?.ca_signe ?? null} format="eur" code="CA_SIGNE" clePeriode={clePeriode} decalageMs={0}
            serie={serie("ca_signe")} variation={{ valeur: ecartPct(actuel?.ca_signe ?? null, caComparaison), unite: "pct", libelle: comparaisonLibelle }} />
          <CarteKPI libelle="CA posé HT" valeur={actuel?.ca_pose ?? null} format="eur" code="CA_POSE" clePeriode={clePeriode} decalageMs={80}
            serie={serie("ca_pose")} variation={{ valeur: ecartPct(actuel?.ca_pose ?? null, precedent?.ca_pose ?? null), unite: "pct", libelle: libelleN1 }} />
          <CarteKPI libelle="Taux de marge brute" valeur={actuel?.taux_marge ?? null} format="pct" code="TX_MARGE" clePeriode={clePeriode} decalageMs={160}
            serie={serieRatio("taux_marge")} variation={{ valeur: ecartPoints(actuel?.taux_marge ?? null, precedent?.taux_marge ?? null), unite: "pts", libelle: libelleN1 }} />
          <CarteKPI libelle="Panier moyen" valeur={actuel?.panier_moyen ?? null} format="eur" code="PANIER" clePeriode={clePeriode} decalageMs={240}
            serie={serieRatio("panier_moyen")} variation={{ valeur: ecartPct(actuel?.panier_moyen ?? null, precedent?.panier_moyen ?? null), unite: "pct", libelle: libelleN1 }} />
          <CarteKPI libelle="Remise moyenne" valeur={actuel?.taux_remise ?? null} format="pct" code="REMISE" clePeriode={clePeriode} decalageMs={320}
            serie={serieRatio("taux_remise")} variation={{ valeur: ecartPoints(actuel?.taux_remise ?? null, precedent?.taux_remise ?? null), unite: "pts", libelle: libelleN1, plusBasMieux: true }} />
          <CarteKPI libelle="Taux d'annulation" sousLibelle={actuel && !actuel.annulation_mature ? "à 60 jours · cohorte de signature en cours" : "à 60 jours"} valeur={actuel?.annulation_mature ? actuel.taux_annulation : null} format="pct" code="TX_ANNUL" clePeriode={clePeriode} decalageMs={400}
            motifNd="Les signatures de la période n'ont pas encore 60 jours : le taux ne se compare pas à une cohorte mûre"
            serie={serieRatio("taux_annulation")} variation={{ valeur: actuel?.annulation_mature ? ecartPoints(actuel.taux_annulation, precedent?.taux_annulation ?? null) : null, unite: "pts", libelle: actuel?.annulation_mature ? libelleN1 : "60 jours non écoulés", plusBasMieux: true }} />
        </div>
      )}

      <div className="grid gap-[var(--esp-3)] lg:grid-cols-12">
        {ecarts.donnees === undefined ? (
          <Carte className="lg:col-span-7" titre="Cascade de l'écart de CA"><Squelette hauteur={320} /></Carte>
        ) : cascade && effets ? (
          <CarteGraphique className="lg:col-span-7" titre="Cascade de l'écart de CA" sousTitre={`${periode.libelle}, ${comparaison === "objectif" ? "contre l'objectif" : "contre N-1"}${mentionProrata} : effet volume, mix, prix, remise, résiduel${mentionAxe}`}
            option={cascade.option} hauteur={320} codeIndicateur="ECART_CA" requete={requeteEcarts}
            description={`Cascade de l'écart de CA ${periode.libelle} : total ${formatMontant(effets.total)}, volume ${formatMontant(effets.volume)}, mix ${formatMontant(effets.mix)}, prix ${formatMontant(effets.prix)}, remise ${formatMontant(effets.remise)}`}
            exportCSV={{ colonnes: [{ cle: "effet", libelle: "Effet" }, { cle: "montant", libelle: "Montant (€)" }], lignes: [
              { effet: comparaison === "objectif" ? "Objectif" : "N-1", montant: caComparaisonEcarts }, { effet: "Volume", montant: effets.volume }, { effet: "Mix", montant: effets.mix },
              { effet: "Prix", montant: effets.prix }, { effet: "Remise", montant: effets.remise }, { effet: "Résiduel", montant: effets.residuel }, { effet: "Réalisé", montant: caRealiseEcarts },
            ] }}
            enfantsSous={(
              <div className="flex flex-col gap-[var(--esp-2)]">
                <p className="text-[12px] text-texte-3">Résiduel : {formatMontant(effets.residuel)} (termes croisés, nul par construction avec un taux de remise pondéré).</p>
                <ExplicationEcart perimetre={agence === "toutes" ? "reseau" : agence} mois={periode.fin} indicateur="CA" repli={explication} />
              </div>
            )} />
        ) : (
          <Carte className="lg:col-span-7" titre="Cascade de l'écart de CA" sousTitre={`${periode.libelle}, ${comparaison === "objectif" ? "contre l'objectif" : "contre N-1"}`} actions={<BoutonFiche code="ECART_CA" />}>
            <p className="text-[15px] text-texte">n. d.</p>
            <p className="mt-1 text-[13px] text-texte-2">{motifSansComparaison ?? "La comparaison n'existe pas pour cette période."}</p>
          </Carte>
        )}

        {optionProduits ? (
          <CarteGraphique className="lg:col-span-5" titre="CA signé par produit" sousTitre="Douze mois, barres empilées ; courbe et axe de droite : taux de marge brute" option={optionProduits} hauteur={320} codeIndicateur="MIX"
            description={`CA signé mensuel par produit sur douze mois pour ${perimetreLibelle}`}
            requete={`select * from buta.mart_ventes_produit where agence = '${agenceVue}' and produit <> 'TOUS' and mois between '${debutSerie}-01' and '${periode.fin}-01'`}
            exportCSV={{ colonnes: [{ cle: "mois", libelle: "Mois" }, ...produits.map((p) => ({ cle: p.code, libelle: `${p.libelle} (€)` })), { cle: "taux_marge", libelle: "Taux de marge (%)" }],
              lignes: serieProduits.mois.map((m, i) => ({ mois: m, ...Object.fromEntries(serieProduits.series.map((s) => [s.produit, s.valeurs[i] ?? null])), taux_marge: serieProduits.tauxMarge[i] ?? null })) }} />
        ) : <Carte className="lg:col-span-5" titre="CA signé par produit"><Squelette hauteur={320} /></Carte>}
      </div>

      <Carte titre="Quelle agence gagne de l'argent" sousTitre={`${periode.libelle} : CA, écarts, marge brute, marge après acquisition, résultat d'agence, remise, annulations${mentionProrata}`} nu>
        <div className="px-[var(--esp-2)] pb-[var(--esp-3)]">
          {chargement ? <Squelette hauteur={360} /> : (
            <Tableau colonnes={colonnesAgences} lignes={lignesAgences} cleLigne={(l) => l.code} triInitial={{ cle: "resultat", sens: "desc" }} compact
              estActive={(l) => l.code === agence} onLigneClic={(l) => filtres.definir("agence", l.code === agence ? "toutes" : l.code)} nomExport="ventes-agences" />
          )}
        </div>
      </Carte>

      <div className="grid gap-[var(--esp-3)] lg:grid-cols-12">
        {matrice ? (
          <CarteGraphique className="lg:col-span-7" titre="Matrice agence × produit" sousTitre={`${periode.libelle} : taille du point = CA signé, couleur = taux de marge brute`} option={matrice} hauteur={360} codeIndicateur="MIX"
            description={`Matrice des neuf agences et huit produits sur ${periode.libelle}`}
            requete={`select * from buta.mart_ventes_produit where agence <> 'RESEAU' and produit <> 'TOUS' and mois between '${periode.debut}-01' and '${periode.fin}-01'`}
            exportCSV={{ colonnes: [{ cle: "agence", libelle: "Agence" }, { cle: "produit", libelle: "Produit" }, { cle: "ventes", libelle: "Ventes" }, { cle: "ca_signe", libelle: "CA signé (€)" }, { cle: "taux_marge", libelle: "Taux de marge (%)" }],
              lignes: [...cellules].map(([cle, v]) => { const [a, p] = cle.split("|"); return { agence: nomAgence(a ?? ""), produit: produits.find((x) => x.code === p)?.libelle ?? p ?? "", ventes: v.ventes, ca_signe: v.ca_signe, taux_marge: v.taux_marge }; }) }} />
        ) : <Carte className="lg:col-span-7" titre="Matrice agence × produit"><Squelette hauteur={360} /></Carte>}

        {annulations.length > 0 ? (
          <CarteGraphique className="lg:col-span-5" titre="Annulations à 60 jours : à distance ou sur place" sousTitre="Départements sans agence (79, 85, 24, 47, 32, 64) contre départements avec agence" option={optionAnnulations(annulations, tokens)} hauteur={360} codeIndicateur="TX_ANNUL"
            description={`Taux d'annulation par agence, départements couverts à distance contre départements avec agence, ${periode.libelle}`}
            requete={`select agence, taux_annulation_a_distance, taux_annulation_sur_place from buta.mart_ventes_produit where produit = 'TOUS' and mois between '${periode.debut}-01' and '${periode.fin}-01'`}
            exportCSV={{ colonnes: [{ cle: "agence", libelle: "Agence" }, { cle: "a_distance", libelle: "À distance (%)" }, { cle: "sur_place", libelle: "Sur place (%)" }, { cle: "signatures_a_distance", libelle: "Signatures à distance" }],
              lignes: annulations.map((l) => ({ agence: l.nom, a_distance: l.aDistance, sur_place: l.surPlace, signatures_a_distance: l.signaturesADistance })) }} />
        ) : <Carte className="lg:col-span-5" titre="Annulations à 60 jours : à distance ou sur place"><Squelette hauteur={360} /></Carte>}
      </div>

      {optionBoites ? (
        <CarteGraphique titre="Remises" sousTitre={`Distribution des taux de remise des devis de ${periode.libelle} par agence : médiane, quartiles, moustaches aux 10e et 90e centiles`} option={optionBoites} hauteur={300} codeIndicateur="ELAST_REMISE"
          description={`Boîtes à moustaches des taux de remise par agence, ${periode.libelle}`}
          requete={`select * from buta.mart_remises where grain = '${periode.type}' and periode = '${periode.debut}-01'`}
          exportCSV={{ colonnes: [{ cle: "agence", libelle: "Agence" }, { cle: "devis", libelle: "Devis" }, { cle: "p10", libelle: "Centile 10 (%)" }, { cle: "q1", libelle: "Quartile 1 (%)" }, { cle: "mediane", libelle: "Médiane (%)" }, { cle: "q3", libelle: "Quartile 3 (%)" }, { cle: "p90", libelle: "Centile 90 (%)" }],
            lignes: boites.map((b) => ({ agence: b.nom, devis: b.devis, p10: b.boite[0], q1: b.boite[1], mediane: b.boite[2], q3: b.boite[3], p90: b.boite[4] })) }}
          enfantsSous={(
            <p className="text-[13px] leading-relaxed text-texte-2">
              <span className="mr-[6px] inline-block h-[6px] w-[6px] rounded-full bg-ambre align-middle" aria-hidden="true" />
              {remisesMois.donnees === undefined ? "Estimation de la pente en cours…" : phraseRemise(elasticite)}
            </p>
          )} />
      ) : <Carte titre="Remises"><Squelette hauteur={300} /></Carte>}

      <LigneSources simule sources={[{ nom: "Vues mart_kpi_mensuel, mart_ecarts, mart_ventes_produit, mart_remises", ...(filtres.journeePubliee ? { reference: `journée publiée du ${formatDateCourte(filtres.journeePubliee)}` } : {}) }]}
        hypotheses="Objectif : réalisé 2025 × 1,15 ; N-1 indisponible pour 2025 ; coûts de revient au prix catalogue du dossier (DONNEES.md §3.3)." />
    </div>
  );
}

function pctSigne(valeur: number | null | undefined): string {
  if (valeur === null || valeur === undefined) return "n. d.";
  return `${valeur > 0 ? "+" : ""}${formatTaux(valeur)}`;
}

function libelleStatut(ecart: number | null | undefined): string {
  const s = statutEcart(ecart);
  return s === "succes" ? "tenu" : s === "attention" ? "proche" : s === "alerte" ? "retrait" : "n. d.";
}

