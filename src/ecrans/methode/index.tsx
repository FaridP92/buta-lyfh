import { useState } from "react";
import { ArrowRight, Download, ExternalLink } from "lucide-react";
import { Badge } from "@/composants/Badge";
import { telecharger, type LigneExport } from "@/lib/export";
import { construireZipPowerBi, type VueExportee } from "@/lib/powerbi";
import { formatDateCourte } from "@/lib/format";
import { HISTOIRES, OUTILS, SOURCES_REELLES } from "./donnees";

/** Vues exportées, dans l'ordre du modèle ; mart_marche_commune est partitionnée par département dans l'instantané. */
const VUES_EXPORT = [
  "mart_kpi_mensuel", "mart_funnel", "mart_ventes_produit", "mart_ecarts", "mart_couts_acquisition", "mart_delais", "mart_pose",
  "mart_encaissement", "mart_forecast", "mart_remises", "mart_objectif_mensuel", "mart_qualite", "mart_marche_departement",
  "mart_marche_commune", "mart_automatisation", "mart_alertes", "mart_plans_action", "mart_revue_hebdo", "mart_reconciliation_libelles", "mart_fraicheur", "mart_ia_usage",
];
const DEPARTEMENTS_PERIMETRE = ["16", "17", "24", "32", "33", "40", "47", "59", "64", "79", "85"];

async function lireJson(chemin: string): Promise<LigneExport[]> {
  const reponse = await fetch(chemin);
  if (!reponse.ok) throw new Error(`${chemin} : ${reponse.status}`);
  return (await reponse.json()) as LigneExport[];
}

/** Lit les instantanés publiés avec le site (même contenu que les vues à la journée publiée du déploiement). */
async function exporterPowerBi(surAvancement: (texte: string) => void): Promise<void> {
  const meta = (await (await fetch("/data/instantane/_meta.json")).json()) as { journee_publiee?: string | null };
  const vues: VueExportee[] = [];
  for (const [i, nom] of VUES_EXPORT.entries()) {
    surAvancement(`Lecture ${i + 1} / ${VUES_EXPORT.length} : ${nom}`);
    try {
      if (nom === "mart_marche_commune") {
        const parties = await Promise.all(DEPARTEMENTS_PERIMETRE.map((d) => lireJson(`/data/instantane/${nom}-${d}.json`).catch(() => [])));
        vues.push({ nom, lignes: parties.flat() });
      } else {
        vues.push({ nom, lignes: await lireJson(`/data/instantane/${nom}.json`) });
      }
    } catch {
      vues.push({ nom, lignes: [] });
    }
  }
  surAvancement("Compression du zip");
  const aujourdHui = new Date();
  const genereLe = `${String(aujourdHui.getDate()).padStart(2, "0")}/${String(aujourdHui.getMonth() + 1).padStart(2, "0")}/${aujourdHui.getFullYear()}`;
  const zip = construireZipPowerBi(vues, meta.journee_publiee ? formatDateCourte(meta.journee_publiee) : null, genereLe);
  telecharger(`buta-lyfh-power-bi-${aujourdHui.toISOString().slice(0, 10)}.zip`, zip, "application/zip");
}

const TITRE_SECTION = "font-sans text-[18px] font-semibold text-texte";
const PARAGRAPHE = "max-w-[72ch] text-[15px] leading-relaxed text-texte-2";

