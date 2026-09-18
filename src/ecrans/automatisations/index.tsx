import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Download } from "lucide-react";
import { useDeclarerExport } from "@/app/exportEcran";
import { useVue } from "@/donnees/useVue";
import { Carte } from "@/composants/Carte";
import { Tableau, type Colonne } from "@/composants/Tableau";
import { Pastille } from "@/composants/Pastille";
import { Badge } from "@/composants/Badge";
import { LigneSources } from "@/composants/LigneSources";
import { Squelette } from "@/composants/Squelette";
import { formatDateCourte, formatDateHeure, formatNombre, formatTaux } from "@/lib/format";
import { formatDuree, libelleDeclencheur, libelleStatut, prochaineExecution, resumerJournal, WORKFLOWS } from "@/lib/automatisations";
import { SchemaFlux } from "./SchemaFlux";

const JOURNAL_MAX = 50;
const SEPT_JOURS_MS = 7 * 86_400_000;

/**
 * Exports JSON réellement publiés avec le site (dist/n8n/index.json, écrit au build) : sans cette liste, un lien
 * vers un export absent recevrait la page HTML de l'application sous un nom .json (réécriture SPA du serveur).
 */
async function lireExportsDisponibles(): Promise<Set<string>> {
  try {
    const reponse = await fetch("/n8n/index.json");
    if (!reponse.ok || !(reponse.headers.get("content-type") ?? "").includes("json")) return new Set();
    return new Set(z.array(z.string()).parse(await reponse.json()));
  } catch {
    return new Set();
  }
}

