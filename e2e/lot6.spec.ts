import { expect, test } from "@playwright/test";

test("le guide « Comprendre cet écran » s'ouvre depuis la barre haute, suit l'écran courant et navigue entre les écrans", async ({ page }) => {
  await page.goto("/ventes");
  await page.getByRole("button", { name: /Comprendre cet écran/ }).click();
  const guide = page.getByRole("dialog").filter({ hasText: "Comprendre cet écran" });
  await expect(guide).toContainText("Ventes et marge");
  await expect(guide).toContainText("Ce qu'on y trouve");
  await expect(guide).toContainText("D'où viennent les données");
  await expect(guide).toContainText("Direction financière");
  await guide.getByRole("button", { name: "Forecast et atterrissage" }).click();
  await expect(guide).toContainText("Où finit l'année");
  await page.keyboard.press("Escape");
  await expect(guide).toBeHidden();
});

test("changer d'écran ramène en haut de page ; changer de filtre conserve la position", async ({ page }, infos) => {
  test.skip(infos.project.name === "mobile-375", "le rail n'existe pas sur téléphone");
  await page.goto("/methode");
  await page.evaluate(() => window.scrollTo(0, 1800));
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Territoires" }).click();
  await expect(page).toHaveURL(/\/territoires/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goto("/ventes");
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.getByRole("button", { name: /^Vs/ }).click();
  await page.getByRole("menuitem", { name: "N-1" }).click();
  await expect(page).toHaveURL(/comparaison=n1/);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test("le mode présentation masque le rail et la barre haute, les flèches changent d'écran, Échap en sort", async ({ page }, infos) => {
  test.skip(infos.project.name === "mobile-375", "le mode présentation vise un écran de réunion");
  await page.goto("/");
  await page.keyboard.press("p");
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeHidden();
  await expect(page.getByRole("status")).toContainText("1 / 11");
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/territoires/);
  await expect(page.getByRole("status")).toContainText("2 / 11");
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/\/$/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();
  // La touche P dans un champ de saisie ne bascule rien.
  await page.goto("/analyste");
  await page.getByRole("textbox").first().fill("p");
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();
});

test("sur téléphone, le tiroir porte les filtres et un changement d'agence se lit dans l'adresse", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir la navigation" }).click();
  const tiroir = page.getByRole("dialog");
  await expect(tiroir).toContainText("Filtres de l'écran");
  await tiroir.getByRole("button", { name: /^Agence/ }).click();
  await page.getByRole("menuitem", { name: "Saintonge" }).click();
  await expect(page).toHaveURL(/agence=SAI/);
});

test("la page Méthode propose la présentation par écran en PDF et ne date plus l'entretien", async ({ page }) => {
  await page.goto("/methode");
  const lien = page.getByRole("link", { name: /Présentation par écran/ });
  await expect(lien).toBeVisible();
  await expect(lien).toHaveAttribute("href", "/presentation.pdf");
  await expect(page.getByRole("main")).not.toContainText("entretien téléphonique");
});
