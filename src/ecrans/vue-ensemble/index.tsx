import { useMemo } from "react";
import { useNavigate } from "react-router";
import type { EChartsOption } from "echarts";
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
import { Graphique } from "@/graphiques/Graphique";
import { optionBase, useTokensGraphique } from "@/graphiques/theme";
import { useCarte } from "@/graphiques/cartes";
import { agregerFunnel, agregerKpi, ecartPct, ecartPoints, etapesFunnel, moisDe, moisEntre, periodeN1, type CohorteAgregee, type LigneKpi } from "@/lib/periode";
import { formatDateCourte, formatDelaiJours, formatMontant, formatNombre, formatTaux } from "@/lib/format";
import { phrasesDuMois, sommerEffets } from "@/lib/phrases";
import { ExplicationEcart } from "@/composants/ExplicationEcart";
import { JaugeAtterrissage } from "./JaugeAtterrissage";

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function EcranVueEnsemble() {
  const filtres = useFiltres();
  const { periode, comparaison, agenceVue, agence, perimetreLibelle } = filtres;
  const tokens = useTokensGraphique();
  const navigate = useNavigate();

  const kpi = useVue("mart_kpi_mensuel", { egal: { agence: agenceVue }, ordre: "mois" });
  const funnel = useVue("mart_funnel", { egal: { agence: agenceVue, canal: "TOUS" }, ordre: "mois" });
  const forecast = useVue("mart_forecast", { egal: { agence: agenceVue, annee: Number(periode.fin.slice(0, 4)) } });
  const alertes = useVue("mart_alertes");
  const kpiAgences = useVue("mart_kpi_mensuel", { entre: { colonne: "mois", de: `${periode.debut}-01`, a: `${periode.fin}-01` } });
  const ecarts = useVue("mart_ecarts", { egal: { agence: agenceVue, comparaison }, entre: { colonne: "mois", de: `${periode.debut}-01`, a: `${periode.fin}-01` } });
  const agencesDim = useVue("dim_agence");

  const lignesKpi = (kpi.donnees ?? []) as unknown as LigneKpi[];
  const actuel = useMemo(() => agregerKpi(lignesKpi, periode.debut, periode.fin), [lignesKpi, periode.debut, periode.fin]);
  const n1 = periodeN1(periode);
  const prorata = actuel?.prorata ?? 1;
  const precedent = useMemo(() => (n1 ? agregerKpi(lignesKpi, n1.debut, n1.fin, { prorataDernierMois: prorata }) : null), [lignesKpi, n1, prorata]);

  const partiel = prorata < 1 && actuel !== null;
  const mentionProrata = partiel ? ` au prorata (${actuel.jours_publies} j sur ${actuel.jours_mois})` : "";
  const comparaisonLibelle = comparaison === "objectif" ? `vs objectif${partiel ? " prorata" : ""}` : `vs N-1${partiel ? " prorata" : ""}`;
  const caComparaison = comparaison === "objectif" ? actuel?.objectif_ca_prorata ?? null : precedent?.ca_signe ?? null;
  const ventesComparaison = comparaison === "objectif" ? actuel?.objectif_ventes_prorata ?? null : precedent?.ventes ?? null;
  const margeComparaison = precedent?.taux_marge ?? null;

  const douzeMois = useMemo(() => moisEntre(ajouter(periode.fin, -11), periode.fin), [periode.fin]);
  const serie = (cle: keyof LigneKpi) => douzeMois.map((m) => {
    const l = lignesKpi.find((x) => moisDe(x.mois) === m);
    return l ? (l[cle] as number | null) : null;
  });
  const serieTauxMarge = douzeMois.map((m) => {
    const l = kpi.donnees?.find((x) => moisDe(x.mois) === m);
    return l ? l.taux_marge : null;
  });

  const cohortesMatures = (funnel.donnees ?? []).filter((c) => c.cohorte_mature && moisDe(c.mois) <= periode.fin).sort((a, b) => a.mois.localeCompare(b.mois));
  const derniereCohorte = cohortesMatures.at(-1);
  const cohortePrecedente = cohortesMatures.at(-2);
  const cohorteN1 = derniereCohorte ? cohortesMatures.find((c) => moisDe(c.mois) === ajouter(moisDe(derniereCohorte.mois), -12)) : undefined;
  const serieConversion = douzeMois.map((m) => {
    const c = funnel.donnees?.find((x) => moisDe(x.mois) === m);
    return c && c.cohorte_mature ? c.taux_conversion : null;
  });
  const libelleCohorte = derniereCohorte ? `cohorte de ${MOIS_LONGS[Number(derniereCohorte.mois.slice(5, 7)) - 1]}, à 90 jours` : "aucune cohorte mature";

  const cohorteDuMois = useMemo(() => agregerFunnel(funnel.donnees ?? [], periode.debut, periode.fin), [funnel.donnees, periode.debut, periode.fin]);

  const previsions = forecast.donnees?.[0];

  const lignesAgences = useMemo(() => {
    const parAgence = new Map<string, LigneKpi[]>();
    for (const l of (kpiAgences.donnees ?? []) as unknown as (LigneKpi & { agence: string })[]) {
      if (l.agence === "RESEAU") continue;
      const liste = parAgence.get(l.agence) ?? [];
      liste.push(l);
      parAgence.set(l.agence, liste);
    }
    return AGENCES.map((a) => ({ code: a.code, nom: a.nom, kpi: agregerKpi(parAgence.get(a.code) ?? [], periode.debut, periode.fin) })).filter((a) => a.kpi !== null);
  }, [kpiAgences.donnees, periode.debut, periode.fin]);

  const alertesVisibles = (alertes.donnees ?? []).filter((a) => agence === "toutes" || a.agence === agence);

  const phrases = useMemo(() => {
    if (!actuel) return null;
    const effets = sommerEffets((ecarts.donnees ?? []).filter((e) => e.comparaison_disponible).map((e) => ({ total: e.ecart_total, volume: e.effet_volume, mix: e.effet_mix, prix: e.effet_prix, remise: e.effet_remise, residuel: e.residuel })));
    const motif = (ecarts.donnees ?? []).find((e) => !e.comparaison_disponible)?.motif ?? undefined;
    return phrasesDuMois({
      perimetre: perimetreLibelle, periodeLibelle: periode.libelle, comparaisonLibelle: comparaison === "objectif" ? "l'objectif" : "N-1",
      caSigne: actuel.ca_signe, caComparaison, ventes: actuel.ventes, ventesComparaison, tauxMarge: actuel.taux_marge, tauxMargeComparaison: margeComparaison, margeComparaisonLibelle: "N-1",
      ecart: effets, alertes: alertesVisibles.map((a) => a.texte), ...(motif ? { motifSansComparaison: motif } : {}),
      ...(partiel ? { prorata: { joursPublies: actuel.jours_publies, joursMois: actuel.jours_mois } } : {}),
    });
  }, [actuel, ecarts.donnees, perimetreLibelle, periode.libelle, comparaison, caComparaison, ventesComparaison, margeComparaison, alertesVisibles]);

  useDeclarerExport("vue-ensemble-agences", lignesAgences.length ? {
    nom: "Agences",
    colonnes: [{ cle: "agence", libelle: "Agence" }, { cle: "ventes", libelle: "Ventes" }, { cle: "ecart_objectif_pct", libelle: "Écart objectif (%)" }, { cle: "taux_marge", libelle: "Taux de marge (%)" }, { cle: "resultat", libelle: "Résultat (€)" }, { cle: "delai_pose_median", libelle: "Délai de pose (j)" }],
    lignes: lignesAgences.map((a) => ({ agence: a.nom, ventes: a.kpi?.ventes ?? null, ecart_objectif_pct: a.kpi?.ecart_objectif_pct ?? null, taux_marge: a.kpi?.taux_marge ?? null, resultat: a.kpi?.resultat ?? null, delai_pose_median: a.kpi?.delai_pose_median ?? null })),
  } : null);

  const clePeriode = `${periode.param}|${agenceVue}|${comparaison}`;

  const optionFunnel: EChartsOption | null = cohorteDuMois ? construireOptionFunnel(cohorteDuMois, tokens) : null;
  const carte = useCarte("perimetre", "/geo/perimetre.geojson");
  const optionCarte: EChartsOption | null = carte.prete && agencesDim.donnees ? construireOptionCarte(agencesDim.donnees, lignesAgences, tokens) : null;

  const colonnesAgences: Colonne<(typeof lignesAgences)[number]>[] = [
    { cle: "agence", libelle: "Agence", valeur: (l) => l.nom, rendu: (l) => <span className="whitespace-nowrap text-texte">{l.nom}</span> },
    { cle: "ventes", libelle: "Ventes", numerique: true, largeur: "64px", valeur: (l) => l.kpi?.ventes ?? null, rendu: (l) => formatNombre(l.kpi?.ventes ?? null) },
    { cle: "ecart", libelle: "Écart obj.", numerique: true, largeur: "88px", valeur: (l) => l.kpi?.ecart_objectif_pct ?? null, rendu: (l) => (l.kpi?.ecart_objectif_pct === null || l.kpi?.ecart_objectif_pct === undefined ? "n. d." : `${l.kpi.ecart_objectif_pct > 0 ? "+" : ""}${formatTaux(l.kpi.ecart_objectif_pct)}`) },
    { cle: "marge", libelle: "Marge", numerique: true, largeur: "76px", valeur: (l) => l.kpi?.taux_marge ?? null, rendu: (l) => formatTaux(l.kpi?.taux_marge ?? null) },
    { cle: "resultat", libelle: "Résultat", numerique: true, secondaire: true, masquerSous: "2xl", largeur: "84px", valeur: (l) => l.kpi?.resultat ?? null, rendu: (l) => formatMontant(l.kpi?.resultat ?? null) },
    { cle: "delai", libelle: "Délai", numerique: true, secondaire: true, masquerSous: "2xl", largeur: "64px", valeur: (l) => l.kpi?.delai_pose_median ?? null, rendu: (l) => formatDelaiJours(l.kpi?.delai_pose_median ?? null) },
    { cle: "statut", libelle: "Statut", triable: false, valeur: (l) => statutEcart(l.kpi?.ecart_objectif_pct), rendu: (l) => <Pastille statut={statutEcart(l.kpi?.ecart_objectif_pct)} texte={libelleStatut(l.kpi?.ecart_objectif_pct)} /> },
  ];

  const chargement = kpi.donnees === undefined;

  return (
    <div className="flex flex-col gap-[var(--esp-5)]">
      <header className="flex flex-wrap items-end justify-between gap-[var(--esp-3)]">
        <div>
          <h1 className="font-serif-titre text-[32px] leading-[1.1] text-texte max-md:text-[26px]">
            {agence === "toutes" ? "Le réseau" : nomAgence(agence)} {periode.type === "mois" ? "ce mois-ci" : `sur ${periode.libelle}`}
          </h1>
          <p className="mt-1 text-[13px] text-texte-2">
            {periode.libelle} · {comparaison === "objectif" ? "vs objectif" : "vs N-1"}{mentionProrata} · {kpi.source === "instantane" ? <Badge variante="instantane">instantané</Badge> : <Badge variante="simule">simulé</Badge>}
          </p>
        </div>
        <p className="text-[12px] text-texte-3">Journée publiée : {filtres.journeePubliee ? formatDateCourte(filtres.journeePubliee) : "n. d."}</p>
      </header>

      {chargement ? (
        <div className="grid gap-[var(--esp-3)] md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Squelette key={i} hauteur={132} />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--esp-3)] sm:grid-cols-2 md:grid-cols-4">
          <CarteKPI libelle="Ventes signées" valeur={actuel?.ventes ?? null} format="nombre" code="VENTES" clePeriode={clePeriode} decalageMs={0}
            serie={serie("ventes")} variation={{ valeur: ecartPct(actuel?.ventes ?? null, ventesComparaison), unite: "pct", libelle: comparaisonLibelle }} />
          <CarteKPI libelle="CA signé HT" valeur={actuel?.ca_signe ?? null} format="eur" code="CA_SIGNE" clePeriode={clePeriode} decalageMs={80}
            serie={serie("ca_signe")} variation={{ valeur: ecartPct(actuel?.ca_signe ?? null, caComparaison), unite: "pct", libelle: comparaisonLibelle }} />
          <CarteKPI libelle="Taux de marge brute" valeur={actuel?.taux_marge ?? null} format="pct" code="TX_MARGE" clePeriode={clePeriode} decalageMs={160}
            serie={serieTauxMarge} variation={{ valeur: ecartPoints(actuel?.taux_marge ?? null, margeComparaison), unite: "pts", libelle: n1 ? "vs N-1" : "vs N-1 : pas d'historique 2024" }} />
          <CarteKPI libelle="Conversion lead vers vente" sousLibelle={libelleCohorte} valeur={derniereCohorte?.taux_conversion ?? null} format="pct" code="TX_CONV" clePeriode={clePeriode} decalageMs={240}
            serie={serieConversion} variation={{ valeur: ecartPoints(derniereCohorte?.taux_conversion ?? null, comparaison === "n1" ? (cohorteN1?.taux_conversion ?? null) : (cohortePrecedente?.taux_conversion ?? null)), unite: "pts", libelle: comparaison === "n1" ? "vs cohorte N-1" : "vs cohorte précédente" }} />
        </div>
      )}

      <div className="grid gap-[var(--esp-3)] lg:grid-cols-12">
        <Carte titre={`Atterrissage ${periode.fin.slice(0, 4)}`} sousTitre="CA signé HT : réalisé à date, pipe pondéré, run-rate saisonnalisé" className="lg:col-span-7"
          actions={<BoutonFiche code="ATTERR" />}>
          {previsions ? (
            <JaugeAtterrissage realise={previsions.realise_a_date} central={previsions.atterrissage_central} bas={previsions.atterrissage_bas} haut={previsions.atterrissage_haut}
              objectif={previsions.objectif_annuel} probabilite={previsions.probabilite_atteinte} annee={previsions.annee} clePeriode={clePeriode} />
          ) : <Squelette hauteur={140} />}
        </Carte>
        {optionFunnel && cohorteDuMois ? (
          <CarteGraphique className="lg:col-span-5" titre={`Funnel de la cohorte ${periode.type === "mois" ? "du mois" : "de la période"}`}
            sousTitre={cohorteDuMois?.mature ? "Étapes rattachées au mois de création du lead, cohorte mature" : "Cohorte en cours (moins de 90 jours) : taux provisoires"}
            option={optionFunnel} hauteur={260} description={`Funnel ${periode.libelle} : ${cohorteDuMois?.leads ?? 0} leads, ${cohorteDuMois?.signatures ?? 0} signatures`}
            codeIndicateur="TX_CONV" requete={`select * from buta.mart_funnel where agence = '${agenceVue}' and canal = 'TOUS' and mois between '${periode.debut}-01' and '${periode.fin}-01'`}
            exportCSV={{ colonnes: [{ cle: "etape", libelle: "Étape" }, { cle: "valeur", libelle: "Dossiers" }, { cle: "taux", libelle: "Taux étape précédente (%)" }], lignes: etapesFunnel(cohorteDuMois).map((e) => ({ etape: e.nom, valeur: e.valeur, taux: e.taux })) }} />
        ) : <Carte className="lg:col-span-5" titre="Funnel de la cohorte du mois"><Squelette hauteur={260} /></Carte>}
      </div>

      <div className="grid gap-[var(--esp-3)] lg:grid-cols-12">
        <Carte titre="Alertes du matin" {...(filtres.journeePubliee ? { sousTitre: `Calculées par règles sur la journée du ${formatDateCourte(filtres.journeePubliee)}` } : {})} className="lg:col-span-3">
          {alertes.donnees === undefined ? <Squelette hauteur={160} /> : alertesVisibles.length === 0 ? (
            <p className="text-[13px] text-texte-2">Aucune alerte sur ce périmètre. Les douze contrôles et les seuils sont détaillés sur l'écran Qualité.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-bordure">
              {alertesVisibles.map((a) => (
                <li key={`${a.code}-${a.agence}`} className="flex items-start gap-[var(--esp-2)] py-[var(--esp-2)]">
                  <span className={`mt-[6px] h-2 w-2 shrink-0 rounded-full ${a.gravite === "alerte" ? "bg-alerte" : "bg-attention"}`} aria-hidden="true" />
                  <div>
                    <p className="text-[13px] leading-snug text-texte">{a.texte}</p>
                    <p className="text-[11px] text-texte-3">{a.gravite === "alerte" ? "alerte" : "attention"} · {formatDateCourte(a.calcule_le)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte titre="Agences" sousTitre={`${periode.libelle}, écart au CA objectif${mentionProrata}`} className="lg:col-span-6" nu>
          <div className="px-[var(--esp-2)] pb-[var(--esp-3)]">
            {kpiAgences.donnees === undefined ? <Squelette hauteur={300} /> : (
              <Tableau colonnes={colonnesAgences} lignes={lignesAgences} cleLigne={(l) => l.code} triInitial={{ cle: "ventes", sens: "desc" }} compact
                estActive={(l) => l.code === agence} onLigneClic={(l) => filtres.definir("agence", l.code === agence ? "toutes" : l.code)} nomExport="agences" />
            )}
          </div>
        </Carte>

        <Carte titre="Agences simulées" sousTitre="Taille du point : ventes de la période" className="lg:col-span-3">
          {optionCarte ? (
            <Graphique option={optionCarte} hauteur={260} description="Carte des onze départements du périmètre avec les neuf agences simulées"
              onEvenements={{ click: () => navigate("/territoires") }} />
          ) : carte.erreur ? <p className="text-[13px] text-texte-2">Contours indisponibles : {carte.erreur}</p> : <Squelette hauteur={260} />}
          <p className="mt-[var(--esp-2)] text-[11px] text-texte-3">Agences positionnées au centre de leur bassin, aucune implantation réelle. Clic : Territoires.</p>
        </Carte>
      </div>

      <Carte titre="Ce que dit le mois" sousTitre="Trois phrases assemblées par règles à partir des faits SQL ; le bouton demande au modèle une explication rédigée sur les mêmes faits">
        {phrases ? (
          <div className="flex flex-col gap-[var(--esp-3)]">
            <ol className="flex flex-col gap-[var(--esp-2)] text-[15px] leading-relaxed text-texte-2">
              {phrases.map((p, i) => <li key={i} className="flex gap-[var(--esp-3)]"><span className="chiffre text-[12px] text-ambre-texte">{i + 1}</span><span>{p}</span></li>)}
            </ol>
            <ExplicationEcart perimetre={agence === "toutes" ? "reseau" : agence} mois={periode.fin} indicateur="CA" repli={null} libelleBouton="Expliquer avec le modèle" />
          </div>
        ) : <Squelette hauteur={80} />}
      </Carte>

      <LigneSources simule sources={[{ nom: "Vues mart_kpi_mensuel, mart_funnel, mart_forecast, mart_ecarts, mart_alertes", ...(filtres.journeePubliee ? { reference: `journée publiée du ${formatDateCourte(filtres.journeePubliee)}` } : {}) }]}
        hypotheses="Objectif : réalisé 2025 × 1,15 ; N-1 indisponible pour 2025." />
    </div>
  );
}

function ajouter(mois: string, n: number): string {
  const [a, m] = mois.split("-").map(Number) as [number, number];
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function libelleStatut(ecart: number | null | undefined): string {
  const s = statutEcart(ecart);
  return s === "succes" ? "tenu" : s === "attention" ? "proche" : s === "alerte" ? "retrait" : "n. d.";
}

function construireOptionFunnel(c: CohorteAgregee, t: ReturnType<typeof useTokensGraphique>): EChartsOption {
  const etapes = etapesFunnel(c);
  const base = optionBase(t);
  return {
    ...base,
    grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
    xAxis: { ...base.xAxis, type: "value", show: false },
    yAxis: { ...base.yAxis, type: "category", inverse: true, data: etapes.map((e) => e.nom), splitLine: { show: false }, axisLabel: { ...base.yAxis.axisLabel, fontFamily: t.police } },
    tooltip: { ...base.tooltip, trigger: "item", formatter: (p: unknown) => {
      const { name, value, dataIndex } = p as { name: string; value: number; dataIndex: number };
      const taux = etapes[dataIndex]?.taux;
      return `${name} : <b>${formatNombre(value)}</b>${taux === null || taux === undefined ? "" : ` · ${formatTaux(taux)} de l'étape précédente`}`;
    } },
    series: [{
      type: "bar", data: etapes.map((e) => e.valeur), barWidth: 18,
      itemStyle: { color: c.mature ? t.ambre : t.texte3, borderRadius: [0, 4, 4, 0], opacity: c.mature ? 1 : 0.7 },
      label: { show: true, position: "right", color: t.texte2, fontFamily: t.mono, fontSize: 12, formatter: (p: unknown) => {
        const { value, dataIndex } = p as { value: number; dataIndex: number };
        const taux = etapes[dataIndex]?.taux;
        return taux === null || taux === undefined ? formatNombre(value) : `${formatNombre(value)}  ${formatTaux(taux, 0)}`;
      } },
      animationDuration: 800, animationDelay: (i: number) => i * 60,
    }],
  };
}

function construireOptionCarte(
  agences: readonly { code: string; nom_bassin: string; latitude: number; longitude: number }[],
  lignes: readonly { code: string; nom: string; kpi: { ventes: number } | null }[],
  t: ReturnType<typeof useTokensGraphique>,
): EChartsOption {
  const max = Math.max(1, ...lignes.map((l) => l.kpi?.ventes ?? 0));
  return {
    ...optionBase(t),
    tooltip: { ...optionBase(t).tooltip, trigger: "item", formatter: (p: unknown) => {
      const { name, value } = p as { name: string; value: [number, number, number] };
      return `${name} · agence simulée<br/>ventes : <b>${formatNombre(value[2])}</b>`;
    } },
    geo: {
      map: "perimetre", roam: false, silent: true, left: 4, right: 4, top: 4, bottom: 4,
      itemStyle: { areaColor: t.surface2, borderColor: t.ambre, borderWidth: 1 },
      emphasis: { disabled: true },
    },
    series: [{
      type: "scatter", coordinateSystem: "geo",
      data: agences.map((a) => ({ name: a.nom_bassin, value: [a.longitude, a.latitude, lignes.find((l) => l.code === a.code)?.kpi?.ventes ?? 0] })),
      symbolSize: (v: number[]) => 6 + 18 * Math.sqrt((v[2] ?? 0) / max),
      itemStyle: { color: t.ambre, opacity: 0.9, shadowBlur: 12, shadowColor: t.ambre },
      label: { show: false },
    }],
  };
}
