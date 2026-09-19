import { useId, useMemo, useState } from "react";
import { AGENCES, nomAgence, useFiltres } from "@/app/filtres";
import { useDeclarerExport } from "@/app/exportEcran";
import { useVue } from "@/donnees/useVue";
import { Carte } from "@/composants/Carte";
import { CarteGraphique } from "@/composants/CarteGraphique";
import { Tableau, type Colonne } from "@/composants/Tableau";
import { Pastille, statutEcart } from "@/composants/Pastille";
import { Badge } from "@/composants/Badge";
import { BoutonFiche } from "@/composants/FicheIndicateur";
import { LigneSources } from "@/composants/LigneSources";
import { Squelette } from "@/composants/Squelette";
import { useTokensGraphique } from "@/graphiques/theme";
import { useEstMobile } from "@/lib/useEstMobile";
import { agregerKpi, moisDe, type LigneKpi } from "@/lib/periode";
import { formatDateCourte, formatMontant, formatNombre, formatProbabilite, formatTaux } from "@/lib/format";
import { projectionRetenue, recalculerAtterrissage, risquesEtOpportunites, trajectoire, type AgenceAtterrissage, type HypothesesAtterrissage } from "@/lib/forecast";
import { optionEventail } from "./options";

function joursAvant(date: string, jours: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - jours);
  return d.toISOString().slice(0, 10);
}

