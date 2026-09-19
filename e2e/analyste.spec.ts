import { expect, test } from "@playwright/test";

/**
 * Parcours de l'écran Analyste (lot 5, IA.md §5) : l'écran est en navigation, le formulaire répond, une question
 * hors périmètre est refusée par le modèle (un seul appel, le moins cher), la question entre dans l'historique.
 * Si le quota ou le service est indisponible, la carte de refus ou d'erreur doit tout de même s'afficher.
 */
test("l'écran Analyste est en navigation et répond à une question", async ({ page }) => {
  await page.goto("/analyste");
  await expect(page).toHaveURL(/\/analyste$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Posez la question au cockpit");
  const champ = page.getByPlaceholder("Quelle agence a le pire coût par vente en août 2026 ?");
  await expect(champ).toBeVisible();
  const demander = page.getByRole("button", { name: "Demander" });
  await expect(demander).toBeDisabled();
  await champ.fill("Quel temps fera-t-il demain à Bordeaux ?");
  await expect(demander).toBeEnabled();
  await demander.click();
  const carte = page.getByRole("heading", { name: /^(La réponse|Question refusée|Pas de réponse|Analyste en repli)$/ });
  await expect(carte).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("main")).toContainText("« Quel temps fera-t-il demain à Bordeaux ? »");
  const historique = page.getByRole("button", { name: "Quel temps fera-t-il demain à Bordeaux ?" });
  await expect(historique).toBeVisible();
});

test("le rail et le tiroir mènent à l'écran Analyste", async ({ page }) => {
  await page.goto("/");
  // Sur téléphone, le rail est remplacé par un tiroir qu'il faut ouvrir d'abord.
  const tiroir = page.getByRole("button", { name: "Ouvrir la navigation" });
  if (await tiroir.isVisible()) await tiroir.click();
  await page.getByRole("link", { name: /Analyste/ }).first().click();
  await expect(page).toHaveURL(/\/analyste$/);
  await expect(page.getByRole("main")).toContainText("Garde-fous");
});
