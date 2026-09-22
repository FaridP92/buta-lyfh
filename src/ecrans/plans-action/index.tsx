import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useFiltres } from "@/app/filtres";
import { useDeclarerExport } from "@/app/exportEcran";
import { useVue } from "@/donnees/useVue";
import { Carte } from "@/composants/Carte";
import { Tableau, type Colonne } from "@/composants/Tableau";
import { Pastille } from "@/composants/Pastille";
import { Badge } from "@/composants/Badge";
import { useFicheIndicateur } from "@/composants/FicheIndicateur";
import { LigneSources } from "@/composants/LigneSources";
import { SelecteurMenu } from "@/composants/SelecteurMenu";
import { Squelette } from "@/composants/Squelette";
import { INDICATEURS } from "@/lib/indicateurs";
import { formatDateCourte, formatDateHeure, formatMontant, formatNombre, formatTaux } from "@/lib/format";
import { resumerPlans, RITUELS, statutPlan } from "@/lib/plans";
import { analyserTexte } from "@/lib/revue";

function libelleIndicateur(code: string): string {
  return INDICATEURS.find((i) => i.code === code)?.libelle ?? code;
}

function PuceIndicateur({ code }: { code: string }) {
  const { ouvrir } = useFicheIndicateur();
  return (
    <button type="button" onClick={() => ouvrir(code)} className="inline-flex items-center gap-1 rounded-[6px] border border-bordure px-[6px] py-[1px] text-[11px] text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte" title={libelleIndicateur(code)}>
      <span className="chiffre">{code}</span>
    </button>
  );
}

