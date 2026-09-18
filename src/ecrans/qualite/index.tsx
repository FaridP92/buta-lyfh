import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { nomAgence } from "@/app/filtres";
import { useVue } from "@/donnees/useVue";
import { Carte } from "@/composants/Carte";
import { CarteGraphique } from "@/composants/CarteGraphique";
import { CarteKPI } from "@/composants/CarteKPI";
import { Pastille } from "@/composants/Pastille";
import { Badge } from "@/composants/Badge";
import { BoutonFiche } from "@/composants/FicheIndicateur";
import { LigneSources } from "@/composants/LigneSources";
import { Squelette } from "@/composants/Squelette";
import { Tableau, type Colonne } from "@/composants/Tableau";
import { optionBase, useTokensGraphique, type TokensGraphique } from "@/graphiques/theme";
import { formatDateAnnee, formatDateCourte, formatDateHeure, formatMontant, formatNombre, formatNombreDecimal } from "@/lib/format";
import { ecartPoints } from "@/lib/periode";
import { Lignage } from "./Lignage";

const LIBELLES_SOURCES: Record<string, string> = {
  insee_logement_2022: "Insee, Logement 2022", ademe_rge: "ADEME, installateurs RGE", rte_registre: "RTE, registre des installations", ademe_dpe: "ADEME, base DPE",
  journee_simulee: "Journée simulée (activité)", contours_geo: "Contours administratifs (Etalab)",
};

function optionScore(points: readonly { jour: string; score: number }[], t: TokensGraphique): EChartsOption {
  const base = optionBase(t);
  return {
    ...base,
    grid: { left: 8, right: 12, top: 16, bottom: 8, containLabel: true },
    xAxis: { ...base.xAxis, type: "category", data: points.map((p) => formatDateCourte(p.jour)) },
    yAxis: { ...base.yAxis, type: "value", min: 0, max: 100 },
    tooltip: { ...base.tooltip, trigger: "axis", valueFormatter: (v: unknown) => (typeof v === "number" ? `${formatNombre(v)} / 100` : "n. d.") },
    series: [{ name: "Score", type: "line", data: points.map((p) => p.score), symbol: "circle", symbolSize: 6, lineStyle: { color: t.ambre, width: 1.5 }, itemStyle: { color: t.ambre }, areaStyle: { color: t.ambre, opacity: 0.08 },
      markLine: { silent: true, symbol: "none", lineStyle: { color: t.texte3, type: "dashed" }, label: { color: t.texte3, fontSize: 11, formatter: "seuil 80" }, data: [{ yAxis: 80 }] } }],
  };
}

