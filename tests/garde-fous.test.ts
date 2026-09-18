import { describe, expect, it } from "vitest";
import { sourcesCitees, validerSql } from "../supabase/functions/analyste/garde-fous.ts";

const VUES = ["mart_kpi_mensuel", "mart_funnel", "mart_couts_acquisition", "mart_marche_departement", "mart_alertes"];

describe("sourcesCitees", () => {
  it("repère les tables après from et join, avec alias, virgules, préfixe de schéma et sous-requêtes", () => {
    expect(sourcesCitees("select * from mart_kpi_mensuel k join buta.mart_funnel as f on f.mois = k.mois, mart_alertes a where k.agence = 'SAI'").tables)
      .toEqual(["mart_kpi_mensuel", "buta.mart_funnel", "mart_alertes"]);
    expect(sourcesCitees("select * from (select agence from mart_kpi_mensuel) t left join mart_funnel f on true").tables).toEqual(["mart_kpi_mensuel", "mart_funnel"]);
    expect(sourcesCitees("select * from generate_series(1, 3) g, mart_alertes").fonctions).toEqual(["generate_series"]);
  });
});

describe("validerSql", () => {
  it("accepte une requête select simple et ajoute la limite", () => {
    const v = validerSql("select agence, ca_signe from mart_kpi_mensuel where mois = date '2026-08-01' order by ca_signe desc", VUES);
    expect(v.ok).toBe(true);
    expect(v.sql.endsWith("limit 200")).toBe(true);
  });
  it("plafonne une limite trop haute et retire le point-virgule final", () => {
    const v = validerSql("select * from mart_alertes limit 5000;", VUES);
    expect(v.ok).toBe(true);
    expect(v.sql).toBe("select * from mart_alertes limit 200");
    expect(validerSql("select * from mart_alertes limit 10", VUES).sql).toBe("select * from mart_alertes limit 10");
  });
  it("accepte une CTE et une sous-requête sur des vues autorisées", () => {
    const v = validerSql("with base as (select agence, sum(ca_signe) as ca from mart_kpi_mensuel group by agence) select * from base order by ca desc", VUES);
    expect(v.ok).toBe(true);
    expect(validerSql("select count(*) from (select agence from buta.mart_funnel) t", VUES).ok).toBe(true);
  });
  it("refuse les écritures, les points-virgules, les commentaires et les mots interdits", () => {
    expect(validerSql("delete from mart_alertes", VUES).motif).toContain("SELECT");
    expect(validerSql("select 1 from mart_alertes; drop table x", VUES).motif).toBe("point-virgule refusé");
    expect(validerSql("select 1 from mart_alertes -- commentaire", VUES).motif).toBe("commentaire refusé");
    expect(validerSql("select * from mart_alertes where 1 = (select 1 from pg_sleep(5))", VUES).motif).toContain("interdit");
    expect(validerSql("select set_config('a', 'b', true) from mart_alertes", VUES).motif).toContain("interdit");
    expect(validerSql("select * into t from mart_alertes", VUES).motif).toContain("interdit");
  });
  it("refuse les tables hors liste blanche, même dans une sous-requête, et les schémas système", () => {
    expect(validerSql("select count(*) from fait_dossier", VUES).motif).toBe("vue non autorisée : fait_dossier");
    expect(validerSql("select (select count(*) from buta.fait_dossier) from mart_alertes", VUES).motif).toBe("vue non autorisée : fait_dossier");
    expect(validerSql("select * from public.spatial_ref_sys", VUES).motif).toBe("schéma refusé");
    expect(validerSql("select * from information_schema.tables", VUES).motif).toBe("catalogue système refusé");
    expect(validerSql("select * from mart_alertes a, unknown_fn(1)", VUES).motif).toBe("fonction de table refusée : unknown_fn");
  });
  it("refuse une requête vide ou trop longue", () => {
    expect(validerSql("   ", VUES).ok).toBe(false);
    expect(validerSql(`select * from mart_alertes where texte = '${"x".repeat(4100)}'`, VUES).motif).toContain("trop longue");
  });
});
