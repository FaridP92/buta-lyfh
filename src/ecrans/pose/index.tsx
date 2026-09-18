import { useMemo } from "react";
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
import { Squelette } from "@/composants/Squelette";
import { useTokensGraphique } from "@/graphiques/theme";
import { useEstMobile } from "@/lib/useEstMobile";
import { formatDateCourte, formatDelaiJours, formatMontant, formatNombre, formatTaux } from "@/lib/format";
import { ajouterMois, ecartPct, ecartPoints, moisDe, moisEntre, periodeN1 } from "@/lib/periode";
import { agregerDelais, agregerEncaissement, agregerEncaissementN1, calendrierCharge, carnetDerniereSemaine, lundiDe, phraseTendanceCarnet, type LigneDelais, type LigneEncaissement, type LignePose } from "@/lib/pose";
import { optionCalendrierCharge, optionDelaiCouverture } from "./options";

export function EcranPose() {
  const filtres = useFiltres();
  const { periode, agenceVue, agence, perimetreLibelle, moisPublie, journeePubliee } = filtres;
  const tokens = useTokensGraphique();
  const mobile = useEstMobile();
  const n1 = periodeN1(periode);
  const journee = journeePubliee ?? `${moisPublie}-01`;

  const delais = useVue("mart_delais", { egal: { agence: agenceVue }, ordre: "mois" });
  const pose = useVue("mart_pose", { entre: { colonne: "semaine", de: `${ajouterMois(moisPublie, -3)}-01`, a: `${ajouterMois(moisPublie, 4)}-01` }, ordre: "semaine" });
  const encaissement = useVue("mart_encaissement", { ordre: "mois" });
  const kpiPeriode = useVue("mart_kpi_mensuel", { egal: { agence: agenceVue }, entre: { colonne: "mois", de: `${periode.debut}-01`, a: `${periode.fin}-01` } });

  const lignesDelais = useMemo(() => ((delais.donnees ?? []) as unknown as (LigneDelais & { departement: string; taux_poses_dans_les_delais: number | null })[]), [delais.donnees]);
  const delaisTous = useMemo(() => lignesDelais.filter((l) => l.departement === "TOUS"), [lignesDelais]);
  const lignesPose = useMemo(() => ((pose.donnees ?? []) as unknown as LignePose[]), [pose.donnees]);
  const lignesEncaissement = useMemo(() => ((encaissement.donnees ?? []) as unknown as (LigneEncaissement & { agence: string })[]), [encaissement.donnees]);
  const encaissementVue = useMemo(() => lignesEncaissement.filter((l) => l.agence === agenceVue), [lignesEncaissement, agenceVue]);

  // KPI : délais et poses sur la période, carnet de la dernière semaine, encaissement de la période et attente du mois publié.
  const delaisPeriode = useMemo(() => agregerDelais(delaisTous, periode.debut, periode.fin), [delaisTous, periode.debut, periode.fin]);
  const delaisN1 = useMemo(() => (n1 ? agregerDelais(delaisTous, n1.debut, n1.fin) : null), [delaisTous, n1]);
  const carnet = useMemo(() => carnetDerniereSemaine(lignesPose, agenceVue, journee), [lignesPose, agenceVue, journee]);
  const encaissePeriode = useMemo(() => agregerEncaissement(encaissementVue, periode.debut, periode.fin), [encaissementVue, periode.debut, periode.fin]);
  const prorataParMois = useMemo(() => new Map((kpiPeriode.donnees ?? []).map((l) => [moisDe(l.mois), l.prorata ?? 1] as const)), [kpiPeriode.donnees]);
  const prorataApplique = [...prorataParMois.values()].some((v) => v < 1);
  const encaisseN1 = useMemo(() => (n1 ? agregerEncaissementN1(encaissementVue, periode.debut, periode.fin, prorataParMois) : null), [encaissementVue, periode.debut, periode.fin, prorataParMois, n1]);
  const attente = encaissementVue.find((l) => moisDe(l.mois) === moisPublie) ?? null;
  const libelleN1 = n1 ? "vs N-1" : "vs N-1 : pas d'historique 2024";
  const libelleN1Prorata = n1 ? `vs N-1${prorataApplique ? " au prorata" : ""}` : libelleN1;

  const douzeMois = useMemo(() => moisEntre(ajouterMois(periode.fin, -11), periode.fin), [periode.fin]);
  const serieDelais = (cle: "delai_signature_pose_median" | "taux_poses_dans_les_delais") => douzeMois.map((m) => {
    const l = delaisTous.find((x) => moisDe(x.mois) === m);
    return l ? l[cle] : null;
  });
  const serieEncaisse = douzeMois.map((m) => encaissementVue.find((x) => moisDe(x.mois) === m)?.encaisse ?? null);
  const serieCarnet = useMemo(() => {
    const semaines = [...new Set(lignesPose.filter((l) => l.agence === agenceVue && l.carnet_jours_ouvres !== null && l.semaine.slice(0, 10) <= lundiDe(journee)).map((l) => l.semaine.slice(0, 10)))].sort().slice(-12);
    return semaines.map((s) => lignesPose.find((l) => l.agence === agenceVue && l.semaine.slice(0, 10) === s)?.carnet_jours_ouvres ?? null);
  }, [lignesPose, agenceVue, journee]);

  // Calendrier de charge : agences (ou l'agence choisie), quatre semaines réalisées puis douze planifiées.
  const agencesCalendrier = agence === "toutes" ? AGENCES.map((a) => ({ code: a.code, nom: a.nom })) : AGENCES.filter((a) => a.code === agence).map((a) => ({ code: a.code, nom: a.nom }));
  const calendrier = useMemo(() => calendrierCharge(lignesPose, journee, agencesCalendrier.map((a) => a.code)), [lignesPose, journee, agencesCalendrier]); // eslint-disable-line react-hooks/exhaustive-deps
  const optionCalendrier = calendrier.semaines.length > 0 ? optionCalendrierCharge(calendrier.semaines, agencesCalendrier, calendrier.cellules, tokens, mobile) : null;

  // Délai par couverture : douze mois, sur place contre à distance (lignes SUR_PLACE et A_DISTANCE de la vue).
  const serieCouverture = (departement: "SUR_PLACE" | "A_DISTANCE") => douzeMois.map((m) => lignesDelais.find((l) => l.departement === departement && moisDe(l.mois) === m)?.delai_signature_pose_median ?? null);
  const optionCouverture = lignesDelais.length > 0 ? optionDelaiCouverture(douzeMois, serieCouverture("SUR_PLACE"), serieCouverture("A_DISTANCE"), tokens, mobile) : null;
  const dernierMoisCouverture = [...lignesDelais].filter((l) => l.departement === "A_DISTANCE").sort((a, b) => a.mois.localeCompare(b.mois)).at(-1);
  const surPlaceDernier = dernierMoisCouverture ? lignesDelais.find((l) => l.departement === "SUR_PLACE" && l.mois === dernierMoisCouverture.mois) : undefined;

  // Tableau encaissement par agence : encaissé de la période (sommes), attente et aides du mois publié.
  const lignesAgences = useMemo(() => AGENCES.map((a) => {
    const propres = lignesEncaissement.filter((l) => l.agence === a.code);
    const p = agregerEncaissement(propres, periode.debut, periode.fin);
    const courant = propres.find((l) => moisDe(l.mois) === moisPublie);
    const c = carnetDerniereSemaine(lignesPose, a.code, journee);
    return { code: a.code, nom: a.nom, encaisse: p?.encaisse ?? null, encaissements: p?.encaissements ?? null, delai: p?.delaiPoseEncaissement ?? null, en_attente: courant?.en_attente_encaissement ?? null, retards: courant?.retards_encaissement ?? null, aides: courant?.aides_en_attente ?? null, carnet: c?.carnet ?? null, poses_en_retard: c?.posesEnRetard ?? null };
  }), [lignesEncaissement, lignesPose, periode.debut, periode.fin, moisPublie, journee]);
  const colonnes: Colonne<(typeof lignesAgences)[number]>[] = [
    { cle: "nom", libelle: "Agence", rendu: (l) => <span className="whitespace-nowrap text-texte">{l.nom}</span> },
    { cle: "encaisse", libelle: "Encaissé", numerique: true, largeur: "96px", rendu: (l) => formatMontant(l.encaisse) },
    { cle: "delai", libelle: "Pose vers encaissement", numerique: true, largeur: "110px", secondaire: true, rendu: (l) => formatDelaiJours(l.delai) },
    { cle: "en_attente", libelle: "En attente", numerique: true, largeur: "96px", rendu: (l) => formatMontant(l.en_attente) },
    { cle: "retards", libelle: "Retards", numerique: true, largeur: "76px", secondaire: true, rendu: (l) => (l.retards === null ? "n. d." : formatNombre(l.retards)) },
    { cle: "aides", libelle: "Aides en attente", numerique: true, largeur: "110px", secondaire: true, rendu: (l) => formatMontant(l.aides) },
    { cle: "carnet", libelle: "Carnet (j. ouvrés)", numerique: true, largeur: "104px", rendu: (l) => (l.carnet === null ? "n. d." : formatNombre(Math.round(l.carnet))) },
    { cle: "poses_en_retard", libelle: "Poses en retard", numerique: true, largeur: "104px", valeur: (l) => l.poses_en_retard, rendu: (l) => (l.poses_en_retard === null ? <span className="text-texte-3">n. d.</span> : l.poses_en_retard >= 5 ? <Pastille statut="alerte" texte={formatNombre(l.poses_en_retard)} /> : <Pastille statut={l.poses_en_retard > 0 ? "attention" : "succes"} texte={formatNombre(l.poses_en_retard)} />) },
  ];
  useDeclarerExport("pose-agences", lignesAgences.length ? {
    nom: "Pose et encaissement par agence",
    colonnes: [{ cle: "nom", libelle: "Agence" }, { cle: "encaisse", libelle: "Encaissé (€)" }, { cle: "encaissements", libelle: "Encaissements" }, { cle: "delai", libelle: "Délai pose vers encaissement (j)" }, { cle: "en_attente", libelle: "En attente d'encaissement (€)" }, { cle: "retards", libelle: "Retards d'encaissement" }, { cle: "aides", libelle: "Aides en attente (€)" }, { cle: "carnet", libelle: "Carnet (jours ouvrés)" }, { cle: "poses_en_retard", libelle: "Poses en retard" }],
    lignes: lignesAgences.map(({ code: _code, ...reste }) => reste),
  } : null);

  const clePeriode = `${periode.param}|${agenceVue}`;
  const chargement = delais.donnees === undefined || pose.donnees === undefined || encaissement.donnees === undefined;

  return (
    <div className="flex flex-col gap-[var(--esp-5)]">
      <header className="flex flex-wrap items-end justify-between gap-[var(--esp-3)]">
        <div>
          <h1 className="font-serif-titre text-[32px] leading-[1.1] text-texte max-md:text-[26px]">
            {agence === "toutes" ? "Ce qui est signé et pas encore posé" : `${nomAgence(agence)} : signé, pas encore posé`}
          </h1>
          <p className="mt-1 text-[13px] text-texte-2">{periode.libelle} · délais de pose, charge des équipes, encaissement · {delais.source === "instantane" ? <Badge variante="instantane">instantané</Badge> : <Badge variante="simule">simulé</Badge>}</p>
        </div>
        <p className="text-[12px] text-texte-3">Journée publiée : {journeePubliee ? formatDateCourte(journeePubliee) : "n. d."}</p>
      </header>

      {chargement ? (
        <div className="grid grid-cols-1 gap-[var(--esp-3)] sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((i) => <Squelette key={i} hauteur={132} />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--esp-3)] sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6">
          <CarteKPI libelle="Délai signature vers pose" sousLibelle="médiane, jours" valeur={delaisPeriode?.delaiSignaturePose ?? null} format="jours" code="D_SIGN_POSE" clePeriode={clePeriode} decalageMs={0}
            serie={serieDelais("delai_signature_pose_median")} variation={{ valeur: ecartPct(delaisPeriode?.delaiSignaturePose ?? null, delaisN1?.delaiSignaturePose ?? null), unite: "pct", libelle: libelleN1, plusBasMieux: true }} />
          <CarteKPI libelle="Poses dans les délais" sousLibelle="à moins de 60 jours" valeur={delaisPeriode?.tauxDansLesDelais ?? null} format="pct" code="POSE_DELAI" clePeriode={clePeriode} decalageMs={80}
            serie={serieDelais("taux_poses_dans_les_delais")} variation={{ valeur: ecartPoints(delaisPeriode?.tauxDansLesDelais ?? null, delaisN1?.tauxDansLesDelais ?? null), unite: "pts", libelle: libelleN1 }} />
          <CarteKPI libelle="Carnet de pose" sousLibelle={carnet ? `jours ouvrés, semaine du ${formatDateCourte(carnet.semaine)}` : "jours ouvrés"} valeur={carnet?.carnet ?? null} format="jours" code="CARNET" clePeriode={clePeriode} decalageMs={160}
            serie={serieCarnet} variation={{ valeur: ecartPct(carnet?.carnet ?? null, carnet?.carnetPrecedent ?? null), unite: "pct", libelle: "vs semaine précédente", plusBasMieux: true }} />
          <CarteKPI libelle="Encaissé" sousLibelle="HT, sur la période" valeur={encaissePeriode?.encaisse ?? null} format="eur" code="ENCAISSE" clePeriode={clePeriode} decalageMs={240}
            serie={serieEncaisse} variation={{ valeur: ecartPct(encaissePeriode?.encaisse ?? null, encaisseN1?.encaisse ?? null), unite: "pct", libelle: libelleN1Prorata }} />
          <CarteKPI libelle="En attente d'encaissement" sousLibelle={`posé, non encaissé au ${formatDateCourte(journee)} · ${attente?.retards_encaissement ? `${formatNombre(attente.retards_encaissement)} dossier${attente.retards_encaissement > 1 ? "s" : ""} à plus de 30 jours` : "aucun retard à 30 jours"}`} valeur={attente?.en_attente_encaissement ?? null} format="eur" code="D_ENCAISSE" clePeriode={clePeriode} decalageMs={320} />
          <CarteKPI libelle="Aides en attente" sousLibelle="mandat financier simulé : avancées par l'installateur, versées 90 jours après la pose" valeur={attente?.aides_en_attente ?? null} format="eur" code="AIDES_ATT" clePeriode={clePeriode} decalageMs={400} />
        </div>
      )}

      {!optionCalendrier && (
        <Carte titre="Calendrier de charge des équipes de pose" sousTitre="Chargement des semaines"><Squelette hauteur={agencesCalendrier.length > 1 ? 380 : 180} /></Carte>
      )}
      {optionCalendrier ? (
        <CarteGraphique titre="Calendrier de charge des équipes de pose" sousTitre={`${perimetreLibelle} : charge en part de la capacité (techniciens actifs × 5 jours), quatre semaines réalisées (cadre plein) puis la semaine en cours et onze semaines planifiées (cadre pointillé) ; au-delà de 100 %, surcharge en rouge ; case vide : aucune pose cette semaine-là`}
          option={optionCalendrier} hauteur={agencesCalendrier.length > 1 ? 380 : 180} hauteurMobile={agencesCalendrier.length > 1 ? 420 : 200} codeIndicateur="PROD_TECH"
          description={`Calendrier de charge semaine × agence pour ${perimetreLibelle} : ${calendrier.semaines.length} semaines, charge réalisée puis planifiée en pourcentage de la capacité`}
          requete={`select semaine, agence, capacite_jt_semaine, jt_poses, poses_planifiees, charge_planifiee_pct from buta.mart_pose where semaine between '${ajouterMois(moisPublie, -3)}-01' and '${ajouterMois(moisPublie, 4)}-01'`}
          exportCSV={{ colonnes: [{ cle: "semaine", libelle: "Semaine" }, { cle: "agence", libelle: "Agence" }, { cle: "type", libelle: "Type" }, { cle: "charge", libelle: "Charge (%)" }, { cle: "poses", libelle: "Poses" }], lignes: calendrier.cellules.map((c) => ({ semaine: c.semaine, agence: nomAgence(c.agence), type: c.type === "realisee" ? "réalisée" : "planifiée", charge: c.charge, poses: c.poses })) }} />
      ) : null}

      <div className="grid gap-[var(--esp-3)] lg:grid-cols-12">
        {!optionCouverture && (
          <Carte className="lg:col-span-7" titre="Délai de pose : sur place contre à distance" sousTitre="Chargement des douze mois"><Squelette hauteur={300} /></Carte>
        )}
        {optionCouverture ? (
          <CarteGraphique className="lg:col-span-7" titre="Délai de pose : sur place contre à distance" sousTitre={`${perimetreLibelle}, douze mois : médiane signature vers pose selon que le département a une agence ou est couvert à distance (H5)`}
            option={optionCouverture} hauteur={300} codeIndicateur="D_SIGN_POSE"
            description={`Délai médian de pose sur douze mois pour ${perimetreLibelle} : sur place ${surPlaceDernier ? formatDelaiJours(surPlaceDernier.delai_signature_pose_median) : "n. d."}, à distance ${dernierMoisCouverture ? formatDelaiJours(dernierMoisCouverture.delai_signature_pose_median) : "n. d."} au dernier mois`}
            requete={`select mois, departement, delai_signature_pose_median from buta.mart_delais where agence = '${agenceVue}' and departement in ('SUR_PLACE', 'A_DISTANCE') order by mois`}
            exportCSV={{ colonnes: [{ cle: "mois", libelle: "Mois" }, { cle: "sur_place", libelle: "Sur place (j)" }, { cle: "a_distance", libelle: "À distance (j)" }], lignes: douzeMois.map((m, i) => ({ mois: m, sur_place: serieCouverture("SUR_PLACE")[i] ?? null, a_distance: serieCouverture("A_DISTANCE")[i] ?? null })) }}
            enfantsSous={dernierMoisCouverture && surPlaceDernier ? (
              <p className="text-[12px] leading-[1.5] text-texte-2">
                Dernier mois : {formatDelaiJours(surPlaceDernier.delai_signature_pose_median)} sur place ({formatTaux(surPlaceDernier.taux_poses_dans_les_delais, 0)} de poses à moins de 60 jours) contre {formatDelaiJours(dernierMoisCouverture.delai_signature_pose_median)} à distance ({formatTaux(dernierMoisCouverture.taux_poses_dans_les_delais, 0)}). La distance se paie en délai, puis en annulations (écran Ventes et marge).
              </p>
            ) : undefined} />
        ) : null}
        <Carte className="lg:col-span-5" titre="Ce que dit le carnet" sousTitre="Lecture par règles, à la dernière semaine renseignée" actions={<BoutonFiche code="CARNET" />}>
          {carnet ? (
            <ul className="flex flex-col gap-[var(--esp-2)] text-[13px] leading-[1.5] text-texte-2">
              <li><span className="chiffre text-texte">{carnet.carnet === null ? "n. d." : formatNombre(Math.round(carnet.carnet))}</span> jours ouvrés de carnet pour {perimetreLibelle} la semaine du {formatDateCourte(carnet.semaine)}{phraseTendanceCarnet(carnet.carnet, carnet.carnetPrecedent)}.</li>
              <li><span className="chiffre text-texte">{carnet.dossiersAPoser === null ? "n. d." : formatNombre(carnet.dossiersAPoser)}</span> dossiers signés à poser, dont <span className="chiffre text-texte">{carnet.posesEnRetard === null ? "n. d." : formatNombre(carnet.posesEnRetard)}</span> en retard (signés depuis plus de 60 jours sur place, 90 à distance).</li>
              <li>Un carnet qui dépasse 1,3 fois la médiane des douze semaines précédentes déclenche l'alerte « carnet de pose » de la Vue d'ensemble ; la capacité se lit sur le calendrier ci-dessus.</li>
            </ul>
          ) : <p className="text-[13px] text-texte-3">Aucune semaine renseignée pour {perimetreLibelle}.</p>}
        </Carte>
      </div>

      <Carte titre="Encaissement et carnet par agence" sousTitre={`Encaissé sur ${periode.libelle} ; attente, retards (plus de 30 jours après la pose) et aides au ${formatDateCourte(journee)} ; carnet et poses en retard à la dernière semaine`} nu actions={<BoutonFiche code="D_ENCAISSE" />}>
        {chargement ? <Squelette hauteur={360} /> : (
          <Tableau colonnes={colonnes} lignes={lignesAgences} cleLigne={(l) => l.code} triInitial={{ cle: "en_attente", sens: "desc" }} estActive={(l) => l.code === agence} compact nomExport="pose-encaissement-agences" />
        )}
      </Carte>

      <LigneSources simule sources={[{ nom: "Vues mart_delais, mart_pose, mart_encaissement", ...(journeePubliee ? { reference: `journée publiée du ${formatDateCourte(journeePubliee)}` } : {}) }]}
        hypotheses="Délais : médianes mensuelles, pondérées par les poses sur plusieurs mois ; capacité = techniciens actifs × 5 jours, carnet = charge restante / (techniciens × 0,8) ; aides en mandat financier (hypothèse de simulation), versées 90 jours après la pose ; poses planifiées = dossiers signés dont la pose simulée tombe dans la semaine." />
    </div>
  );
}