export function EcranMethode() {
  const [avancement, setAvancement] = useState<string | null>(null);
  const [erreurExport, setErreurExport] = useState<string | null>(null);

  async function surExport() {
    setErreurExport(null);
    setAvancement("Préparation");
    try {
      await exporterPowerBi(setAvancement);
      setAvancement(null);
    } catch (e) {
      setAvancement(null);
      setErreurExport(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col gap-[var(--esp-6)] pb-[var(--esp-6)]">
      <header className="flex flex-col gap-[var(--esp-3)]">
        <h1 className="font-serif-titre text-[32px] leading-[1.1] text-texte max-md:text-[26px]">
          Méthode et auteur
        </h1>
        <p className={PARAGRAPHE}>
          Ce que Buta.Lyfh est, ce qu'il n'est pas, d'où viennent les chiffres, et qui l'a construit.
        </p>
      </header>

      <section className="flex flex-col gap-[var(--esp-3)] rounded-[var(--rayon-carte)] border border-bordure bg-surface p-[var(--esp-4)]">
        <h2 className={TITRE_SECTION}>Ce que c'est, ce que ce n'est pas</h2>
        <p className={PARAGRAPHE}>
          Buta.Lyfh est un démonstrateur personnel de Frédéric Poissonnier, construit à l'appui d'une
          candidature au poste de Responsable Performance chez Butagaz Eco-énergie (entretien téléphonique
          le mardi 22 septembre 2026). Il n'est affilié ni à Butagaz ni à Butagaz Eco-énergie.
        </p>
        <p className={PARAGRAPHE}>
          C'est un cockpit de pilotage d'un réseau d'installateurs simulé, du lead à l'encaissement,
          construit sur le marché réel des territoires publiés par Butagaz Eco-énergie : pilotage,
          analyse des écarts, forecast, plans d'action, contrôles de cohérence des données, automatisation.
        </p>
        <p className={PARAGRAPHE}>
          Ce n'est ni un outil Butagaz, ni une base de données Butagaz, ni une recommandation
          d'implantation. Aucun logo, aucune couleur, aucun chiffre présenté comme celui de Butagaz.
          Les données de marché affichées sont réelles et sourcées ; les données d'activité (leads,
          ventes, poses, encaissements) sont entièrement simulées.
        </p>
        <div className="mt-[var(--esp-2)] flex flex-wrap gap-[var(--esp-2)]">
          <Badge variante="reel">Marché : données réelles, sourcées</Badge>
          <Badge variante="simule">Activité : données simulées</Badge>
        </div>
      </section>

      <section className="flex flex-col gap-[var(--esp-3)]">
        <h2 className={TITRE_SECTION}>Sources réelles</h2>
        <p className={PARAGRAPHE}>
          Vérifiées le 17 septembre 2026 par requête directe sur chaque source. Le détail des colonnes
          retenues et des chiffres de contrôle est dans le journal du projet.
        </p>
        <div className="overflow-x-auto rounded-[var(--rayon-carte)] border border-bordure">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-bordure bg-surface-2 text-left text-[12px] text-texte-3">
                <th className="px-[var(--esp-3)] py-[var(--esp-2)] font-medium">Source</th>
                <th className="px-[var(--esp-3)] py-[var(--esp-2)] font-medium">Contenu retenu</th>
                <th className="px-[var(--esp-3)] py-[var(--esp-2)] font-medium">Licence</th>
                <th className="px-[var(--esp-3)] py-[var(--esp-2)] font-medium">Référence</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES_REELLES.map((source) => (
                <tr key={source.nom} className="border-b border-bordure last:border-0">
                  <td className="px-[var(--esp-3)] py-[var(--esp-2)] text-texte">
                    <a
                      href={source.lien}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 underline decoration-texte-3/40 underline-offset-2 hover:text-ambre-texte"
                    >
                      {source.nom}
                      <ExternalLink size={11} strokeWidth={1.5} aria-hidden="true" />
                    </a>
                  </td>
                  <td className="px-[var(--esp-3)] py-[var(--esp-2)] text-texte-2">{source.contenu}</td>
                  <td className="px-[var(--esp-3)] py-[var(--esp-2)] text-texte-2">{source.licence}</td>
                  <td className="px-[var(--esp-3)] py-[var(--esp-2)] text-texte-2">{source.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-[var(--esp-3)]">
        <h2 className={TITRE_SECTION}>Le modèle de simulation</h2>
        <p className={PARAGRAPHE}>
          Le réseau simulé compte neuf agences nommées par bassin géographique, jamais par un nom
          d'agence réelle, positionnées au centre de leur bassin. Les effectifs sont des codes (par
          exemple <code className="chiffre text-[13px]">C-SAI-01</code>), jamais des noms. Canaux,
          produits, règles de génération et ordres de grandeur sont écrits dans la documentation du
          projet et restent à vérifier : ils ne prétendent reproduire aucune activité réelle. La
          génération est déterministe (graine fixe), sur la période complète du 1er janvier 2025 au 31
          décembre 2026, publiée jour après jour.
        </p>
        <p className={PARAGRAPHE}>
          Sept histoires sont injectées dans le jeu simulé, pour donner au pilotage quelque chose à
          raconter. Elles sont retrouvables à l'écran, là où la fiche de chaque page le prévoit, et par
          l'analyste quand il répond à une question qui les concerne.
        </p>
        <ul className="grid gap-[var(--esp-2)] sm:grid-cols-2">
          {HISTOIRES.map((histoire) => (
            <li
              key={histoire.code}
              className="rounded-[var(--rayon-carte)] border border-bordure bg-surface p-[var(--esp-3)]"
            >
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ambre-texte">
                {histoire.code} · {histoire.titre}
              </p>
              <p className="text-[13px] leading-relaxed text-texte-2">{histoire.texte}</p>
            </li>
          ))}
        </ul>
        <p className="max-w-[72ch] text-[13px] font-semibold text-texte">
          Aucune agence, personne ou entité réelle n'est associée à une performance simulée.
        </p>
      </section>

      <section className="flex flex-col gap-[var(--esp-3)] rounded-[var(--rayon-carte)] border border-bordure bg-surface p-[var(--esp-4)]">
        <h2 className={TITRE_SECTION}>Le contexte public</h2>
        <p className={PARAGRAPHE}>
          Butagaz Eco-énergie publie sur son site dix départements (16, 17, 79, 85, 24, 33, 47, 32, 40,
          64) et huit agences ; le rachat de Lumélio (Douaisis) a été annoncé en mai 2026. C'est le seul
          endroit de ce démonstrateur où ces faits publics sont cités. Le maillage simulé de Buta.Lyfh
          reprend ces bassins géographiques, jamais ces agences : les neuf agences de la simulation
          portent des noms de bassins et ne correspondent à aucune agence réelle de Butagaz Eco-énergie.
        </p>
      </section>

      <section className="flex flex-col gap-[var(--esp-3)]">
        <h2 className={TITRE_SECTION}>Architecture</h2>
        <p className={PARAGRAPHE}>
          Principe directeur : le modèle de langage ne calcule jamais un chiffre. Les faits sont
          calculés en SQL (vues <code className="chiffre text-[13px]">mart_</code>) et transmis au
          modèle, qui rédige.
        </p>
        <div className="flex flex-wrap items-center gap-[var(--esp-2)] overflow-x-auto rounded-[var(--rayon-carte)] border border-bordure bg-surface p-[var(--esp-4)]">
          {[
            "Sources réelles + génération simulée",
            "Supabase (schéma buta, vues mart_)",
            "Application React",
          ].map((etape, i, tableau) => (
            <div key={etape} className="flex items-center gap-[var(--esp-2)]">
              <span className="rounded-[10px] border border-bordure bg-surface-2 px-[var(--esp-3)] py-[var(--esp-2)] text-[12px] text-texte">
                {etape}
              </span>
              {i < tableau.length - 1 && (
                <ArrowRight size={16} strokeWidth={1.5} className="text-texte-3" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
        <p className="text-[12px] text-texte-3">
          n8n déclenche les publications et les contrôles quotidiens par RPC Supabase ; les Edge
          Functions portent l'analyste et l'explication des écarts.
        </p>
        <ul className="grid gap-[var(--esp-2)] sm:grid-cols-2">
          {OUTILS.map((outil) => (
            <li key={outil.nom} className="rounded-[var(--rayon-carte)] border border-bordure p-[var(--esp-3)]">
              <p className="text-[13px] font-medium text-texte">{outil.nom}</p>
              <p className="text-[12px] text-texte-3">{outil.role}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-[var(--esp-3)]">
        <h2 className={TITRE_SECTION}>Export pour Power BI</h2>
        <p className={PARAGRAPHE}>
          Un fichier zip avec un CSV par vue mart_ (vingt et une tables, séparateur point-virgule, décimale à la
          virgule, UTF-8) et <code className="chiffre text-[13px]">modele_etoile.md</code>, qui décrit le modèle en
          étoile, le grain et les clés de chaque table. Le contenu est celui des vues à la journée publiée de la
          dernière mise en ligne. <code className="chiffre text-[13px]">mesures.dax</code> porte les mesures du modèle
          (ratios recalculés depuis les sommes, lignes de total exclues) et <code className="chiffre text-[13px]">LISEZMOI.md</code> la
          marche à suivre dans Power BI (import, table de dates, relations, pièges).
        </p>
        <div className="flex flex-wrap items-center gap-[var(--esp-3)]">
          <button
            type="button"
            onClick={surExport}
            disabled={avancement !== null}
            className="flex w-fit items-center gap-[6px] rounded-[10px] border border-bordure px-[var(--esp-3)] py-[8px] text-[13px] text-texte-2 transition-colors hover:bg-surface-2 hover:text-texte disabled:opacity-60"
          >
            <Download size={14} strokeWidth={1.5} aria-hidden="true" />
            {avancement ? `${avancement}…` : "Exporter pour Power BI (zip)"}
          </button>
          {erreurExport && <p className="text-[12px] text-alerte">Export impossible : {erreurExport}</p>}
        </div>
      </section>

      <section className="flex flex-col gap-[var(--esp-3)] rounded-[var(--rayon-carte)] border border-bordure bg-surface p-[var(--esp-4)]">
        <h2 className={TITRE_SECTION}>L'auteur</h2>
        <p className={PARAGRAPHE}>
          Frédéric Poissonnier construit des démonstrateurs de pilotage sur des données ouvertes,
          appuyés sur des faits calculés en base et lisibles par leurs sources. Buta.Lyfh, Courant et
          CoPilote Atelier partagent la même discipline : aucun chiffre sans requête, aucune donnée
          réelle présentée comme celle d'un tiers sans son accord.
        </p>
        <div className="flex flex-wrap gap-[var(--esp-2)]">
          <a
            href="https://www.linkedin.com/in/f-poissonnier/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-[10px] border border-bordure px-[var(--esp-3)] py-[8px] text-[13px] text-texte hover:bg-surface-2"
          >
            LinkedIn <ExternalLink size={12} strokeWidth={1.5} aria-hidden="true" />
          </a>
          <a
            href="/cv-frederic-poissonnier.pdf"
            className="flex items-center gap-1 rounded-[10px] border border-bordure px-[var(--esp-3)] py-[8px] text-[13px] text-texte hover:bg-surface-2"
          >
            CV (PDF) <Download size={12} strokeWidth={1.5} aria-hidden="true" />
          </a>
          <a
            href="https://courant-sable.vercel.app/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-[10px] border border-bordure px-[var(--esp-3)] py-[8px] text-[13px] text-texte hover:bg-surface-2"
          >
            Courant <ExternalLink size={12} strokeWidth={1.5} aria-hidden="true" />
          </a>
          <a
            href="https://copilote-atelier.vercel.app/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-[10px] border border-bordure px-[var(--esp-3)] py-[8px] text-[13px] text-texte hover:bg-surface-2"
          >
            CoPilote Atelier <ExternalLink size={12} strokeWidth={1.5} aria-hidden="true" />
          </a>
          <a
            href="mailto:faridp@free.fr"
            className="flex items-center gap-1 rounded-[10px] border border-bordure px-[var(--esp-3)] py-[8px] text-[13px] text-texte hover:bg-surface-2"
          >
            faridp@free.fr
          </a>
        </div>
      </section>
    </div>
  );
}
