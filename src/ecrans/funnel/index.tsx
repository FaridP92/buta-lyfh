import { useMemo, useState } from "react";
import { Link } from "react-router";
import { AGENCES, nomAgence, useFiltres } from "@/app/filtres";
import { useDeclarerExport } from "@/app/exportEcran";
import { useVue } from "@/donnees/useVue";
import { Carte } from "@/composants/Carte";
import { CarteGraphique } from "@/composants/CarteGraphique";
import { CarteKPI } from "@/composants/CarteKPI";
import { Tableau, type Colonne } from "@/composants/Tableau";
import { Pastille } from "@/composants/Pastille";
import { Badge } from "@/composants/Badge";
import { BoutonFiche } from "@/composants/FicheIndicateur";
import { LigneSources } from "@/composants/LigneSources";
import { SelecteurMenu } from "@/composants/SelecteurMenu";
import { Squelette } from "@/composants/Squelette";
import { useTokensGraphique } from "@/graphiques/theme";
import { useEstMobile } from "@/lib/useEstMobile";
import { agregerFunnel, agregerFunnelN1, ajouterMois, derniereCohorteMature, ecartPct, ecartPoints, etapesFunnel, libelleMois, moisDe, moisEntre, periodeN1, type LigneFunnel } from "@/lib/periode";
import { agregerCoutsParCanal, fluxSankey, matriceCanalAgence, sommerCouts, type LigneCoutCanal } from "@/lib/funnel";
import { formatDateCourte, formatDelaiJours, formatMontant, formatNombre, formatTaux } from "@/lib/format";
import { optionCourbeCanaux, optionSankey, optionSansRdv } from "./options";

