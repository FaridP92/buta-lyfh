import { ArrowRight, Download, ExternalLink } from "lucide-react";
import { Badge } from "@/composants/Badge";
import { HISTOIRES, OUTILS, SOURCES_REELLES } from "./donnees";

const TITRE_SECTION = "font-sans text-[18px] font-semibold text-texte";
const PARAGRAPHE = "max-w-[72ch] text-[15px] leading-relaxed text-texte-2";

export function EcranMethode() {
  return (
    <div className="flex flex-col gap-[var(--esp-6)] pb-[var(--esp-6)]">
      <header className="flex flex-col gap-[var(--esp-3)]">
        <h1 className="font-serif-titre text-[32px] leading-[1.1] text-texte max-md:text-[26px]">
          Methode et auteur
        </h1>
        <p className={PARAGRAPHE}>
          Ce que Buta.Lyfh est, ce qu'il n'est pas, d'ou viennent les chiffres, et qui l'a construit.
        </p>
      </header>

      <section className="flex flex-col gap-[var(--esp-3)] rounded-[var(--rayon-carte)] border border-bordure bg-surface p-[var(--esp-4)]">
        <h2 className={TITRE_SECTION}>Ce que c'est, ce que ce n'est pas</h2>
        <p className={PARAGRAPHE}>
          Buta.Lyfh est un demonstrateur personnel de Frederic Poissonnier, construit a l'appui d'une
          candidature au poste de Responsable Performance chez Butagaz Eco-energie (entretien telephonique
          le mardi 22 septembre 2026). Il n'est affilie ni a Butagaz ni a Butagaz Eco-energie.
        </p>
        <p className={PARAGRAPHE}>
          C'est un cockpit de pilotage d'un reseau d'installateurs simule, du lead a l'encaissement,
          construit sur le marche reel des territoires publies par Butagaz Eco-energie : pilotage,
          analyse des ecarts, forecast, plans d'action, controles de cohesion des donnees, automatisation.
        </p>
        <p className={PARAGRAPHE}>
          Ce n'est ni un outil Butagaz, ni une base de donnees Butagaz, ni une recommandation
          d'implantation. Aucun logo, aucune couleur, aucun chiffre presente comme celui de Butagaz.
          Les donnees de marche affichees sont reelles et sourcees ; les donnees d'activite (leads,
          ventes, poses, encaissements) sont entierement simulees.
        </p>
        <div className="mt-[var(--esp-2)] flex flex-wrap gap-[var(--esp-2)]">
          <Badge variante="reel">Marche : donnees reelles, sourcees</Badge>
          <Badge variante="simule">Activite : donnees simulees</Badge>
        </div>
      </section>

      <section className="flex flex-col gap-[var(--esp-3)]">
        <h2 className={TITRE_SECTION}>Sources reelles</h2>
        <p className={PARAGRAPHE}>
          Verifiees le 17 septembre 2026 par requete directe sur chaque source. Le detail des colonnes
          retenues et des chiffres de controle est dans le journal du projet.
        </p>
        <div className="overflow-x-auto rounded-[var(--rayon-carte)] border border-bordure">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-bordure bg-surface-2 text-left text-[12px] text-texte-3">
                <th className="px-[var(--esp-3)] py-[var(--esp-2)] font-medium">Source</th>
                <th className="px-[var(--esp-3)] py-[var(--esp-2)] font-medium">Contenu retenu</th>
                <th className="px-[var(--esp-3)] py-[var(--esp-2)] font-medium">Licence</th>
                <th className="px-[var(--esp-3)] py-[var(--esp-2)] font-medium">Reference</th>
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
        <h2 className={TITRE_SECTION}>Le modele de simulation</h2>
        <p className={PARAGRAPHE}>
          Le reseau simule compte neuf agences nommees par bassin geographique, jamais par un nom
          d'agence reelle, positionnees au centre de leur bassin. Les effectifs sont des codes (par
          exemple <code className="chiffre text-[13px]">C-SAI-01</code>), jamais des noms. Canaux,
          produits, regles de generation et ordres de grandeur sont ecrits dans la documentation du
          projet et restent a verifier : ils ne pretendent reproduire aucune activite reelle. La
          generation est deterministe (graine fixe), sur la periode complete du 1er janvier 2025 au 31
          decembre 2026, publiee jour apres jour.
        </p>
        <p className={PARAGRAPHE}>
          Sept histoires sont injectees dans le jeu simule, pour donner au pilotage quelque chose a
          raconter. Elles sont retrouvables a l'ecran, la ou la fiche de chaque page le prevoit, et par
          l'analyste quand il repond a une question qui les concerne.
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
          Aucune agence, personne ou entite reelle n'est associee a une performance simulee.
        </p>
      </section>

      <section className="flex flex-col gap-[var(--esp-3)] rounded-[var(--rayon-carte)] border border-bordure bg-surface p-[var(--esp-4)]">
        <h2 className={TITRE_SECTION}>Le contexte public</h2>
        <p className={PARAGRAPHE}>
          Butagaz Eco-energie publie sur son site dix departements (16, 17, 79, 85, 24, 33, 47, 32, 40,
          64) et huit agences ; le rachat de Lumelio (Douaisis) a ete annonce en mai 2026. C'est le seul
          endroit de ce demonstrateur ou ces faits publics sont cites. Le maillage simule de Buta.Lyfh
          reprend ces bassins geographiques, jamais ces agences : les neuf agences de la simulation
          portent des noms de bassins et ne correspondent a aucune agence reelle de Butagaz Eco-energie.
        </p>
      </section>

      <section className="flex flex-col gap-[var(--esp-3)]">
        <h2 className={TITRE_SECTION}>Architecture</h2>
        <p className={PARAGRAPHE}>
          Principe directeur : le modele de langage ne calcule jamais un chiffre. Les faits sont
          calcules en SQL (vues <code className="chiffre text-[13px]">mart_</code>) et transmis au
          modele, qui redige.
        </p>
        <div className="flex flex-wrap items-center gap-[var(--esp-2)] overflow-x-auto rounded-[var(--rayon-carte)] border border-bordure bg-surface p-[var(--esp-4)]">
          {[
            "Sources reelles + generation simulee",
            "Supabase (schema buta, vues mart_)",
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
          n8n declenche les publications et les controles quotidiens par RPC Supabase ; les Edge
          Functions portent l'analyste et l'explication des ecarts.
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
          Un fichier zip avec les tables au format CSV issues des vues mart_ et un modele en etoile
          documente. Disponible des que les vues sont en ligne.
        </p>
        <button
          type="button"
          disabled
          title="Disponible avec les vues mart_ (lot 3)"
          className="flex w-fit items-center gap-[6px] rounded-[10px] border border-bordure px-[var(--esp-3)] py-[8px] text-[13px] text-texte-2 opacity-40"
        >
          <Download size={14} strokeWidth={1.5} aria-hidden="true" />
          Exporter pour Power BI
        </button>
      </section>

      <section className="flex flex-col gap-[var(--esp-3)] rounded-[var(--rayon-carte)] border border-bordure bg-surface p-[var(--esp-4)]">
        <h2 className={TITRE_SECTION}>L'auteur</h2>
        <p className={PARAGRAPHE}>
          Frederic Poissonnier construit des demonstrateurs de pilotage sur des donnees ouvertes,
          appuyes sur des faits calcules en base et lisibles par leurs sources. Buta.Lyfh, Courant et
          CoPilote Atelier partagent la meme discipline : aucun chiffre sans requete, aucune donnee
          reelle presentee comme celle d'un tiers sans son accord.
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
