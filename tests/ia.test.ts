/**
 * Contrat entre le front et les Edge Functions IA, Supabase simulé.
 * Vérifie que chaque forme de réponse (2xx, non-2xx avec corps, non-2xx illisible, corps hors contrat)
 * produit un résultat déterministe côté front.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/donnees/client", () => ({ supabase: { functions: { invoke } } }));

const { poserQuestion, expliquerEcartIa } = await import("@/donnees/ia");

function erreurAvecCorps(corps: unknown, statut = 429) {
  const contexte = new Response(JSON.stringify(corps), { status: statut, headers: { "content-type": "application/json" } });
  return { data: null, error: Object.assign(new Error("non-2xx"), { context: contexte }) };
}

beforeEach(() => invoke.mockReset());

describe("poserQuestion : contrat de réponse", () => {
  it("2xx conforme : la réponse est rendue telle quelle, validée par Zod", async () => {
    invoke.mockResolvedValue({ data: { statut: "ok", sql: "select 1", colonnes: ["a"], lignes: [{ a: 1 }], reponse: "Un.", sources: ["mart_x"] }, error: null });
    const r = await poserQuestion("q");
    expect(r.statut).toBe("ok");
    expect(r.lignes).toEqual([{ a: 1 }]);
    expect(invoke).toHaveBeenCalledWith("analyste", expect.objectContaining({ body: { question: "q" } }));
  });

  it("429 quota avec corps JSON : le statut du corps est conservé", async () => {
    invoke.mockResolvedValue(erreurAvecCorps({ statut: "quota", motif_refus: "budget atteint", budget_jour: 1.5, cout_jour: 1.5 }, 429));
    const r = await poserQuestion("q");
    expect(r.statut).toBe("quota");
    expect(r.motif_refus).toBe("budget atteint");
  });

  it("422 refus avec corps JSON : motif et explication conservés", async () => {
    invoke.mockResolvedValue(erreurAvecCorps({ statut: "refus", motif: "hors_perimetre", motif_refus: "Hors périmètre", explication_courte: "x" }, 422));
    const r = await poserQuestion("q");
    expect(r).toMatchObject({ statut: "refus", motif: "hors_perimetre" });
  });

  it("503 avec corps HTML (passerelle) : message générique, jamais d'exception", async () => {
    const contexte = new Response("<html>Bad gateway</html>", { status: 502 });
    invoke.mockResolvedValue({ data: null, error: Object.assign(new Error("non-2xx"), { context: contexte }) });
    const r = await poserQuestion("q");
    expect(r).toEqual({ statut: "erreur", message: "Le service est momentanément indisponible." });
  });

  it("erreur réseau sans contexte (DNS, coupure) : message générique", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("Failed to fetch") });
    const r = await poserQuestion("q");
    expect(r.statut).toBe("erreur");
  });

  it("2xx hors contrat (statut inconnu) : rejeté par Zod, l'écran doit l'attraper", async () => {
    invoke.mockResolvedValue({ data: { statut: "bizarre" }, error: null });
    await expect(poserQuestion("q")).rejects.toThrow();
  });

  it("2xx avec chiffre injecté hors lignes : le schéma n'accepte aucun champ numérique libre non déclaré", async () => {
    invoke.mockResolvedValue({ data: { statut: "ok", reponse: "CA 12 345 €", lignes: [], colonnes: [], chiffre_invente: 12345 }, error: null });
    const r = await poserQuestion("q");
    expect("chiffre_invente" in r).toBe(false);
  });
});

describe("poserQuestion : délai côté navigateur", () => {
  it("l'appel porte un signal d'abandon (délai de deux minutes)", async () => {
    invoke.mockResolvedValue({ data: { statut: "ok" }, error: null });
    await poserQuestion("q");
    const options = invoke.mock.calls[0]?.[1] as { signal?: unknown };
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("délai dépassé : message dédié, jamais d'exception", async () => {
    invoke.mockResolvedValue({ data: null, error: Object.assign(new Error("fetch"), { context: new DOMException("délai", "TimeoutError") }) });
    const r = await poserQuestion("q");
    expect(r.statut).toBe("erreur");
    expect(r.message).toMatch(/deux minutes/);
  });
});

describe("expliquerEcartIa : contrat d'appel", () => {
  it("transmet périmètre, mois et indicateur au bon nom de fonction", async () => {
    invoke.mockResolvedValue({ data: { statut: "ok", explication: { constat: "c", causes: [{ texte: "t", fait: "f" }], action: "a" }, cache: true }, error: null });
    const r = await expliquerEcartIa("SAI", "2026-08", "MARGE");
    expect(invoke).toHaveBeenCalledWith("expliquer-ecart", expect.objectContaining({ body: { perimetre: "SAI", mois: "2026-08", indicateur: "MARGE" } }));
    expect(r.explication?.causes[0]?.fait).toBe("f");
  });
});
