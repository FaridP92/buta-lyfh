/**
 * Captures de la présentation par écran (docs/captures/presentation/) : chaque écran de la navigation en
 * 1280 × 900 sur le thème sombre, animation d'ouverture passée, données chargées ; puis le panneau
 * « Comprendre cet écran » ouvert sur l'accueil et l'accueil sur téléphone (375 px).
 * Usage : CAPTURE_BASE=http://localhost:5180 tsx scripts/capturer-presentation.ts
 * (par défaut, le serveur d'aperçu de la construction, http://localhost:4173).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { GUIDES_ECRANS } from "../src/lib/guideEcrans";

const BASE = process.env["CAPTURE_BASE"] ?? "http://localhost:4173";
const DOSSIER = join(process.cwd(), "docs", "captures", "presentation");
const ATTENTE_ANIMATIONS_MS = 3200;

export function slugEcran(chemin: string): string {
  return chemin === "/" ? "vue-ensemble" : chemin.replace(/^\//, "");
}

async function preparer(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("buta-theme", "sombre");
      sessionStorage.setItem("buta-ouverture-vue", "1");
    } catch {
      // stockage indisponible : l'animation d'ouverture jouera, la capture attend assez longtemps
    }
  });
}

async function capturer(page: Page, chemin: string, fichier: string): Promise<void> {
  await page.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(ATTENTE_ANIMATIONS_MS);
  await page.screenshot({ path: join(DOSSIER, fichier), type: "jpeg", quality: 86 });
  console.log(`${fichier} écrit`);
}

async function principal(): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  const navigateur = await chromium.launch();
  try {
    const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, locale: "fr-FR" });
    const page = await contexte.newPage();
    await preparer(page);
    for (const guide of GUIDES_ECRANS) {
      await capturer(page, guide.chemin, `${slugEcran(guide.chemin)}.jpg`);
    }
    // Repères écrits à côté des captures : date de capture et journée simulée publiée (badge de fraîcheur).
    const badge = (await page.locator("header span", { hasText: /Journée du|Instantané du/ }).first().textContent().catch(() => null))?.trim() ?? null;
    writeFileSync(join(DOSSIER, "_meta.json"), `${JSON.stringify({ capture_le: new Date().toISOString(), badge, base: BASE }, null, 2)}\n`);
    console.log(`_meta.json écrit (${badge ?? "badge introuvable"})`);
    // Le panneau « Comprendre cet écran » ouvert sur l'accueil.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(ATTENTE_ANIMATIONS_MS);
    await page.getByRole("button", { name: /Comprendre cet écran/ }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(DOSSIER, "guide-ouvert.jpg"), type: "jpeg", quality: 86 });
    console.log("guide-ouvert.jpg écrit");
    await contexte.close();

    const mobile = await navigateur.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: "fr-FR", isMobile: true, hasTouch: true });
    const pageMobile = await mobile.newPage();
    await preparer(pageMobile);
    await capturer(pageMobile, "/", "mobile-vue-ensemble.jpg");
    await mobile.close();
  } finally {
    await navigateur.close();
  }
}

if (process.argv[1]?.endsWith("capturer-presentation.ts")) {
  principal().catch((erreur: unknown) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exit(1);
  });
}
