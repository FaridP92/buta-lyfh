import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    // Jamais de data: URI : la CSP (DEPLOIEMENT_VPS.md §3) n'autorise que 'self' pour les polices.
    assetsInlineLimit: 0,
  },
});
