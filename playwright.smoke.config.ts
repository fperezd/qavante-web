import { defineConfig, devices } from "@playwright/test";

/* Config separada para smoke tests post-deploy contra el stack real.
   Diferencias vs playwright.config.ts:
   - baseURL = SMOKE_BASE_URL (default https://app.qavante.com), no localhost
   - sin webServer (apuntamos a prod ya desplegado)
   - solo levanta specs *.smoke.spec.ts
   Uso: npm run smoke (local) o job "smoke" del workflow deploy-cloudflare.yml. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.smoke\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? "https://app.qavante.com",
    extraHTTPHeaders: { Accept: "text/html,application/json" },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
