import { expect, test } from "@playwright/test";

const ROUTES_VISIBLES = ["/", "/territoires", "/funnel", "/ventes", "/forecast", "/pose", "/plans-action", "/qualite", "/automatisations", "/analyste", "/methode"];

test("les filtres de l'URL pilotent l'écran (période, comparaison, agence)", async ({ page }) => {
  await page.goto("/ventes?periode=2026-06&comparaison=n1&agence=SAI");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Saintonge");
  await expect(page.getByRole("main")).toContainText("juin 2026");
  await expect(page.getByRole("main")).toContainText("N-1");
  // Changer d'agence par l'URL change le titre sans recharger l'application.
  await page.goto("/funnel?agence=NOR");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nord");
});

test("aucun écran « à venir » n'est visible et un écran non fini renvoie à l'accueil", async ({ page }) => {
  for (const route of ROUTES_VISIBLES) {
    await page.goto(route);
    await expect(page.locator("body")).not.toContainText(/à venir/i);
  }
  await page.goto("/analyste");
  const url = new URL(page.url());
  if (url.pathname === "/analyste") {
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Posez la question");
  } else {
    expect(url.pathname).toBe("/");
  }
});

test("un tableau s'exporte en CSV", async ({ page }) => {
  await page.goto("/");
  const exporter = page.getByRole("main").getByRole("button", { name: "Exporter" }).first();
  await expect(exporter).toBeVisible();
  await exporter.click();
  const telechargement = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Fichier CSV" }).click();
  const fichier = await telechargement;
  expect(fichier.suggestedFilename()).toMatch(/\.csv$/);
});

test("la fiche d'un indicateur s'ouvre au clavier et se ferme avec Échap", async ({ page }) => {
  await page.goto("/");
  const bouton = page.getByRole("button", { name: "Fiche de l'indicateur CA_SIGNE" });
  await bouton.focus();
  await page.keyboard.press("Enter");
  const fiche = page.getByRole("dialog").filter({ hasText: "Fiche indicateur" });
  await expect(fiche).toContainText("CA signé");
  await page.keyboard.press("Escape");
  await expect(fiche).toBeHidden();
});

test("les écrans du lot 4b montrent leur contenu", async ({ page }) => {
  await page.goto("/pose");
  await expect(page.getByRole("main")).toContainText("Calendrier de charge des équipes de pose");
  await expect(page.getByRole("main")).toContainText("Encaissement et carnet par agence");
  await page.goto("/plans-action");
  await expect(page.getByRole("main")).toContainText("Décisions proposées");
  await expect(page.getByRole("main")).toContainText("Revue de pipe");
  await page.goto("/automatisations");
  await expect(page.getByRole("main")).toContainText("Journée simulée");
  await expect(page.getByRole("main")).toContainText("Journal des exécutions");
});

test("sur téléphone, le tiroir de navigation mène à un écran et la page ne déborde pas", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir la navigation" }).click();
  await page.getByRole("link", { name: /Qualité et référentiels/ }).click();
  await expect(page).toHaveURL(/\/qualite/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("confiance");
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeur).toBeLessThanOrEqual(375);
});
