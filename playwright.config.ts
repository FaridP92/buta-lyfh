import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env["E2E_BASE"] ?? "http://localhost:4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      name: "mobile-375",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
  ],
  ...(process.env["E2E_BASE"]
    ? {}
    : {
        webServer: {
          command: "npm run preview -- --port 4173",
          url: BASE_URL,
          reuseExistingServer: !process.env["CI"],
          timeout: 30_000,
        },
      }),
});
