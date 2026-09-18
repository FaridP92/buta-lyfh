import { describe, expect, it } from "vitest";
import { genererLisezMoi, genererMesuresDax, MESURES } from "@/lib/dax";

describe("mesures DAX", () => {
  it("recalcule chaque ratio avec DIVIDE et exclut les lignes de total des sommes", () => {
    const ratios = MESURES.filter((m) => /taux|panier|coût par|conversion|\(%\)|charge/i.test(m.nom));
    expect(ratios.length).toBeGreaterThanOrEqual(10);
    for (const m of ratios) expect(m.expression, m.nom).toMatch(/DIVIDE \(/);
    const sommes = MESURES.filter((m) => /SUM \( mart_/.test(m.expression));
    for (const m of sommes) expect(m.expression, m.nom).toMatch(/\[agence\] <> "RESEAU"/);
    for (const m of MESURES.filter((m) => m.table === "mart_funnel" && /SUM/.test(m.expression))) expect(m.expression, m.nom).toContain('[canal] = "TOUS"');
    for (const m of MESURES.filter((m) => m.table === "mart_couts_acquisition" && /SUM/.test(m.expression))) expect(m.expression, m.nom).toContain('[canal] <> "TOUS"');
  });
  it("porte des noms uniques et cite sa table dans chaque somme", () => {
    const noms = MESURES.map((m) => m.nom);
    expect(new Set(noms).size).toBe(noms.length);
    for (const m of MESURES.filter((m) => /SUM \(/.test(m.expression))) expect(m.expression, m.nom).toContain(`${m.table}[`);
  });
  it("écrit un fichier lisible, groupé par table, sans tiret long", () => {
    const dax = genererMesuresDax("18/09/2026");
    expect(dax).toContain("// ---- Table mart_kpi_mensuel ----");
    expect(dax).toContain("Taux de marge brute =\nDIVIDE ( [Marge brute], [CA signé HT] )");
    expect(dax).toContain("sans lien avec Butagaz");
    expect(dax).not.toMatch(/[–—―]/);
  });
  it("le LISEZMOI décrit l'import, les relations et les pièges", () => {
    const md = genererLisezMoi("17/09/2026", "18/09/2026", 21);
    expect(md).toContain("21 fichiers CSV");
    expect(md).toContain("journée publiée du 17/09/2026");
    expect(md).toContain("point-virgule");
    expect(md).toContain("Ne jamais moyenner un taux");
    expect(md).toContain("dim_date");
    expect(md).not.toMatch(/[–—―]/);
  });
});