export function EcranForecast() {
  const filtres = useFiltres();
  const { periode, agenceVue, agence, perimetreLibelle } = filtres;
  const tokens = useTokensGraphique();
  const mobile = useEstMobile();
  const idCurseur = useId();
  const annee = Number(periode.fin.slice(0, 4));
  const moisCourant = filtres.journeePubliee && filtres.journeePubliee.startsWith(String(annee)) ? Number(filtres.journeePubliee.slice(5, 7)) : 12;
  const [curseur, setCurseur] = useState<number | null>(null);

  const forecast = useVue("mart_forecast", { egal: { annee } });
  const kpi = useVue("mart_kpi_mensuel", { entre: { colonne: "mois", de: `${annee}-01-01`, a: `${annee}-12-01` }, ordre: "mois" });
  const objectifs = useVue("mart_objectif_mensuel", { egal: { agence: agenceVue }, entre: { colonne: "mois", de: `${annee}-01-01`, a: `${annee}-12-01` }, ordre: "mois" });
  const poses = useVue("mart_pose", filtres.journeePubliee ? { entre: { colonne: "semaine", de: joursAvant(filtres.journeePubliee, 13), a: filtres.journeePubliee }, ordre: "semaine" } : { limite: 1 });

  const ligne = forecast.donnees?.find((f) => f.agence === agenceVue);
  const hypotheses: HypothesesAtterrissage | null = ligne
    ? { realiseADate: ligne.realise_a_date, objectifAnnuel: ligne.objectif_annuel, pipePondere: ligne.pipe_pondere, montantDevisEnCours: ligne.montant_devis_en_cours, projectionRunRate: ligne.projection_run_rate, moisRestants: ligne.mois_restants, sigmaMensuel: ligne.sigma_mensuel }
    : null;
  const tauxObserve = ligne?.taux_signature_pipe ?? null;
  const tauxCurseur = curseur ?? tauxObserve ?? 0;
  const curseurActif = curseur !== null && tauxObserve !== null && Math.abs(curseur - tauxObserve) > 0.01;
  const atterrissage = hypotheses ? recalculerAtterrissage(hypotheses, curseurActif ? tauxCurseur : undefined) : null;

  const lignesKpi = useMemo(() => ((kpi.donnees ?? []) as unknown as (LigneKpi & { agence: string })[]), [kpi.donnees]);
  const mensuelVue = useMemo(() => {
    const propres = lignesKpi.filter((l) => l.agence === agenceVue);
    const realise: (number | null)[] = [];
    const objectif: (number | null)[] = [];
    for (let m = 1; m <= 12; m++) {
      const mois = `${annee}-${String(m).padStart(2, "0")}`;
      const l = propres.find((x) => moisDe(x.mois) === mois);
      realise.push(l ? l.ca_signe : null);
      const o = objectifs.donnees?.find((x) => moisDe(x.mois) === mois);
      objectif.push(o ? o.objectif_ca : null);
    }
    return { realise, objectif };
  }, [lignesKpi, objectifs.donnees, agenceVue, annee]);
  const traj = hypotheses ? trajectoire(annee, moisCourant, mensuelVue.realise, mensuelVue.objectif, hypotheses, curseurActif ? tauxCurseur : undefined) : null;
  const optionFan = traj && hypotheses ? optionEventail(traj, moisCourant, hypotheses.objectifAnnuel, filtres.journeePubliee ? formatDateCourte(filtres.journeePubliee) : "", tokens, mobile) : null;

  // Agences : atterrissage SQL (le curseur ne s'applique qu'au périmètre affiché), panier moyen de l'année pour le CA posé à risque.
  const lignesAgences = useMemo<AgenceAtterrissage[]>(() => {
    const lignes: AgenceAtterrissage[] = [];
    for (const a of AGENCES) {
      const f = forecast.donnees?.find((x) => x.agence === a.code);
      if (!f) continue;
      lignes.push({ code: a.code, nom: a.nom, realise: f.realise_a_date, objectif: f.objectif_annuel, central: f.atterrissage_central, bas: f.atterrissage_bas, haut: f.atterrissage_haut, probabilite: f.probabilite_atteinte, ecartPct: f.ecart_atterrissage_pct, pipePondere: f.pipe_pondere, montantDevis: f.montant_devis_en_cours, runRate3m: f.run_rate_3m });
    }
    return lignes;
  }, [forecast.donnees]);
  const posesAgences = useMemo(() => AGENCES.map((a) => {
    const semaines = (poses.donnees ?? []).filter((p) => p.agence === a.code && p.poses_en_retard !== null).sort((x, y) => y.semaine.localeCompare(x.semaine));
    const derniere = semaines[0];
    const kpiAnnee = agregerKpi(lignesKpi.filter((l) => l.agence === a.code), `${annee}-01`, `${annee}-12`);
    return { code: a.code, posesEnRetard: derniere?.poses_en_retard ?? null, panierMoyen: kpiAnnee?.panier_moyen ?? null, semaine: derniere?.semaine ?? null };
  }), [poses.donnees, lignesKpi, annee]);
  const signaux = useMemo(() => risquesEtOpportunites(lignesAgences.filter((a) => agence === "toutes" || a.code === agence), posesAgences), [lignesAgences, posesAgences, agence]);
  const risques = signaux.filter((s) => s.type === "risque");
  const opportunites = signaux.filter((s) => s.type === "opportunite");

  useDeclarerExport("forecast-agences", lignesAgences.length ? {
    nom: "Atterrissage par agence",
    colonnes: [{ cle: "agence", libelle: "Agence" }, { cle: "realise", libelle: "Réalisé à date (€)" }, { cle: "objectif", libelle: "Objectif (€)" }, { cle: "central", libelle: "Atterrissage central (€)" }, { cle: "bas", libelle: "Bas (€)" }, { cle: "haut", libelle: "Haut (€)" }, { cle: "ecart", libelle: "Écart (%)" }, { cle: "probabilite", libelle: "Probabilité (%)" }, { cle: "pipe", libelle: "Pipe pondéré (€)" }, { cle: "run_rate", libelle: "Run-rate 3 mois (€)" }],
    lignes: lignesAgences.map((a) => ({ agence: a.nom, realise: a.realise, objectif: a.objectif, central: a.central, bas: a.bas, haut: a.haut, ecart: a.ecartPct, probabilite: a.probabilite, pipe: a.pipePondere, run_rate: a.runRate3m })),
  } : null);

  const colonnes: Colonne<AgenceAtterrissage>[] = [
    { cle: "agence", libelle: "Agence", valeur: (l) => l.nom, rendu: (l) => <span className="whitespace-nowrap text-texte">{l.nom}</span> },
    { cle: "realise", libelle: "Réalisé à date", numerique: true, largeur: "104px", valeur: (l) => l.realise, rendu: (l) => formatMontant(l.realise) },
    { cle: "objectif", libelle: "Objectif", numerique: true, largeur: "92px", valeur: (l) => l.objectif, rendu: (l) => formatMontant(l.objectif) },
    { cle: "central", libelle: "Central", numerique: true, largeur: "92px", valeur: (l) => l.central, rendu: (l) => formatMontant(l.central) },
    { cle: "intervalle", libelle: "Bas à haut", numerique: true, secondaire: true, largeur: "150px", triable: false, valeur: (l) => l.bas, rendu: (l) => <span className="whitespace-nowrap">{formatMontant(l.bas)} à {formatMontant(l.haut)}</span> },
    { cle: "ecart", libelle: "Écart", numerique: true, largeur: "84px", valeur: (l) => l.ecartPct, rendu: (l) => (l.ecartPct === null ? "n. d." : `${l.ecartPct > 0 ? "+" : ""}${formatTaux(l.ecartPct)}`) },
    { cle: "probabilite", libelle: "Probabilité", numerique: true, largeur: "96px", valeur: (l) => l.probabilite, rendu: (l) => formatProbabilite(l.probabilite) },
    { cle: "pipe", libelle: "Pipe pondéré", numerique: true, secondaire: true, largeur: "104px", valeur: (l) => l.pipePondere, rendu: (l) => formatMontant(l.pipePondere) },
    { cle: "statut", libelle: "Statut", triable: false, valeur: (l) => statutEcart(l.ecartPct), rendu: (l) => <Pastille statut={statutEcart(l.ecartPct)} texte={libelleStatut(l.ecartPct)} /> },
  ];

  const chargement = forecast.donnees === undefined || kpi.donnees === undefined || objectifs.donnees === undefined;
  const journeeLibelle = filtres.journeePubliee ? formatDateCourte(filtres.journeePubliee) : "n. d.";
  const curseurMax = Math.max(40, Math.ceil((tauxObserve ?? 0) * 2));

  return (
    <div className="flex flex-col gap-[var(--esp-5)]">
      <header className="flex flex-wrap items-end justify-between gap-[var(--esp-3)]">
        <div>
          <h1 className="font-serif-titre text-[32px] leading-[1.1] text-texte max-md:text-[26px]">
            {agence === "toutes" ? `Où finit l'année ${annee}` : `${nomAgence(agence)} : où finit l'année ${annee}`}
          </h1>
          <p className="mt-1 text-[13px] text-texte-2">
            {periode.libelle} · vs objectif annuel · {forecast.source === "instantane" ? <Badge variante="instantane">instantané</Badge> : <Badge variante="simule">simulé</Badge>}
          </p>
        </div>
        <p className="text-[12px] text-texte-3">Journée publiée : {journeeLibelle}</p>
      </header>

      <div className="grid gap-[var(--esp-3)] lg:grid-cols-12">
        {chargement || !optionFan || !atterrissage || !hypotheses ? (
          <Carte className="lg:col-span-8" titre={`Éventail d'atterrissage ${annee}`}><Squelette hauteur={360} /></Carte>
        ) : (
          <CarteGraphique className="lg:col-span-8" titre={`Éventail d'atterrissage ${annee}`} sousTitre={`CA signé HT cumulé pour ${perimetreLibelle} : réalisé, objectif, projection et intervalle à 68 %${curseurActif ? ` ; hypothèse testée : pipe signé à ${formatTaux(tauxCurseur)}` : ""}`}
            option={optionFan} hauteur={360} codeIndicateur="ATTERR" description={`Éventail d'atterrissage ${annee} : réalisé ${formatMontant(hypotheses.realiseADate)}, central ${formatMontant(atterrissage.central)}, bas ${formatMontant(atterrissage.bas)}, haut ${formatMontant(atterrissage.haut)}, objectif ${formatMontant(hypotheses.objectifAnnuel)}`}
            requete={`select * from buta.mart_forecast where agence = '${agenceVue}' and annee = ${annee}`}
            exportCSV={{ colonnes: [{ cle: "mois", libelle: "Mois" }, { cle: "realise", libelle: "Réalisé cumulé (€)" }, { cle: "objectif", libelle: "Objectif cumulé (€)" }, { cle: "central", libelle: "Central (€)" }, { cle: "bas", libelle: "Bas (€)" }, { cle: "haut", libelle: "Haut (€)" }],
              lignes: traj ? traj.mois.map((m, i) => ({ mois: m, realise: traj.realiseCumule[i] ?? null, objectif: traj.objectifCumule[i] ?? null, central: traj.central[i] ?? null, bas: traj.bas[i] ?? null, haut: traj.haut[i] ?? null })) : [] }}
            enfantsSous={(
              <dl className="grid grid-cols-2 gap-x-[var(--esp-4)] gap-y-1 text-[12px] sm:grid-cols-4">
                <div><dt className="text-texte-3">Atterrissage central</dt><dd className="chiffre text-[15px] text-texte">{formatMontant(atterrissage.central)}</dd></div>
                <div><dt className="text-texte-3">Intervalle à 68 %</dt><dd className="chiffre text-[15px] text-texte">{formatMontant(atterrissage.bas)} à {formatMontant(atterrissage.haut)}</dd></div>
                <div><dt className="text-texte-3">Écart à l'objectif</dt><dd className={`chiffre text-[15px] ${atterrissage.ecartPct !== null && atterrissage.ecartPct < 0 ? "text-alerte" : "text-succes"}`}>{atterrissage.ecartPct === null ? "n. d." : `${atterrissage.ecartPct > 0 ? "+" : ""}${formatTaux(atterrissage.ecartPct)}`}</dd></div>
                <div><dt className="text-texte-3">Probabilité d'atteinte</dt><dd className="chiffre text-[15px] text-texte">{formatProbabilite(atterrissage.probabilite)}</dd></div>
              </dl>
            )} />
        )}

        <Carte className="lg:col-span-4" titre="Hypothèses" sousTitre="Valeurs observées sur douze mois, recalcul local sans écriture" actions={<BoutonFiche code="PIPE_POND" />}>
          {!ligne || !atterrissage ? <Squelette hauteur={360} /> : (
            <div className="flex flex-col gap-[var(--esp-3)] text-[13px]">
              <dl className="grid grid-cols-[1fr_auto] gap-x-[var(--esp-3)] gap-y-[6px]">
                <dt className="text-texte-2">Devis en cours (moins de 90 jours)</dt><dd className="chiffre text-right text-texte">{formatNombre(ligne.devis_en_cours)} · {formatMontant(ligne.montant_devis_en_cours)}</dd>
                <dt className="text-texte-2">Signature observée, devis de 0 à 30 jours</dt><dd className="chiffre text-right text-texte">{formatTaux(ligne.taux_signature_0_30)}</dd>
                <dt className="text-texte-2">Devis de 31 à 60 jours</dt><dd className="chiffre text-right text-texte">{formatTaux(ligne.taux_signature_31_60)}</dd>
                <dt className="text-texte-2">Devis de 61 à 90 jours</dt><dd className="chiffre text-right text-texte">{formatTaux(ligne.taux_signature_61_90)}</dd>
                <dt className="text-texte-2">Annulation à six mois</dt><dd className="chiffre text-right text-texte">{formatTaux(ligne.taux_annulation_6m)}</dd>
                <dt className="text-texte-2">Pipe pondéré</dt><dd className="chiffre text-right text-texte">{formatMontant(atterrissage.pipe)}</dd>
                <dt className="text-texte-2">Run-rate trois mois</dt><dd className="chiffre text-right text-texte">{formatMontant(ligne.run_rate_3m)} / mois</dd>
                <dt className="text-texte-2">Run-rate saisonnalisé sur {formatNombre(ligne.mois_restants)} mois restants</dt><dd className="chiffre text-right text-texte">{formatMontant(ligne.projection_run_rate)}</dd>
                <dt className="text-texte-2">Part retenue au-delà des 45 jours couverts par le pipe</dt><dd className="chiffre text-right text-texte">{hypotheses ? formatMontant(projectionRetenue(hypotheses)) : "n. d."}</dd>
                <dt className="text-texte-2">Écart-type mensuel</dt><dd className="chiffre text-right text-texte">{formatMontant(ligne.sigma_mensuel)}</dd>
              </dl>
              <p className="text-[12px] leading-[1.5] text-texte-3">Atterrissage central = réalisé à date + pipe pondéré + part retenue du run-rate ; les 45 premiers jours sont couverts par le pipe, le run-rate ne compte qu'au-delà.</p>
              <div className="flex flex-col gap-[6px] rounded-[10px] bg-surface-2 p-[var(--esp-3)]">
                <label htmlFor={idCurseur} className="flex items-baseline justify-between gap-[var(--esp-2)]">
                  <span className="text-texte">Taux de signature du pipe</span>
                  <span className="chiffre text-texte">{formatTaux(tauxCurseur)}{tauxObserve !== null && <span className="ml-1 text-[11px] text-texte-3">observé {formatTaux(tauxObserve)}</span>}</span>
                </label>
                <input id={idCurseur} type="range" min={0} max={curseurMax} step={0.5} value={tauxCurseur} onChange={(e) => setCurseur(Number(e.target.value))}
                  className="h-1 w-full cursor-pointer accent-accent" aria-valuetext={`${formatTaux(tauxCurseur)} de signature du pipe`} />
                <div className="flex items-center justify-between gap-[var(--esp-2)] text-[11px] text-texte-3">
                  <span>Pondéré par tranche d'âge, annulation comprise ; le curseur remplace ce taux pour tester une hypothèse.</span>
                  {curseurActif && <button type="button" onClick={() => setCurseur(null)} className="shrink-0 rounded-[8px] border border-bordure px-2 py-1 text-texte-2 hover:text-texte">Observé</button>}
                </div>
              </div>
            </div>
          )}
        </Carte>
      </div>

      <Carte titre="Atterrissage par agence" sousTitre={`${annee} : réalisé à date, objectif, central, écart, probabilité d'atteinte (loi normale sur le run-rate)`} nu>
        <div className="px-[var(--esp-2)] pb-[var(--esp-3)]">
          {forecast.donnees === undefined ? <Squelette hauteur={360} /> : (
            <Tableau colonnes={colonnes} lignes={lignesAgences} cleLigne={(l) => l.code} triInitial={{ cle: "ecart", sens: "desc" }} compact
              estActive={(l) => l.code === agence} onLigneClic={(l) => filtres.definir("agence", l.code === agence ? "toutes" : l.code)} nomExport="forecast-agences" />
          )}
        </div>
      </Carte>

      <div className="grid gap-[var(--esp-3)] lg:grid-cols-12">
        <ListeSignaux className="lg:col-span-6" titre="Risques" sousTitre="Calculés par règles : poses en retard, atterrissage sous l'objectif, devis en cours insuffisants" signaux={risques} couleur="bg-alerte" vide="Aucun risque détecté par les règles sur ce périmètre." journee={journeeLibelle} chargement={forecast.donnees === undefined || poses.donnees === undefined} />
        <ListeSignaux className="lg:col-span-6" titre="Opportunités" sousTitre="Calculées par règles : objectif atteignable, borne haute au-dessus, pipe pondéré au-delà de 45 jours" signaux={opportunites} couleur="bg-succes" vide="Aucune opportunité détectée par les règles sur ce périmètre." journee={journeeLibelle} chargement={forecast.donnees === undefined || poses.donnees === undefined} />
      </div>

      <LigneSources simule sources={[{ nom: "Vues mart_forecast, mart_kpi_mensuel, mart_objectif_mensuel, mart_pose", ...(filtres.journeePubliee ? { reference: `journée publiée du ${journeeLibelle}` } : {}) }]}
        hypotheses="Pipe pondéré sur 45 jours, run-rate trois mois saisonnalisé sur 2025 au-delà, intervalle à un écart-type mensuel × racine des mois restants ; objectif : réalisé 2025 × 1,15. CA posé à risque : poses en retard × panier moyen de l'année (estimation)." />
    </div>
  );
}