export function EcranAutomatisations() {
  const journal = useVue("mart_automatisation", { ordre: "-debute_le", limite: 200 });
  const fraicheur = useVue("mart_fraicheur", { egal: { source: "journee_simulee" } });
  const exports = useQuery({ queryKey: ["exports-n8n"], queryFn: lireExportsDisponibles, staleTime: Number.POSITIVE_INFINITY, retry: false });
  const exportDisponible = (fichier: string) => exports.data?.has(fichier.split("/").pop() ?? "") ?? false;
  const publieeJusquAu = fraicheur.donnees?.[0]?.disponible_jusqu_au ?? null;
  // Instant de rendu : la prochaine exécution s'en déduit ; rien ne bouge ensuite sans action (DESIGN.md §11).
  const maintenant = useMemo(() => new Date(), []);
  const lignes = journal.donnees ?? [];
  const resume = useMemo(() => resumerJournal(lignes, new Date(maintenant.getTime() - SEPT_JOURS_MS)), [lignes, maintenant]);
  const derniereDe = (code: string) => lignes.find((l) => l.workflow === code && l.rang === 1) ?? null;
  const nomDe = (code: string) => WORKFLOWS.find((w) => w.code === code)?.nom ?? code;
  const journalVisible = lignes.slice(0, JOURNAL_MAX);

  const colonnes: Colonne<(typeof journalVisible)[number]>[] = [
    { cle: "workflow", libelle: "Workflow", largeur: "150px", valeur: (l) => `${l.workflow} ${nomDe(l.workflow)}`, rendu: (l) => <span className="whitespace-nowrap text-texte"><span className="chiffre text-[12px] text-texte-3">{l.workflow}</span> {nomDe(l.workflow)}</span> },
    { cle: "debute_le", libelle: "Début", largeur: "120px", rendu: (l) => <span className="chiffre whitespace-nowrap text-[13px]">{formatDateHeure(l.debute_le)}</span> },
    { cle: "statut", libelle: "Statut", largeur: "130px", valeur: (l) => libelleStatut(l.statut).texte, rendu: (l) => { const s = libelleStatut(l.statut); return <Pastille statut={s.statut} texte={s.texte} />; } },
    { cle: "duree_s", libelle: "Durée", numerique: true, largeur: "88px", rendu: (l) => formatDuree(l.duree_s) },
    { cle: "lignes", libelle: "Lignes", numerique: true, largeur: "72px", secondaire: true, rendu: (l) => (l.lignes === null ? "" : formatNombre(l.lignes)) },
    { cle: "message", libelle: "Message", triable: false, secondaire: true, rendu: (l) => <span className="block max-w-[520px] text-[13px] leading-[1.35] text-texte-2">{l.message ?? ""}</span> },
  ];
  useDeclarerExport("automatisations", journalVisible.length ? {
    nom: "Journal des automatisations",
    colonnes: [{ cle: "workflow", libelle: "Workflow" }, { cle: "debute_le", libelle: "Début" }, { cle: "fini_le", libelle: "Fin" }, { cle: "statut", libelle: "Statut" }, { cle: "duree_s", libelle: "Durée (s)" }, { cle: "lignes", libelle: "Lignes" }, { cle: "message", libelle: "Message" }],
    lignes: journalVisible.map((l) => ({ workflow: l.workflow, debute_le: l.debute_le, fini_le: l.fini_le, statut: l.statut, duree_s: l.duree_s, lignes: l.lignes, message: l.message })),
  } : null);

  return (
    <div className="flex flex-col gap-[var(--esp-5)]">
      <header className="flex flex-wrap items-end justify-between gap-[var(--esp-3)]">
        <div>
          <h1 className="font-serif-titre text-[32px] leading-[1.1] text-texte max-md:text-[26px]">Ce qui tourne chaque matin</h1>
          <p className="mt-1 text-[13px] text-texte-2">Workflows n8n, dernière exécution, journal · {journal.source === "instantane" ? <Badge variante="instantane">instantané</Badge> : lignes.length === 0 ? <Badge variante="instantane">en attente de publication</Badge> : <Badge variante="simule">journal en direct</Badge>}</p>
        </div>
        <p className="text-[12px] text-texte-3">
          Sept derniers jours : {resume.executions === 0 ? "aucune exécution journalisée" : `${formatNombre(resume.executions)} exécution${resume.executions > 1 ? "s" : ""}, ${formatTaux(resume.taux_reussite, 0)} sans erreur`}
        </p>
      </header>

      {journal.donnees === undefined ? (
        <div className="grid grid-cols-1 gap-[var(--esp-3)] md:grid-cols-2 2xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Squelette key={i} hauteur={200} />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--esp-3)] md:grid-cols-2 2xl:grid-cols-4">
          {WORKFLOWS.map((w, i) => {
            const derniere = derniereDe(w.code);
            const prochaine = prochaineExecution(w.declencheur, maintenant);
            const statut = derniere ? libelleStatut(derniere.statut) : null;
            return (
              <Carte key={w.code} className="flex flex-col gap-[var(--esp-3)]" >
                <div className="flex items-start justify-between gap-[var(--esp-2)]" style={{ animation: "buta-coche 400ms cubic-bezier(0.22, 1, 0.36, 1) both", animationDelay: `${i * 60}ms` }}>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-3">{w.code}</p>
                    <h2 className="text-[17px] font-semibold text-texte">{w.nom}</h2>
                    <p className="mt-[2px] text-[12px] text-texte-3">{libelleDeclencheur(w.declencheur)}</p>
                  </div>
                  {statut ? <Pastille statut={statut.statut} texte={statut.texte} /> : <Pastille statut="neutre" texte="pas encore exécuté" />}
                </div>
                <p className="text-[13px] leading-[1.45] text-texte-2">{w.description}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-[var(--esp-3)] gap-y-[4px] text-[12px]">
                  <dt className="text-texte-3">Dernière</dt>
                  <dd className="chiffre text-texte">{derniere ? `${formatDateHeure(derniere.debute_le)} · ${formatDuree(derniere.duree_s)}` : "aucune"}</dd>
                  <dt className="text-texte-3">Prochaine</dt>
                  <dd className="chiffre text-texte">{prochaine ? formatDateHeure(prochaine) : "sur événement"}</dd>
                  {derniere?.message ? (<><dt className="text-texte-3">Message</dt><dd className="text-texte-2">{derniere.message}</dd></>) : null}
                </dl>
                {exportDisponible(w.fichier) ? (
                  <a href={w.fichier} download className="mt-auto inline-flex w-fit items-center gap-[6px] rounded-[8px] border border-bordure px-[10px] py-[6px] text-[12px] text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte">
                    <Download size={13} strokeWidth={1.5} aria-hidden="true" />Export JSON
                  </a>
                ) : (
                  <span className="mt-auto inline-flex w-fit items-center gap-[6px] rounded-[8px] border border-dashed border-bordure px-[10px] py-[6px] text-[12px] text-texte-3" title="L'export JSON est publié avec le site une fois le workflow publié dans n8n">
                    <Download size={13} strokeWidth={1.5} aria-hidden="true" />Export JSON après publication
                  </span>
                )}
              </Carte>
            );
          })}
        </div>
      )}

      <Carte titre="Journal des exécutions" sousTitre={lignes.length === 0 ? "Toutes automatisations confondues (table automatisation_run)" : `${formatNombre(Math.min(lignes.length, JOURNAL_MAX))} dernière${lignes.length > 1 ? "s" : ""} exécution${lignes.length > 1 ? "s" : ""}, toutes automatisations confondues (table automatisation_run)`} nu>
        {journal.donnees === undefined ? <Squelette hauteur={320} /> : (
          <Tableau colonnes={colonnes} lignes={journalVisible} cleLigne={(l) => String(l.id)} triInitial={{ cle: "debute_le", sens: "desc" }} compact nomExport="journal-automatisations"
            vide={`Aucune exécution journalisée : les workflows sont créés dans n8n et attendent leur publication (identifiant de connexion Supabase) ; en attendant, la journée simulée est publiée d'avance par script${publieeJusquAu ? ` jusqu'au ${formatDateCourte(publieeJusquAu)}` : ""} et les vues sont rafraîchies chaque matin par une tâche pg_cron de secours. La première ligne apparaîtra à la première exécution publiée.`} />
        )}
      </Carte>

      <Carte titre="Le flux" sousTitre="De n8n aux écrans : les workflows appellent des fonctions SQL, les vues recalculent, l'application lit">
        <SchemaFlux />
      </Carte>

      <LigneSources sources={[{ nom: "Vue mart_automatisation (journal n8n en direct), catalogue des workflows du dépôt", reference: `lu le ${formatDateHeure(maintenant)}` }]}
        hypotheses="Prochaine exécution déduite du déclencheur en heure de Paris ; les exports JSON sont ceux du dossier n8n/ du dépôt, sans aucun secret (les identifiants de connexion n'y figurent que par leur nom)." />
    </div>
  );
}
