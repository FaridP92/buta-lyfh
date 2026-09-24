import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
    // Couverture des calculs (CLAUDE.md : aucun chiffre calculé dans un composant) : src/lib et les deux modules
    // purs des Edge Functions. Seuils posés au niveau mesuré le 24 septembre (96 % de lignes, 85 % de branches), moins
    // une marge ; l'orchestration des fonctions (index.ts, commun.ts, base.ts) est tenue par Playwright et le jeu
    // d'évaluation, pas par Vitest.
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "supabase/functions/analyste/garde-fous.ts", "supabase/functions/_partage/nombres.ts"],
      exclude: ["src/lib/cn.ts", "src/lib/useEstMobile.ts"],
      reporter: ["text-summary"],
      thresholds: { lines: 92, branches: 80, functions: 85 },
    },
  },
});