export function EcranPlansAction() {
  const { agence, journeePubliee } = useFiltres();
  const plans = useVue("mart_plans_action", { ordre: "echeance" });
  const revues = useVue("mart_revue_hebdo", { ordre: "-semaine" });
  const [semaineChoisie, setSemaineChoisie] = useState<string | null>(null);

  const lignes = useMemo(() => (plans.donnees ?? []).filter((p) => agence === "toutes" || p.agence === agence || p.agence === null), [plans.donnees, agence]);
  const resume = useMemo(() => resumerPlans(lignes), [lignes]);
  const revue = (revues.donnees ?? []).find((r) => r.semaine === (semaineChoisie ?? revues.donnees?.[0]?.semaine)) ?? null;
  const blocs = revue?.texte ? analyserTexte(revue.texte) : null;

  const colonnes: Colonne<(typeof lignes)[number]>[] = [
    { cle: "levier", libelle: "Levier", triable: false, rendu: (l) => <span className="block max-w-[420px] text-[14px] leading-[1.35] text-texte">{l.levier}</span> },
    { cle: "nom_bassin", libelle: "Agence", largeur: "130px", valeur: (l) => l.nom_bassin ?? "Réseau", rendu: (l) => <span className="whitespace-nowrap text-texte-2">{l.nom_bassin ?? "Réseau"}</span> },
    { cle: "proprietaire_code", libelle: "Propriétaire", largeur: "100px", secondaire: true, rendu: (l) => <span className="chiffre text-[12px] text-texte-3">{l.proprietaire_code}</span> },
    { cle: "gain_attendu", libelle: "Gain de marge attendu", numerique: true, largeur: "128px", rendu: (l) => (l.gain_attendu > 0 ? formatMontant(l.gain_attendu) : <span title="Levier de qualité, sans gain chiffré">n. d.</span>) },
    { cle: "statut", libelle: "Statut", largeur: "96px", valeur: (l) => statutPlan(l.statut).texte, rendu: (l) => { const s = statutPlan(l.statut); return <Pastille statut={s.statut} texte={s.texte} />; } },
    { cle: "echeance", libelle: "Échéance", largeur: "88px", rendu: (l) => <span className="chiffre text-[13px]">{formatDateCourte(l.echeance)}</span> },
    { cle: "avancement", libelle: "Avancement déclaré", numerique: true, largeur: "136px", rendu: (l) => (
      <span className="inline-flex items-center gap-[6px]">
        <span className="h-[4px] w-[56px] overflow-hidden rounded-full bg-surface-2" aria-hidden="true"><span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, l.avancement))}%` }} /></span>
        <span className="chiffre text-[12px]">{formatTaux(l.avancement, 0)}</span>
      </span>
    ) },
    { cle: "indicateur_code", libelle: "Indicateur", triable: false, largeur: "96px", secondaire: true, rendu: (l) => <PuceIndicateur code={l.indicateur_code} /> },
  ];
  useDeclarerExport("plans-action", lignes.length ? {
    nom: "Plans d'action",
    colonnes: [{ cle: "levier", libelle: "Levier" }, { cle: "agence", libelle: "Agence" }, { cle: "proprietaire", libelle: "Propriétaire" }, { cle: "gain_attendu", libelle: "Gain de marge attendu (€)" }, { cle: "statut", libelle: "Statut" }, { cle: "echeance", libelle: "Échéance" }, { cle: "avancement", libelle: "Avancement déclaré (%)" }, { cle: "indicateur", libelle: "Indicateur suivi" }],
    lignes: lignes.map((l) => ({ levier: l.levier, agence: l.nom_bassin ?? "Réseau", proprietaire: l.proprietaire_code, gain_attendu: l.gain_attendu, statut: l.statut, echeance: l.echeance, avancement: l.avancement, indicateur: l.indicateur_code })),
  } : null);

  const optionsSemaines = (revues.donnees ?? []).map((r) => ({ valeur: r.semaine, libelle: `${r.libelle} · semaine du ${formatDateCourte(r.semaine)}` }));

  return (
    <div className="flex flex-col gap-[var(--esp-5)]">
      <header className="flex flex-wrap items-end justify-between gap-[var(--esp-3)]">
        <div>
          <h1 className="font-serif-titre text-[32px] leading-[1.1] text-texte max-md:text-[26px]">Ce qu'on a décidé de changer</h1>
          <p className="mt-1 text-[13px] text-texte-2">Leviers en cours, gains attendus, rituels, revue hebdomadaire · {plans.source === "instantane" ? <Badge variante="instantane">instantané</Badge> : <Badge variante="simule">simulé</Badge>}</p>
        </div>
        <p className="text-[12px] text-texte-3">
          {resume.total === 0 ? "Aucun plan pour ce périmètre" : `${formatNombre(resume.en_cours)} en cours, ${formatNombre(resume.planifies)} planifié${resume.planifies > 1 ? "s" : ""}, ${formatNombre(resume.termines)} terminé${resume.termines > 1 ? "s" : ""} · ${formatMontant(resume.gain_attendu_ouvert)} de gain de marge attendu sur les plans ouverts (les plans sans montant comptent pour zéro)`}
        </p>
      </header>

      <Carte titre="Plans d'action" sousTitre="Un levier, une agence ou le réseau, un propriétaire (code), un gain de marge attendu et un avancement déclarés par le propriétaire, une échéance et l'indicateur qui dira si ça marche" nu>
        {plans.donnees === undefined ? <Squelette hauteur={420} /> : (
          <Tableau colonnes={colonnes} lignes={lignes} cleLigne={(l) => String(l.id)} triInitial={{ cle: "echeance", sens: "asc" }} nomExport="plans-action" vide="Aucun plan d'action pour ce périmètre." />
        )}
      </Carte>

      <div className="grid grid-cols-1 gap-[var(--esp-3)] lg:grid-cols-12">
        <Carte className="lg:col-span-7" titre="Revue hebdomadaire" sousTitre={revue ? `Semaine du ${formatDateCourte(revue.semaine)} · rédigée par ${revue.modele ?? "n. d."} à partir des faits SQL de la semaine${revue.publie_le ? `, publiée le ${formatDateHeure(revue.publie_le)}` : ""}${revue.cout ? ` · coût ${formatMontant(revue.cout)}` : ""}` : "Faits, lecture, décisions proposées"}
          actions={optionsSemaines.length > 1 ? <SelecteurMenu libelle="Semaine" options={optionsSemaines} valeur={revue?.semaine ?? ""} onChange={setSemaineChoisie} /> : undefined}>
          {revues.donnees === undefined ? <Squelette hauteur={320} /> : !revue ? (
            <p className="text-[13px] text-texte-3">Aucune revue publiée.</p>
          ) : blocs ? (
            <div className="grid gap-[var(--esp-4)] md:grid-cols-3">
              <section>
                <h3 className="mb-[var(--esp-2)] text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">Faits</h3>
                <ul className="flex flex-col gap-[6px] text-[13px] leading-[1.45] text-texte-2">{blocs.faits.map((f) => <li key={f} className="border-l border-bordure pl-[10px]">{f}</li>)}</ul>
              </section>
              <section>
                <h3 className="mb-[var(--esp-2)] text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">Lecture</h3>
                <div className="flex flex-col gap-[6px] text-[13px] leading-[1.5] text-texte">{blocs.lecture.map((l) => <p key={l}>{l}</p>)}</div>
              </section>
              <section>
                <h3 className="mb-[var(--esp-2)] text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">Décisions proposées</h3>
                <ol className="flex flex-col gap-[8px] text-[13px] leading-[1.45] text-texte-2">
                  {blocs.decisions.map((d, i) => (
                    <li key={d.texte} className="flex gap-[8px]"><span className="chiffre text-accent">{i + 1}</span><span>{d.texte}{d.indicateur ? <> <PuceIndicateur code={d.indicateur} /></> : null}</span></li>
                  ))}
                </ol>
              </section>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-[1.5] text-texte-2">{revue.texte}</pre>
          )}
        </Carte>
        <Carte className="lg:col-span-5" titre="Rituels" sousTitre="Quatre revues, leur ordre du jour type et les indicateurs qu'on y regarde">
          <ol className="flex flex-col gap-[var(--esp-3)]">
            {RITUELS.map((r) => (
              <li key={r.code} className="rounded-[12px] border border-bordure bg-surface-2 p-[var(--esp-3)]">
                <div className="flex flex-wrap items-baseline justify-between gap-x-[var(--esp-2)]">
                  <h3 className="text-[14px] font-semibold text-texte">{r.nom} <span className="text-[12px] font-normal text-texte-3">· {r.frequence}, {r.moment}</span></h3>
                  <span className="text-[11px] text-texte-3">{r.duree} · {r.participants}</span>
                </div>
                <ul className="mt-[6px] flex flex-col gap-[2px] text-[12px] leading-[1.45] text-texte-2">{r.ordreDuJour.map((o) => <li key={o}>· {o}</li>)}</ul>
                <div className="mt-[8px] flex flex-wrap items-center gap-[6px]">
                  {r.indicateurs.map((c) => <PuceIndicateur key={c} code={c} />)}
                  <Link to={r.ecran} viewTransition className="ml-auto text-[12px] text-texte-3 underline decoration-bordure underline-offset-4 hover:text-texte">écran</Link>
                </div>
              </li>
            ))}
          </ol>
        </Carte>
      </div>

      <LigneSources simule sources={[{ nom: "Vues mart_plans_action, mart_revue_hebdo (faits calculés par buta.faits_revue_hebdo)", ...(journeePubliee ? { reference: `journée publiée du ${formatDateCourte(journeePubliee)}` } : {}) }]}
        hypotheses="Douze plans simulés, cohérents avec les histoires du jeu ; gains attendus indicatifs. La revue est rédigée chaque lundi à 07:00 (workflow WF3, modèle de langage) ou par règles ; dans les deux cas, aucun chiffre n'est produit hors des faits SQL transmis." />
    </div>
  );
}
