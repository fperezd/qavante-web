import { defineConfig, devices } from "@playwright/test";

/* Config Playwright para Sprint C0+. Dos projects:
   1. http — tests de request HTTP (sin browser engine), específicamente
      tests/e2e/auth-redirect.spec.ts y prod-health.smoke.spec.ts (HTTP-only).
   2. mobile — tests visuales/responsive con engine browser + viewport
      mobile (Pixel 5), específicamente tests/e2e/*.mobile.spec.ts. Cubre
      hallazgo K.4 #3 del audit (responsive mobile sin validación previa).

   Cuando se agreguen suites desktop / cross-browser en sprints futuros,
   sumar projects: chromium-desktop, webkit, firefox y filtrar por
   testMatch correspondiente. */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3100",
    extraHTTPHeaders: { Accept: "application/json" },
  },
  projects: [
    {
      name: "http",
      use: {},
      testIgnore: ["**/*.mobile.spec.ts", "**/*.flow.spec.ts"],
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
      testMatch: "**/*.mobile.spec.ts",
    },
    {
      /* Flujos de usuario reales (browser desktop): clasificar, editar
         estructura, etc. Manejan formularios contra MSW — no solo render. */
      name: "flows",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "**/*.flow.spec.ts",
    },
  ],
  webServer: {
    command: "npm run build && npm start -- -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    /* MSW activo durante Playwright runs. NEXT_PUBLIC_* se inlinea en el
       build, así que tienen que estar seteadas antes de `npm run build`.
       Mismo origin para API URL evita problemas CORS / cookies cross-site
       (regla 6: cookies sin HttpOnly limitación service worker).
       NEXT_PUBLIC_TEST_MODE="playwright" desbloquea el guard de NODE_ENV
       en MswProvider + init-browser (de otra forma el build prod inhibe
       MSW). Nunca se setea fuera de este config — defensa en profundidad
       contra activación accidental en prod (ver ADR-0005). */
    env: {
      NEXT_PUBLIC_API_MOCKING: "enabled",
      NEXT_PUBLIC_API_URL: "http://localhost:3100",
      NEXT_PUBLIC_TEST_MODE: "playwright",
      /* Flags que están ON en prod (wrangler.toml) → el build de e2e espeja
         prod, así los flujos reales (clasificar, editar estructura) renderean
         sus vistas en vez de FeatureUnavailableState. El resto queda OFF. */
      NEXT_PUBLIC_FF_BANK_MOVEMENT_CLASSIFICATION: "true",
      NEXT_PUBLIC_FF_CLASSIFICATION_RULES: "true",
      NEXT_PUBLIC_FF_MANAGEMENT_ACCOUNTS: "true",
      NEXT_PUBLIC_FF_CASH_FLOW_REPORT: "true",
      /* Pantallas construidas FE-first (no ON en prod aún, esperan backend) que
         igual queremos cubrir con e2e contra MSW. */
      NEXT_PUBLIC_FF_OPERATIONAL_RESULT: "true",
    },
  },
});
