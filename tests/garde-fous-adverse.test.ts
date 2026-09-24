/** SQL adverse contre validerSql, première ligne de défense de l'Analyste (la seconde : rôle analyste_ro + délai 5 s, vérifiés en base). */
import { describe, expect, it } from "vitest";
import { LIMITE_LIGNES, validerSql } from "../supabase/functions/analyste/garde-fous.ts";

const VUES = ["mart_funnel", "mart_ventes", "mart_fraicheur"];
const ok = (sql: string) => validerSql(sql, VUES);
const refuse = (sql: string) => { const v = ok(sql) as { ok?: boolean; sql?: string; motif?: string }; return v.ok === false || ("sql" in v === false); };

describe("validerSql refuse", () => {
  const cas: [string, string][] = [
    ["deux instructions", "select 1 from mart_funnel; drop table fait_dossier"],
    ["écriture", "insert into plan_action default values"],
    ["table brute non listée", "select * from fait_dossier"],
    ["catalogue système", "select * from pg_shadow"],
    ["lecture de fichier", "select pg_read_file('/etc/passwd')"],
    ["pg_sleep", "select pg_sleep(100) from mart_funnel"],
    ["changement de rôle", "set role postgres"],
    ["obfuscation par commentaire", "sel/**/ect * from fait_dossier"],
    ["copy", "copy (select 1) to '/tmp/x'"],
    ["union vers table brute", "select agence from mart_ventes union select commercial from fait_dossier"],
    ["fonction exec via do", "do $$ begin perform 1; end $$"],
    ["schéma explicite hors buta", "select * from public.spatial_ref_sys"],
    ["chaîne trop longue", "select * from mart_funnel where agence = '" + "a".repeat(5000) + "'"],
  ];
  for (const [nom, sql] of cas) it(nom, () => expect(refuse(sql), `${nom} devrait être refusé : ${JSON.stringify(ok(sql))}`).toBe(true));
});

describe("validerSql plafonne", () => {
  it("limit 999999 ramené à LIMITE_LIGNES", () => {
    const v = ok("select * from mart_funnel limit 999999") as { sql?: string };
    expect(v.sql).toMatch(new RegExp(`limit ${LIMITE_LIGNES}\\s*$`, "i"));
  });
  it("sans limit : limit ajouté", () => {
    const v = ok("select agence from mart_ventes") as { sql?: string };
    expect(v.sql).toMatch(new RegExp(`limit ${LIMITE_LIGNES}`, "i"));
  });
  it("CTE sur vue autorisée acceptée", () => {
    const v = ok("with x as (select agence, ca from mart_ventes) select * from x order by ca desc limit 5") as { sql?: string };
    expect(v.sql).toBeTruthy();
  });
});
