/**
 * Schéma du flux (ECRANS.md §9) : n8n appelle des fonctions SQL (RPC) avec la clé service, les vues
 * mart_ recalculent, l'application lit ; les alertes partent par email. SVG inline, flux qui se
 * tracent de gauche à droite (buta-trace), désactivé avec prefers-reduced-motion.
 */
import { NOMBRE_VUES_MART } from "@/donnees/vues";

const BOITES: { x: number; titre: string; lignes: string[] }[] = [
  { x: 20, titre: "n8n", lignes: ["WF1 journée simulée, 06:00", "WF2 contrôles qualité, 06:20", "WF3 revue, lundi 07:00", "WF5 santé, toutes les 6 h", "WF0 sur erreur"] },
  { x: 250, titre: "Supabase (RPC, clé service)", lignes: ["publier_journee, rafraichir_marts", "executer_controles", "faits_revue_hebdo, publier_revue", "journal_run, echecs_consecutifs"] },
  { x: 480, titre: "Vues mart_", lignes: [`${NOMBRE_VUES_MART} vues, dont 3 matérialisées`, "mart_fraicheur, mart_qualite", "mart_revue_hebdo", "mart_automatisation"] },
  { x: 710, titre: "Application", lignes: ["badge de fraîcheur, Qualité", "Plans d'action (revue)", "Automatisations", "instantané statique de secours"] },
];
const LARGEUR_BOITE = 200;
const HAUTEUR_BOITE = 118;
const Y_BOITE = 30;
const EMAIL = { x: 250, y: 170, largeur: 300, hauteur: 36 };

export function SchemaFlux() {
  return (
    <>
    <ol className="flex flex-col gap-[var(--esp-2)] md:hidden" aria-label="Flux : n8n, Supabase, vues mart, application">
      {BOITES.map((b, i) => (
        <li key={b.titre} className="rounded-[12px] border border-bordure bg-surface-2 p-[var(--esp-3)]">
          <p className="text-[12px] font-semibold text-texte"><span className="chiffre text-texte-3">{i + 1}</span> · {b.titre}</p>
          <p className="mt-1 text-[12px] leading-[1.45] text-texte-2">{b.lignes.join(" · ")}</p>
        </li>
      ))}
      <li className="text-[12px] text-texte-3">Email Gmail : synthèse qualité, alertes après trois échecs. Aucun secret dans le navigateur.</li>
    </ol>
    <svg viewBox="0 0 930 236" role="img" aria-label="Flux : n8n appelle les fonctions SQL de Supabase, les vues mart recalculent, l'application lit ; les alertes partent par email" className="w-full text-texte max-md:hidden">
      {BOITES.map((b) => (
        <g key={b.titre}>
          <rect x={b.x} y={Y_BOITE} width={LARGEUR_BOITE} height={HAUTEUR_BOITE} rx={12} className="fill-surface-2 stroke-bordure" strokeWidth={1} />
          <text x={b.x + 14} y={Y_BOITE + 22} className="fill-texte" style={{ fontSize: 12, fontWeight: 600 }}>{b.titre}</text>
          {b.lignes.map((l, i) => (
            <text key={l} x={b.x + 14} y={Y_BOITE + 44 + i * 18} className="fill-texte-2" style={{ fontSize: 11 }}>{l}</text>
          ))}
        </g>
      ))}
      {BOITES.slice(0, -1).map((b, i) => {
        const x1 = b.x + LARGEUR_BOITE;
        const x2 = (BOITES[i + 1]?.x ?? x1) ;
        const y = Y_BOITE + HAUTEUR_BOITE / 2;
        return (
          <g key={b.titre}>
            <path d={`M ${x1} ${y} L ${x2 - 6} ${y}`} fill="none" className="stroke-ambre" strokeWidth={1.5} strokeDasharray={40} strokeDashoffset={40} style={{ animation: "buta-trace 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards", animationDelay: `${300 + i * 350}ms` }} />
            <path d={`M ${x2 - 6} ${y - 4} L ${x2} ${y} L ${x2 - 6} ${y + 4}`} fill="none" className="stroke-ambre" strokeWidth={1.5} style={{ opacity: 0, animation: "buta-coche 200ms forwards", animationDelay: `${850 + i * 350}ms` }} />
          </g>
        );
      })}
      <g>
        <path d={`M ${BOITES[0]!.x + LARGEUR_BOITE / 2} ${Y_BOITE + HAUTEUR_BOITE} L ${BOITES[0]!.x + LARGEUR_BOITE / 2} ${EMAIL.y + EMAIL.hauteur / 2} L ${EMAIL.x - 6} ${EMAIL.y + EMAIL.hauteur / 2}`} fill="none" className="stroke-texte-3" strokeWidth={1} strokeDasharray={260} strokeDashoffset={260} style={{ animation: "buta-trace 800ms cubic-bezier(0.22, 1, 0.36, 1) forwards", animationDelay: "1300ms" }} />
        <rect x={EMAIL.x} y={EMAIL.y} width={EMAIL.largeur} height={EMAIL.hauteur} rx={10} className="fill-surface stroke-bordure" strokeWidth={1} strokeDasharray="4 3" />
        <text x={EMAIL.x + 14} y={EMAIL.y + 23} className="fill-texte-2" style={{ fontSize: 11 }}>Email Gmail : synthèse qualité, alertes après trois échecs</text>
      </g>
      <text x={BOITES[3]!.x + LARGEUR_BOITE} y={228} textAnchor="end" className="fill-texte-3" style={{ fontSize: 11 }}>Aucun secret dans le navigateur : clé anon bornée par la RLS, clé service côté n8n seulement.</text>
    </svg>
    </>
  );
}