export function EcranFunnel() {
  const filtres = useFiltres();
  const { periode, agenceVue, agence, perimetreLibelle, moisPublie } = filtres;
  const tokens = useTokensGraphique();
  const mobile = useEstMobile();
  const [canal, setCanal] = useState("TOUS");
  const n1 = periodeN1(periode);

  const funnel = useVue("mart_funnel", { egal: { agence: agenceVue }, ordre: "mois" });
  const funnelPeriode = useVue("mart_funnel", { entre: { colonne: "mois", de: `${periode.debut}-01`, a: `${periode.fin}-01` } });
  const attente = useVue("mart_funnel", { egal: { canal: "TOUS" }, entre: { colonne: "mois", de: `${ajouterMois(moisPublie, -7)}-01`, a: `${moisPublie}-01` }, ordre: "mois" });
  const couts = useVue("mart_couts_acquisition", { egal: { agence: agenceVue }, ordre: "mois" });
  const kpiPeriode = useVue("mart_kpi_mensuel", { egal: { agence: agenceVue }, entre: { colonne: "mois", de: `${periode.debut}-01`, a: `${periode.fin}-01` } });
  const canauxDim = useVue("dim_canal");

  const libelleCanal = (code: string) => (code === "TOUS" ? "Tous canaux" : canauxDim.donnees?.find((c) => c.code === code)?.libelle ?? code);
  const lignesTous = useMemo(() => ((funnel.donnees ?? []).filter((l) => l.canal === "TOUS") as unknown as LigneFunnel[]), [funnel.donnees]);
  const lignesCanal = useMemo(() => ((funnel.donnees ?? []).filter((l) => l.canal === canal) as unknown as LigneFunnel[]), [funnel.donnees, canal]);

  // KPI sur les cohortes de la période, comparées aux cohortes N-1 ramenées au prorata des jours publiés (mois en cours).
  const cohorte = useMemo(() => agregerFunnel(lignesTous, periode.debut, periode.fin), [lignesTous, periode.debut, periode.fin]);
  const prorataParMois = useMemo(() => new Map((kpiPeriode.donnees ?? []).map((l) => [moisDe(l.mois), l.prorata ?? 1] as const)), [kpiPeriode.donnees]);
  const prorataApplique = [...prorataParMois.values()].some((v) => v < 1);
  const cohorteN1 = useMemo(() => (n1 ? agregerFunnelN1(lignesTous, periode.debut, periode.fin, prorataParMois) : null), [lignesTous, periode.debut, periode.fin, prorataParMois, n1]);
  const libelleN1 = n1 ? `vs cohortes N-1${prorataApplique ? " au prorata" : ""}` : "vs N-1 : pas d'historique 2024";
  // Taux et coût par vente : sur les cohortes de la période si elles sont toutes mûres, sinon sur la dernière cohorte mûre
  // (une cohorte de moins de 90 jours n'a pas encore ses signatures : ses taux ne se comparent à rien).
  const cohorteMure = cohorte && !cohorte.mature ? derniereCohorteMature(lignesTous, periode.fin) : null;
  const moisMur = cohorteMure ? moisDe(cohorteMure.mois) : null;
  const cohorteTaux = cohorteMure ? agregerFunnel(lignesTous, moisDe(cohorteMure.mois), moisDe(cohorteMure.mois)) : cohorte;
  const cohorteTauxN1 = moisMur ? agregerFunnel(lignesTous, ajouterMois(moisMur, -12), ajouterMois(moisMur, -12)) : cohorteN1;
  const etapes = cohorteTaux ? etapesFunnel(cohorteTaux) : null;
  const etapesN1 = cohorteTauxN1 ? etapesFunnel(cohorteTauxN1) : null;
  const taux = (e: ReturnType<typeof etapesFunnel> | null, i: number) => e?.[i]?.taux ?? null;
  const sousLibelleTaux = (base: string) => (moisMur ? `${base} · cohorte de ${libelleMois(moisMur)}, à 90 jours` : base);
  const libelleTauxN1 = moisMur ? "vs même cohorte N-1" : libelleN1;
  const coutsTous = (couts.donnees ?? []).filter((c) => c.canal === "TOUS");
  const coutsPeriode = sommerCouts(coutsTous.filter((c) => moisDe(c.mois) >= periode.debut && moisDe(c.mois) <= periode.fin));
  const coutsN1 = n1 ? sommerCouts(coutsTous.filter((c) => moisDe(c.mois) >= n1.debut && moisDe(c.mois) <= n1.fin)) : null;
  const coutsVente = moisMur ? sommerCouts(coutsTous.filter((c) => moisDe(c.mois) === moisMur)) : coutsPeriode;
  const coutsVenteN1 = moisMur ? sommerCouts(coutsTous.filter((c) => moisDe(c.mois) === ajouterMois(moisMur, -12))) : coutsN1;

  const douzeMois = useMemo(() => moisEntre(ajouterMois(periode.fin, -11), periode.fin), [periode.fin]);
  // Mini courbes : les taux et le coût par vente ne sont tracés que pour les cohortes mûres (les autres n'ont pas fini de convertir).
  const ligneMois = (m: string) => (funnel.donnees ?? []).find((x) => x.canal === "TOUS" && moisDe(x.mois) === m);
  const serieFunnel = (cle: "leads" | "taux_rdv" | "taux_devis" | "taux_signature") => douzeMois.map((m) => {
    const l = ligneMois(m);
    return l && (cle === "leads" || l.cohorte_mature) ? l[cle] : null;
  });
  const serieCouts = (cle: "cout_par_lead" | "cout_par_vente") => douzeMois.map((m) => {
    if (cle === "cout_par_vente" && !ligneMois(m)?.cohorte_mature) return null;
    return coutsTous.find((x) => moisDe(x.mois) === m)?.[cle] ?? null;
  });

  // Sankey sur le canal choisi.
  const cohorteCanal = useMemo(() => agregerFunnel(lignesCanal, periode.debut, periode.fin), [lignesCanal, periode.debut, periode.fin]);
  const flux = cohorteCanal ? fluxSankey(cohorteCanal) : null;
  const optionFlux = flux && cohorteCanal ? optionSankey(flux.noeuds, flux.liens, cohorteCanal.leads, tokens, mobile) : null;
  const optionsCanal = [{ valeur: "TOUS", libelle: "Tous canaux" }, ...(canauxDim.donnees ?? []).map((c) => ({ valeur: c.code, libelle: c.libelle }))];

  // Matrice canal × agence.
  const matrice = useMemo(() => matriceCanalAgence(funnelPeriode.donnees ?? [], periode.debut, periode.fin), [funnelPeriode.donnees, periode.debut, periode.fin]);
  const canauxMatrice = useMemo(() => {
    const codes = [...new Set([...matrice.keys()].map((k) => k.split("|")[0] as string))];
    return codes.map((code) => ({ code, libelle: libelleCanal(code), leads: AGENCES.reduce((s, a) => s + (matrice.get(`${code}|${a.code}`)?.leads ?? 0), 0) })).sort((a, b) => b.leads - a.leads);
  }, [matrice, canauxDim.donnees]); // eslint-disable-line react-hooks/exhaustive-deps
  const leadsMax = Math.max(1, ...[...matrice.values()].map((c) => c.leads));
  const conversionMax = Math.max(1, ...[...matrice.values()].map((c) => c.taux_conversion ?? 0));
  const colonnesMatrice: Colonne<(typeof canauxMatrice)[number]>[] = [
    { cle: "canal", libelle: "Canal", valeur: (l) => l.libelle, rendu: (l) => <span className="whitespace-nowrap text-texte">{l.libelle}</span> },
    ...AGENCES.map((a) => ({
      cle: a.code, libelle: a.nom, numerique: true,
      valeur: (l: (typeof canauxMatrice)[number]) => matrice.get(`${l.code}|${a.code}`)?.taux_conversion ?? null,
      rendu: (l: (typeof canauxMatrice)[number]) => {
        const c = matrice.get(`${l.code}|${a.code}`);
        if (!c || c.leads === 0) return <span className="text-texte-3">n. d.</span>;
        const intensite = Math.round((60 * (c.taux_conversion ?? 0)) / conversionMax);
        return (
          <span className="inline-flex flex-col items-end gap-[2px]" title={`${formatNombre(c.leads)} leads, ${formatNombre(c.signatures)} ventes nettes`}>
            <span className="rounded-[6px] px-[6px] py-[1px] text-texte" style={{ backgroundColor: `color-mix(in srgb, var(--ambre) ${intensite}%, transparent)` }}>{formatTaux(c.taux_conversion)}</span>
            <span className="h-[3px] rounded-full bg-texte-3/60" style={{ width: `${Math.max(4, Math.round((40 * c.leads) / leadsMax))}px` }} aria-hidden="true" />
          </span>
        );
      },
    })),
  ];

  // Courbe vingt mois : leads par canal, ventes nettes.
  const vingtMois = useMemo(() => [...new Set((funnel.donnees ?? []).map((l) => moisDe(l.mois)))].sort().slice(-20), [funnel.donnees]);
  const canauxCourbe = useMemo(() => {
    const codes = [...new Set((funnel.donnees ?? []).filter((l) => l.canal !== "TOUS").map((l) => l.canal))];
    return codes.map((code) => ({ code, libelle: libelleCanal(code), valeurs: vingtMois.map((m) => (funnel.donnees ?? []).find((l) => l.canal === code && moisDe(l.mois) === m)?.leads ?? 0) }))
      .sort((a, b) => b.valeurs.reduce((s, v) => s + v, 0) - a.valeurs.reduce((s, v) => s + v, 0));
  }, [funnel.donnees, vingtMois, canauxDim.donnees]); // eslint-disable-line react-hooks/exhaustive-deps
  const ventesNettes = vingtMois.map((m) => lignesTous.find((l) => moisDe(l.mois) === m)?.signatures_nettes ?? null);
  const optionCourbe = vingtMois.length > 0 && canauxCourbe.length > 0 ? optionCourbeCanaux(vingtMois, canauxCourbe, ventesNettes, tokens, mobile) : null;

  // Qualité des leads par canal : le verdict « à revoir » attend que les cohortes de la période aient 90 jours.
  const cohorteEnCours = cohorte ? !cohorte.mature : false;
  const canauxQualite = useMemo(() => agregerCoutsParCanal(((couts.donnees ?? []) as unknown as LigneCoutCanal[]), periode.debut, periode.fin), [couts.donnees, periode.debut, periode.fin]);
  const colonnesQualite: Colonne<(typeof canauxQualite)[number]>[] = [
    { cle: "canal", libelle: "Canal", valeur: (l) => libelleCanal(l.canal), rendu: (l) => <span className="whitespace-nowrap text-texte">{libelleCanal(l.canal)}</span> },
    { cle: "leads", libelle: "Leads", numerique: true, largeur: "72px", rendu: (l) => formatNombre(l.leads) },
    { cle: "taux_rdv", libelle: "Taux RDV", numerique: true, largeur: "84px", rendu: (l) => formatTaux(l.taux_rdv) },
    { cle: "taux_conversion", libelle: "Conversion", numerique: true, largeur: "92px", rendu: (l) => formatTaux(l.taux_conversion) },
    { cle: "cout", libelle: "Coût", numerique: true, largeur: "84px", secondaire: true, rendu: (l) => formatMontant(l.cout) },
    { cle: "cout_par_lead", libelle: "Coût / lead", numerique: true, largeur: "92px", secondaire: true, rendu: (l) => (l.cout === 0 ? "sans coût" : formatMontant(l.cout_par_lead)) },
    { cle: "cout_par_vente", libelle: "Coût / vente", numerique: true, largeur: "96px", rendu: (l) => (l.cout === 0 ? "sans coût" : formatMontant(l.cout_par_vente)) },
    { cle: "delai", libelle: "Lead vers RDV", numerique: true, largeur: "104px", secondaire: true, valeur: (l) => l.delai_lead_rdv_median, rendu: (l) => formatDelaiJours(l.delai_lead_rdv_median) },
    { cle: "a_revoir", libelle: "Statut", triable: false, valeur: (l) => (l.a_revoir === null ? "" : cohorteEnCours ? "provisoire" : l.a_revoir ? "à revoir" : "dans la norme"), rendu: (l) => (l.a_revoir === null ? <Pastille statut="neutre" texte="sans coût" /> : cohorteEnCours ? <Pastille statut="neutre" texte="provisoire" /> : l.a_revoir ? <Pastille statut="alerte" texte="à revoir" /> : <Pastille statut="succes" texte="dans la norme" />) },
  ];
  useDeclarerExport("funnel-canaux", canauxQualite.length ? {
    nom: "Qualité des leads",
    colonnes: [{ cle: "canal", libelle: "Canal" }, { cle: "leads", libelle: "Leads" }, { cle: "taux_rdv", libelle: "Taux RDV (%)" }, { cle: "taux_conversion", libelle: "Conversion (%)" }, { cle: "cout", libelle: "Coût (€)" }, { cle: "cout_par_lead", libelle: "Coût par lead (€)" }, { cle: "cout_par_vente", libelle: "Coût par vente (€)" }, { cle: "delai", libelle: "Délai lead vers RDV (j)" }, { cle: "a_revoir", libelle: "À revoir" }],
    lignes: canauxQualite.map((c) => ({ canal: libelleCanal(c.canal), leads: c.leads, taux_rdv: c.taux_rdv, taux_conversion: c.taux_conversion, cout: c.cout, cout_par_lead: c.cout_par_lead, cout_par_vente: c.cout_par_vente, delai: c.delai_lead_rdv_median, a_revoir: c.a_revoir })),
  } : null);

  // Leads sans RDV planifié : dernière cohorte par agence, huit cohortes pour le périmètre.
  const attenteAgences = AGENCES.map((a) => ({ nom: a.nom, code: a.code, valeur: (attente.donnees ?? []).find((l) => l.agence === a.code && moisDe(l.mois) === moisPublie)?.sans_rdv_48h ?? 0 })).filter((a) => agence === "toutes" || a.code === agence);
  const attenteSerie = moisEntre(ajouterMois(moisPublie, -7), moisPublie).map((m) => ({ mois: m, valeur: (attente.donnees ?? []).find((l) => l.agence === agenceVue && moisDe(l.mois) === m)?.sans_rdv_48h ?? 0 }));
  const attenteTotal = attenteAgences.reduce((s, a) => s + a.valeur, 0);
  const optionAttente = attente.donnees ? optionSansRdv(attenteAgences, attenteSerie, tokens, mobile) : null;

  const clePeriode = `${periode.param}|${agenceVue}`;
  const chargement = funnel.donnees === undefined;
  const mentionMature = cohorte && !cohorte.mature ? " ; cohorte de moins de 90 jours, taux provisoires" : "";

  return (
    <div className="flex flex-col gap-[var(--esp-5)]">
      <header className="flex flex-wrap items-end justify-between gap-[var(--esp-3)]">
        <div>
          <h1 className="font-serif-titre text-[32px] leading-[1.1] text-texte max-md:text-[26px]">
            {agence === "toutes" ? "Où se perd la conversion" : `${nomAgence(agence)} : où se perd la conversion`}
          </h1>
          <p className="mt-1 text-[13px] text-texte-2">
            {periode.libelle} · cohortes de création du lead · comparaison N-1 · {funnel.source === "instantane" ? <Badge variante="instantane">instantané</Badge> : <Badge variante="simule">simulé</Badge>}
          </p>
        </div>
        <p className="text-[12px] text-texte-3">Journée publiée : {filtres.journeePubliee ? formatDateCourte(filtres.journeePubliee) : "n. d."}</p>
      </header>

      {chargement ? (
        <div className="grid gap-[var(--esp-3)] sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((i) => <Squelette key={i} hauteur={132} />)}</div>
      ) : (
        <div className="grid gap-[var(--esp-3)] sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6">
          <CarteKPI libelle="Leads" valeur={cohorte?.leads ?? null} format="nombre" code="LEADS" clePeriode={clePeriode} decalageMs={0}
            serie={serieFunnel("leads")} variation={{ valeur: ecartPct(cohorte?.leads ?? null, cohorteN1?.leads ?? null), unite: "pct", libelle: libelleN1 }} />
          <CarteKPI libelle="Taux de RDV" sousLibelle={sousLibelleTaux("RDV tenus / leads")} valeur={taux(etapes, 1)} format="pct" code="TX_RDV" clePeriode={clePeriode} decalageMs={80}
            serie={serieFunnel("taux_rdv")} variation={{ valeur: ecartPoints(taux(etapes, 1), taux(etapesN1, 1)), unite: "pts", libelle: libelleTauxN1 }} />
          <CarteKPI libelle="Taux de devis" sousLibelle={sousLibelleTaux("devis / RDV tenus")} valeur={taux(etapes, 2)} format="pct" code="TX_DEVIS" clePeriode={clePeriode} decalageMs={160}
            serie={serieFunnel("taux_devis")} variation={{ valeur: ecartPoints(taux(etapes, 2), taux(etapesN1, 2)), unite: "pts", libelle: libelleTauxN1 }} />
          <CarteKPI libelle="Taux de signature" sousLibelle={sousLibelleTaux("signatures / devis")} valeur={taux(etapes, 3)} format="pct" code="TX_SIGN" clePeriode={clePeriode} decalageMs={240}
            serie={serieFunnel("taux_signature")} variation={{ valeur: ecartPoints(taux(etapes, 3), taux(etapesN1, 3)), unite: "pts", libelle: libelleTauxN1 }} />
          <CarteKPI libelle="Coût par lead" valeur={coutsPeriode.cpl} format="eur" code="CPL" clePeriode={clePeriode} decalageMs={320}
            serie={serieCouts("cout_par_lead")} variation={{ valeur: ecartPct(coutsPeriode.cpl, coutsN1?.cpl ?? null), unite: "pct", libelle: n1 ? "vs cohortes N-1" : libelleN1, plusBasMieux: true }} />
          <CarteKPI libelle="Coût par vente" sousLibelle={sousLibelleTaux("hors commissions")} valeur={coutsVente.cpv} format="eur" code="CPV" clePeriode={clePeriode} decalageMs={400}
            serie={serieCouts("cout_par_vente")} variation={{ valeur: ecartPct(coutsVente.cpv, coutsVenteN1?.cpv ?? null), unite: "pct", libelle: libelleTauxN1, plusBasMieux: true }} />
        </div>
      )}

      {optionFlux && cohorteCanal ? (
        <CarteGraphique titre="Du lead à l'encaissement" sousTitre={`${periode.libelle}, ${libelleCanal(canal).toLowerCase()} : ${formatNombre(cohorteCanal.leads)} leads, pertes en branches sortantes, dossiers en attente en gris${mentionMature}`}
          option={optionFlux} hauteur={380} hauteurMobile={560} codeIndicateur="TX_CONV" description={`Sankey du parcours ${periode.libelle} pour ${perimetreLibelle}, ${libelleCanal(canal)} : ${formatNombre(cohorteCanal.leads)} leads, ${formatNombre(cohorteCanal.rdv)} RDV tenus, ${formatNombre(cohorteCanal.devis)} devis, ${formatNombre(cohorteCanal.signatures)} signatures, ${formatNombre(cohorteCanal.poses)} poses, ${formatNombre(cohorteCanal.encaissements)} encaissements`}
          requete={`select * from buta.mart_funnel where agence = '${agenceVue}' and canal = '${canal}' and mois between '${periode.debut}-01' and '${periode.fin}-01'`}
          exportCSV={{ colonnes: [{ cle: "source", libelle: "De" }, { cle: "cible", libelle: "Vers" }, { cle: "valeur", libelle: "Dossiers" }], lignes: (flux?.liens ?? []).map((l) => ({ source: l.source, cible: l.cible, valeur: l.valeur })) }}
          enfantsSous={(
            <div className="flex flex-wrap items-center justify-between gap-[var(--esp-2)]">
              <SelecteurMenu libelle="Canal" options={optionsCanal} valeur={canal} onChange={setCanal} />
              <p className="text-[11px] text-texte-3">Ambre : étapes tenues · rouge : pertes (sans suite, sans devis, refus, annulation) · gris : en attente de pose ou d'encaissement.</p>
            </div>
          )} />
      ) : <Carte titre="Du lead à l'encaissement"><Squelette hauteur={380} /></Carte>}

      <Carte titre="Conversion par canal et agence" sousTitre={`${periode.libelle} : ventes nettes / leads de la cohorte, intensité de la couleur = conversion, trait = volume de leads ; tri par colonne${mentionMature}`} nu actions={<BoutonFiche code="TX_CONV" />}>
        <div className="px-[var(--esp-2)] pb-[var(--esp-3)]">
          {funnelPeriode.donnees === undefined ? <Squelette hauteur={300} /> : (
            <Tableau colonnes={colonnesMatrice} lignes={canauxMatrice} cleLigne={(l) => l.code} compact nomExport="funnel-matrice" />
          )}
        </div>
      </Carte>

      <div className="grid gap-[var(--esp-3)] lg:grid-cols-12">
        {optionCourbe ? (
          <CarteGraphique className="lg:col-span-7" titre="Leads par canal et ventes" sousTitre="Vingt mois de cohortes : leads empilés par canal ; courbe et axe de droite : ventes nettes de la cohorte (les trois dernières cohortes sont encore ouvertes)" option={optionCourbe} hauteur={360} codeIndicateur="LEADS"
            description={`Leads mensuels par canal sur vingt mois pour ${perimetreLibelle}`}
            requete={`select mois, canal, leads, signatures_nettes from buta.mart_funnel where agence = '${agenceVue}' order by mois`}
            exportCSV={{ colonnes: [{ cle: "mois", libelle: "Mois" }, ...canauxCourbe.map((c) => ({ cle: c.code, libelle: c.libelle })), { cle: "ventes", libelle: "Ventes nettes" }],
              lignes: vingtMois.map((m, i) => ({ mois: m, ...Object.fromEntries(canauxCourbe.map((c) => [c.code, c.valeurs[i] ?? 0])), ventes: ventesNettes[i] ?? null })) }} />
        ) : <Carte className="lg:col-span-7" titre="Leads par canal et ventes"><Squelette hauteur={360} /></Carte>}

        {optionAttente ? (
          <CarteGraphique className="lg:col-span-5" titre="Leads sans RDV planifié" sousTitre={`${formatNombre(attenteTotal)} leads de la cohorte ${moisPublie} créés depuis plus de 48 h sans rendez-vous planifié ; huit cohortes en courbe (grain mensuel, à défaut de semaines)`} option={optionAttente} hauteur={360} codeIndicateur="ATTENTE48"
            description={`Leads sans RDV planifié à 48 h par agence et sur huit cohortes pour ${perimetreLibelle}`}
            requete={`select mois, agence, sans_rdv_48h from buta.mart_funnel where canal = 'TOUS' and mois between '${ajouterMois(moisPublie, -7)}-01' and '${moisPublie}-01'`}
            exportCSV={{ colonnes: [{ cle: "agence", libelle: "Agence" }, { cle: "valeur", libelle: "Leads sans RDV à 48 h" }], lignes: attenteAgences.map((a) => ({ agence: a.nom, valeur: a.valeur })) }}
            enfantsSous={<p className="text-[12px] text-texte-2">Relance à 48 h : <Link to="/plans-action" className="text-texte underline-offset-2 hover:underline">plan d'action « rappel des leads sans RDV »</Link> (écran Plans d'action, lot 3).</p>} />
        ) : <Carte className="lg:col-span-5" titre="Leads sans RDV planifié"><Squelette hauteur={360} /></Carte>}
      </div>

      <Carte titre="Qualité des leads par canal" sousTitre={`${periode.libelle} : coûts d'acquisition hors commissions, cohortes de création ; « à revoir » quand le coût par vente dépasse 1,3 fois la médiane des canaux à coût${cohorteEnCours ? " ; cohorte de moins de 90 jours, verdict provisoire" : ""}`} nu actions={<BoutonFiche code="CPV" />}>
        <div className="px-[var(--esp-2)] pb-[var(--esp-3)]">
          {couts.donnees === undefined ? <Squelette hauteur={300} /> : (
            <Tableau colonnes={colonnesQualite} lignes={canauxQualite} cleLigne={(l) => l.canal} triInitial={{ cle: "leads", sens: "desc" }} compact nomExport="funnel-canaux" />
          )}
        </div>
      </Carte>

      <LigneSources simule sources={[{ nom: "Vues mart_funnel, mart_couts_acquisition, dim_canal", ...(filtres.journeePubliee ? { reference: `journée publiée du ${formatDateCourte(filtres.journeePubliee)}` } : {}) }]}
        hypotheses="Cohortes rattachées au mois de création du lead, matures à 90 jours ; aucun objectif de leads dans le modèle (l'objectif est en ventes) ; délai lead vers RDV sur plusieurs mois : médianes mensuelles pondérées par les leads." />
    </div>
  );
}
