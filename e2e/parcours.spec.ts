import { expect, test } from "@playwright/test";

const ROUTES = [
  "/",
  "/territoires",
  "/funnel",
  "/ventes",
  "/forecast",
  "/pose",
  "/plans-action",
  "/qualite",
  "/automatisations",
  "/analyste",
  "/methode",
];

for (const route of ROUTES) {
  test(`${route} se charge sans erreur console`, async ({ page }) => {
    const erreurs: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") erreurs.push(message.text());
    });
    page.on("pageerror", (erreur) => erreurs.push(String(erreur)));

    const reponse = await page.goto(route);
    expect(reponse?.status()).toBeLessThan(400);
    await expect(page.getByRole("contentinfo")).toContainText("Démonstrateur personnel");
    expect(erreurs).toEqual([]);
  });
}

test("la palette de commandes s'ouvre au raccourci clavier, filtre une agence et ouvre une fiche", async ({ page }) => {
  await page.goto("/methode");
  await page.keyboard.press("Meta+k");
  const champ = page.getByPlaceholder(/Chercher un écran/);
  await expect(champ).toBeVisible();
  await champ.fill("arcachon");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/agence=ARC/);
  await page.keyboard.press("Meta+k");
  await page.getByPlaceholder(/Chercher un écran/).fill("taux de marge");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog").filter({ hasText: "Fiche indicateur" })).toContainText("Taux de marge brute");
});

test("le pied de page porte la mention réglementaire sur toutes les pages", async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route);
    await expect(page.getByRole("contentinfo")).toContainText("Sans lien avec Butagaz");
  }
});