function libelleStatut(ecart: number | null | undefined): string {
  const s = statutEcart(ecart);
  return s === "succes" ? "tenu" : s === "attention" ? "proche" : s === "alerte" ? "retrait" : "n. d.";
}

const SIGNAUX_AFFICHES = 8;

function ListeSignaux({ className, titre, sousTitre, signaux, couleur, vide, journee, chargement }: { className?: string; titre: string; sousTitre: string; signaux: readonly { texte: string; montant: number; montantLibelle: string }[]; couleur: string; vide: string; journee: string; chargement: boolean }) {
  const [tout, setTout] = useState(false);
  const visibles = tout ? signaux : signaux.slice(0, SIGNAUX_AFFICHES);
  return (
    <Carte {...(className ? { className } : {})} titre={titre} sousTitre={sousTitre}>
      {chargement ? <Squelette hauteur={140} /> : signaux.length === 0 ? <p className="text-[13px] text-texte-2">{vide}</p> : (
        <ul className="flex flex-col divide-y divide-bordure">
          {visibles.map((s, i) => (
            <li key={i} className="flex items-start gap-[var(--esp-2)] py-[var(--esp-2)]">
              <span className={`mt-[6px] h-2 w-2 shrink-0 rounded-full ${couleur}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-texte">{s.texte}</p>
                <p className="text-[11px] text-texte-3">{s.montantLibelle} · calculé le {journee}</p>
              </div>
              <span className="chiffre shrink-0 text-[13px] text-texte">{formatMontant(s.montant)}</span>
            </li>
          ))}
          {signaux.length > SIGNAUX_AFFICHES && (
            <li className="pt-[var(--esp-2)]">
              <button type="button" onClick={() => setTout((v) => !v)} className="text-[12px] text-texte-2 underline-offset-2 hover:text-texte hover:underline">
                {tout ? "Réduire la liste" : `Voir les ${formatNombre(signaux.length - SIGNAUX_AFFICHES)} autres`}
              </button>
            </li>
          )}
        </ul>
      )}
    </Carte>
  );
}
