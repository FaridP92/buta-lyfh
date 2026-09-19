/**
 * Lignage (ECRANS.md §8) : sources vers staging vers vues mart vers écrans, en SVG inline.
 * Les flux se tracent de gauche à droite (stroke-dashoffset, DESIGN.md §11), désactivé avec prefers-reduced-motion.
 */
const COLONNES: { titre: string; noeuds: string[] }[] = [
  { titre: "Sources", noeuds: ["Insee Logement 2022", "ADEME RGE", "RTE registre", "ADEME DPE", "Système source simulé"] },
  { titre: "Préparation", noeuds: ["marche_departement", "marche_commune", "rge_installateur", "fait_dossier, coûts, charges"] },
  { titre: "Vues mart", noeuds: ["mart_marche_*", "mart_kpi_mensuel, mart_ecarts", "mart_funnel, mart_couts", "mart_forecast, mart_pose", "mart_qualite, mart_alertes"] },
  { titre: "Écrans", noeuds: ["Territoires", "Vue d'ensemble, Ventes", "Funnel", "Forecast", "Qualité"] },
];

const LIENS: [number, number, number][] = [
  [0, 0, 0], [0, 0, 1], [0, 1, 2], [0, 2, 0], [0, 3, 0], [0, 3, 1], [0, 4, 3],
  [1, 0, 0], [1, 1, 0], [1, 2, 0], [1, 3, 1], [1, 3, 2], [1, 3, 3], [1, 3, 4],
  [2, 0, 0], [2, 1, 1], [2, 2, 2], [2, 3, 3], [2, 4, 4], [2, 1, 4], [2, 3, 1],
];

const LARGEUR = 760;
const HAUTEUR = 240;
const X = [40, 250, 460, 670];
const Y0 = 44;
const PAS = 40;

export function Lignage() {
  return (
    <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} role="img" aria-label="Lignage : les sources alimentent le staging, les vues mart calculent, les écrans lisent" className="w-full text-texte">
      {COLONNES.map((c, i) => (
        <text key={c.titre} x={X[i]} y={20} className="fill-texte-3" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{c.titre.toUpperCase()}</text>
      ))}
      {LIENS.map(([col, de, vers], i) => {
        const x1 = (X[col] ?? 0) + 150;
        const y1 = Y0 + de * PAS;
        const x2 = X[col + 1] ?? 0;
        const y2 = Y0 + vers * PAS;
        const cx = (x1 + x2) / 2;
        return (
          <path key={i} d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`} fill="none" className="stroke-texte-3" strokeWidth={1} strokeOpacity={0.55}
            strokeDasharray={260} strokeDashoffset={260} style={{ animation: "buta-trace 900ms cubic-bezier(0.22, 1, 0.36, 1) forwards", animationDelay: `${col * 350 + i * 20}ms` }} />
        );
      })}
      {COLONNES.map((c, i) => c.noeuds.map((n, j) => (
        <g key={`${i}-${j}`} style={{ animation: "buta-coche 300ms ease-out both", animationDelay: `${i * 350}ms` }}>
          <rect x={X[i]} y={Y0 + j * PAS - 12} width={150} height={24} rx={7} className={i === 2 ? "fill-accent/15 stroke-accent/60" : "fill-surface-2 stroke-bordure"} strokeWidth={1} />
          <text x={(X[i] ?? 0) + 8} y={Y0 + j * PAS + 4} className="fill-texte" style={{ fontSize: 11 }}>{n}</text>
        </g>
      )))}
    </svg>
  );
}