export function EcranQualite() {
  const tokens = useTokensGraphique();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const qualite = useVue("mart_qualite", { ordre: "-jour" });
  const fraicheur = useVue("mart_fraicheur");
  const agences = useVue("dim_agence");
  const canaux = useVue("dim_canal");
  const produits = useVue("dim_produit");
  const statuts = useVue("dim_statut", { ordre: "ordre" });
  const reconciliation = useVue("mart_reconciliation_libelles");

  const jours = useMemo(() => [...new Set((qualite.donnees ?? []).map((l) => l.jour))].sort(), [qualite.donnees]);
  const dernierJour = jours.at(-1) ?? null;
  const controles = useMemo(() => (qualite.donnees ?? []).filter((l) => l.jour === dernierJour).sort((a, b) => a.ordre - b.ordre), [qualite.donnees, dernierJour]);
  const score = controles[0]?.score_jour ?? null;
  const scoreVeille = jours.length >= 2 ? (qualite.donnees ?? []).find((l) => l.jour === jours[jours.length - 2])?.score_jour ?? null : null;
  const serieScore = jours.map((j) => ({ jour: j, score: (qualite.donnees ?? []).find((l) => l.jour === j)?.score_jour ?? 0 }));
  const journeeSimulee = (fraicheur.donnees ?? []).find((f) => f.source === "journee_simulee");
  const bloquantsKo = controles.filter((c) => c.bloquant && c.statut === "ko").length;

  const colonnesReconciliation: Colonne<NonNullable<typeof reconciliation.donnees>[number]>[] = [
    { cle: "agence", libelle: "Agence", valeur: (l) => nomAgence(l.agence), rendu: (l) => <span className="whitespace-nowrap">{nomAgence(l.agence)}</span> },
    { cle: "libelle_source", libelle: "Libellé reçu (avant)", rendu: (l) => <span className="chiffre text-[12px] text-alerte">{l.libelle_source}</span> },
    { cle: "libelle_referentiel", libelle: "Référentiel (après)", rendu: (l) => <span className="whitespace-nowrap text-texte">{l.libelle_referentiel} <span className="text-texte-3">({l.produit_code})</span></span> },
    { cle: "dossiers", libelle: "Dossiers", numerique: true, largeur: "80px", rendu: (l) => formatNombre(l.dossiers) },
    { cle: "premier_lead", libelle: "Du", secondaire: true, largeur: "88px", rendu: (l) => formatDateCourte(l.premier_lead) },
    { cle: "dernier_lead", libelle: "Au", secondaire: true, largeur: "88px", rendu: (l) => formatDateCourte(l.dernier_lead) },
  ];

  return (
    <div className="flex flex-col gap-[var(--esp-5)]">
      <header className="flex flex-wrap items-end justify-between gap-[var(--esp-3)]">
        <div>
          <h1 className="font-serif-titre text-[32px] leading-[1.1] text-texte max-md:text-[26px]">Peut-on faire confiance au chiffre</h1>
          <p className="mt-1 text-[13px] text-texte-2">Contrôles du matin, fraîcheur des sources, référentiels, lignage · {qualite.source === "instantane" ? <Badge variante="instantane">instantané</Badge> : <Badge variante="simule">simulé</Badge>}</p>
        </div>
        <p className="text-[12px] text-texte-3">Journée contrôlée : {dernierJour ? formatDateCourte(dernierJour) : "n. d."} (contrôles rejoués à chaque publication)</p>
      </header>

      <div className="grid gap-[var(--esp-3)] lg:grid-cols-12">
        <div className="lg:col-span-4">
          <CarteKPI libelle="Score de qualité du jour" sousLibelle="part pondérée des contrôles réussis, sur 100" valeur={score} format="nombre" code="QUALITE" clePeriode={dernierJour ?? "aucun"} decalageMs={0}
            variation={{ valeur: ecartPoints(score, scoreVeille), unite: "pts", libelle: "vs veille" }} />
          {bloquantsKo > 0 && <p className="mt-[var(--esp-2)] text-[12px] text-alerte">{formatNombre(bloquantsKo)} contrôle{bloquantsKo > 1 ? "s" : ""} bloquant{bloquantsKo > 1 ? "s" : ""} en échec : la journée est publiée, l'anomalie est portée à l'écran plutôt que masquée.</p>}
        </div>
        {serieScore.length > 0 ? (
          <CarteGraphique className="lg:col-span-8" titre="Score des journées publiées" sousTitre={`${formatNombre(serieScore.length)} journée${serieScore.length > 1 ? "s" : ""} de contrôles disponible${serieScore.length > 1 ? "s" : ""} : l'historique se constitue au fil des journées publiées`} option={optionScore(serieScore, tokens)} hauteur={220} hauteurMobile={200} codeIndicateur="QUALITE"
            description={`Score de qualité par jour, ${formatNombre(serieScore.length)} points`} requete="select distinct jour, score_jour from buta.mart_qualite order by jour"
            exportCSV={{ colonnes: [{ cle: "jour", libelle: "Jour" }, { cle: "score", libelle: "Score" }], lignes: serieScore }} />
        ) : <Carte className="lg:col-span-8" titre="Score des journées publiées"><Squelette hauteur={220} /></Carte>}
      </div>

      <Carte titre="Les douze contrôles" sousTitre="Pour chaque contrôle : la règle, le résultat du matin, les lignes concernées, la tendance sur la veille, un échantillon" actions={<BoutonFiche code="QUALITE" />}>
        {qualite.donnees === undefined ? <Squelette hauteur={400} /> : (
          <ol className="flex flex-col divide-y divide-bordure">
            {controles.map((c, i) => {
              const statut = c.statut === "ok" ? "succes" : c.statut === "alerte" ? "attention" : "alerte";
              const echantillon = Array.isArray(c.echantillon) ? (c.echantillon as Record<string, unknown>[]) : [];
              const cles = echantillon[0] ? Object.keys(echantillon[0]) : [];
              const estOuvert = ouvert === c.controle;
              return (
                <li key={c.controle} className="py-[var(--esp-2)]" style={{ animation: "buta-coche 320ms cubic-bezier(0.22, 1, 0.36, 1) both", animationDelay: `${i * 60}ms` }}>
                  <div className="flex flex-wrap items-start gap-x-[var(--esp-3)] gap-y-1">
                    <span className="chiffre w-6 shrink-0 pt-[2px] text-[12px] text-texte-3">{String(c.ordre).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] text-texte">{c.libelle}{c.bloquant && <span className="ml-2 rounded-[6px] border border-bordure px-[6px] py-[1px] text-[10px] uppercase tracking-[0.06em] text-texte-3">bloquant</span>}</p>
                      <p className="text-[12px] text-texte-3">{c.regle}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-[var(--esp-3)] text-[12px]">
                      <span className="chiffre text-texte">{formatNombre(c.nb_lignes)} ligne{c.nb_lignes > 1 ? "s" : ""}</span>
                      <span className="chiffre w-[56px] text-right text-texte-2">{c.tendance === null ? "n. d." : `${c.tendance > 0 ? "+" : ""}${formatNombre(c.tendance)}`}</span>
                      <Pastille statut={statut} texte={c.statut === "ok" ? "OK" : c.statut === "alerte" ? "alerte" : "KO"} className="w-[64px]" />
                      <button type="button" onClick={() => setOuvert(estOuvert ? null : c.controle)} disabled={echantillon.length === 0} aria-expanded={estOuvert}
                        className="rounded-[8px] border border-bordure px-2 py-1 text-[11px] text-texte-2 hover:text-texte disabled:opacity-40">{estOuvert ? "Masquer" : "Échantillon"}</button>
                    </div>
                  </div>
                  {estOuvert && echantillon.length > 0 && (
                    <div className="mt-[var(--esp-2)] overflow-x-auto rounded-[10px] bg-surface-2 p-[var(--esp-2)]">
                      <table className="w-full text-[12px]">
                        <thead><tr>{cles.map((k) => <th key={k} className="px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-texte-3">{k}</th>)}</tr></thead>
                        <tbody>{echantillon.slice(0, 8).map((ligne, j) => <tr key={j} className="border-t border-bordure/60">{cles.map((k) => <td key={k} className="chiffre px-2 py-1 text-texte-2">{ligne[k] === null || ligne[k] === undefined ? "∅" : String(ligne[k])}</td>)}</tr>)}</tbody>
                      </table>
                      <p className="mt-1 text-[11px] text-texte-3">Échantillon de {formatNombre(Math.min(8, echantillon.length))} ligne{echantillon.length > 1 ? "s" : ""} sur {formatNombre(c.nb_lignes)} ; identifiants de dossiers simulés.</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Carte>

      <div className="grid gap-[var(--esp-3)] lg:grid-cols-12">
        <Carte className="lg:col-span-5" titre="Fraîcheur des sources" sousTitre="Date de référence, ingestion, prochaine mise à jour">
          {fraicheur.donnees === undefined ? <Squelette hauteur={200} /> : (
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-bordure text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3"><th className="py-1 text-left">Source</th><th className="py-1 text-right">Référence</th><th className="py-1 text-right">Chargée</th><th className="py-1 text-right">Prochaine</th></tr></thead>
              <tbody>
                {(fraicheur.donnees ?? []).map((f) => (
                  <tr key={f.source} className="border-b border-bordure/60">
                    <td className="py-[6px] text-texte">{LIBELLES_SOURCES[f.source] ?? f.source}</td>
                    <td className="chiffre py-[6px] text-right text-texte-2">
                      {f.date_reference ? formatDateAnnee(f.date_reference) : "n. d."}
                      {f.disponible_jusqu_au && f.date_reference && f.disponible_jusqu_au > f.date_reference ? <span className="block text-[11px] text-texte-3">publiée d'avance jusqu'au {formatDateCourte(f.disponible_jusqu_au)}</span> : null}
                    </td>
                    <td className="chiffre py-[6px] text-right text-texte-2">{formatDateHeure(f.ingere_le)}</td>
                    <td className="chiffre py-[6px] text-right text-texte-2">{f.prochaine ? formatDateAnnee(f.prochaine) : "à la demande"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Carte>
        <Carte className="lg:col-span-7" titre="Lignage" sousTitre="Des sources aux écrans : rien n'est calculé ailleurs que dans les vues">
          <Lignage />
        </Carte>
      </div>

      <Carte titre="Référentiels" sousTitre={`Agences, canaux, produits, statuts${journeeSimulee ? ` · version du chargement du ${formatDateHeure(journeeSimulee.ingere_le)}` : ""}`}>
        <div className="grid gap-[var(--esp-4)] md:grid-cols-2 xl:grid-cols-4 text-[12px]">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">Agences simulées ({formatNombre(agences.donnees?.length ?? 0)})</p>
            <ul className="flex flex-col gap-[2px] text-texte-2">{(agences.donnees ?? []).map((a) => <li key={a.code} className="flex justify-between gap-2"><span><span className="chiffre mr-1 text-texte-3">{a.code}</span>{a.nom_bassin}</span><span className="chiffre text-texte-3">{a.departement} · depuis {a.ouverture.slice(0, 4)}</span></li>)}</ul>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">Canaux ({formatNombre(canaux.donnees?.length ?? 0)})</p>
            <ul className="flex flex-col gap-[2px] text-texte-2">{(canaux.donnees ?? []).map((c) => <li key={c.code} className="flex justify-between gap-2"><span>{c.libelle}</span><span className="text-texte-3">{c.cout_modele}</span></li>)}</ul>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">Produits ({formatNombre(produits.donnees?.length ?? 0)})</p>
            <ul className="flex flex-col gap-[2px] text-texte-2">{[...(produits.donnees ?? [])].sort((a, b) => b.prix_catalogue - a.prix_catalogue).map((p) => <li key={p.code} className="flex justify-between gap-2"><span><span className="chiffre mr-1 text-texte-3">{p.code}</span>{p.libelle}</span><span className="chiffre text-texte-3">{formatMontant(p.prix_catalogue)} · {formatNombreDecimal(p.duree_pose_jt, 1)} jours-technicien de pose</span></li>)}</ul>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">Statuts ({formatNombre(statuts.donnees?.length ?? 0)})</p>
            <ol className="flex flex-col gap-[2px] text-texte-2">{(statuts.donnees ?? []).map((s) => <li key={s.code} className="flex justify-between gap-2"><span>{s.libelle}</span><span className="chiffre text-texte-3">{s.code}</span></li>)}</ol>
          </div>
        </div>
      </Carte>

      <Carte titre="Réconciliation des libellés produits" sousTitre="Libellés reçus du système source hors référentiel, résolus vers le produit de référence (agence Nord pendant son intégration, H4)" nu>
        <div className="px-[var(--esp-2)] pb-[var(--esp-3)]">
          {reconciliation.donnees === undefined ? <Squelette hauteur={200} /> : (
            <Tableau colonnes={colonnesReconciliation} lignes={reconciliation.donnees} cleLigne={(l) => `${l.agence}-${l.libelle_source}`} triInitial={{ cle: "dossiers", sens: "desc" }} compact nomExport="reconciliation-libelles" vide="Aucun libellé divergent : tous les dossiers publiés portent un libellé du référentiel." />
          )}
        </div>
      </Carte>

      <LigneSources simule sources={[{ nom: "Vues mart_qualite, mart_reconciliation_libelles, mart_fraicheur, dimensions", ...(dernierJour ? { reference: `contrôles du ${formatDateCourte(dernierJour)}` } : {}) }]}
        hypotheses="Score = 100 × somme des poids des contrôles OK / somme des poids (3 pour un contrôle bloquant, 1 sinon) ; tendance = lignes concernées en plus ou en moins par rapport à la veille ; l'historique des contrôles commence à la mise en service." />
    </div>
  );
}
