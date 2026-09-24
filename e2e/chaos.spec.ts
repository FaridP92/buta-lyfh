/**
 * Chaos (VERIFICATION.md) : pannes sur les dépendances de Buta.Lyfh, simulé au niveau réseau du navigateur.
 * Hypothèse de résilience : chaque écran reste lisible (instantané statique) quand Supabase est coupé, lent ou
 * renvoie n'importe quoi, et l'écran Analyste dit clairement qu'il n'a pas de réponse quand l'Edge Function coupe
 * ou répond hors contrat. Le délai de deux minutes côté navigateur est vérifié en unitaire (tests/ia.test.ts).
 */
import { expect, test, type Page } from "@playwright/test";

const SUPABASE = "**/*.supabase.co/**";
const ECRANS = ["/ventes", "/forecast", "/qualite", "/plans-action"];

function surveiller(page: Page) {
  const fatales: string[] = [];
  page.on("pageerror", (e) => fatales.push(String(e)));
  return fatales;
}

for (const route of ECRANS) {
  test(`Supabase coupé (connexion refusée) : ${route} affiche l'instantané`, async ({ page }) => {
    const fatales = surveiller(page);
    await page.route(SUPABASE, (r) => r.abort("connectionrefused"));
    await page.goto(route);
    await expect(page.getByRole("contentinfo")).toContainText("Démonstrateur personnel");
    await expect(page.getByText("instantané", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(fatales).toEqual([]);
  });
}

test("Supabase lent (20 s sans réponse) : l'instantané s'affiche en moins de 8 s, sans attendre", async ({ page }) => {
  const fatales = surveiller(page);
  await page.route(SUPABASE, async (r) => {
    await new Promise((ok) => setTimeout(ok, 20_000));
    await r.abort("timedout");
  });
  const debut = Date.now();
  await page.goto("/forecast");
  await expect(page.getByText("instantané", { exact: true }).first()).toBeVisible({ timeout: 8_000 });
  expect(Date.now() - debut).toBeLessThan(8_000);
  expect(fatales).toEqual([]);
});

test("Supabase répond 200 avec un corps corrompu : Zod rejette, l'instantané reste", async ({ page }) => {
  const fatales = surveiller(page);
  await page.route(SUPABASE, (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[{\"ca\": \"pas un nombre\", " }));
  await page.goto("/ventes");
  await expect(page.getByText("instantané", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  expect(fatales).toEqual([]);
});

test("Supabase répond 500 : pas d'écran blanc, instantané et pied de page présents", async ({ page }) => {
  const fatales = surveiller(page);
  await page.route(SUPABASE, (r) => r.fulfill({ status: 500, contentType: "application/json", body: "{\"message\":\"panne\"}" }));
  await page.goto("/qualite");
  await expect(page.getByText("instantané", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("contentinfo")).toBeVisible();
  expect(fatales).toEqual([]);
});

test("Supabase et instantané coupés tous les deux : dégradation annoncée, aucune exception non gérée", async ({ page }) => {
  const fatales = surveiller(page);
  await page.route(SUPABASE, (r) => r.abort("connectionrefused"));
  await page.route("**/data/instantane/**", (r) => r.fulfill({ status: 404, body: "" }));
  await page.goto("/ventes");
  await expect(page.getByRole("contentinfo")).toContainText("Démonstrateur personnel");
  await page.waitForTimeout(3_000);
  expect(fatales).toEqual([]);
});

test("Edge Function analyste coupée en cours de requête : l'écran dit « Pas de réponse »", async ({ page }) => {
  const fatales = surveiller(page);
  await page.route("**/functions/v1/analyste", async (r) => {
    await new Promise((ok) => setTimeout(ok, 3_000));
    await r.abort("connectionreset");
  });
  await page.goto("/analyste");
  const champ = page.getByPlaceholder(/Quel canal a le coût par vente/);
  await champ.fill("Quel est le CA du mois ?");
  await page.getByRole("button", { name: "Demander" }).click();
  await expect(page.getByRole("heading", { name: "Pas de réponse" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Demander" })).toBeEnabled();
  expect(fatales).toEqual([]);
});

test("Edge Function analyste répond 200 avec du HTML (passerelle) : « Pas de réponse », formulaire rendu", async ({ page }) => {
  const fatales = surveiller(page);
  await page.route("**/functions/v1/analyste", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<html>maintenance</html>" }));
  await page.goto("/analyste");
  await page.getByPlaceholder(/Quel canal a le coût par vente/).fill("Quel est le CA du mois ?");
  await page.getByRole("button", { name: "Demander" }).click();
  await expect(page.getByRole("heading", { name: "Pas de réponse" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("main")).toContainText("Réponse illisible du service");
  await expect(page.getByRole("button", { name: "Demander" })).toBeEnabled();
  expect(fatales).toEqual([]);
});

