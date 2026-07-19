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
      NEXT_PUBLIC_FF_ACCOUNTS_RECEIVABLE: "true",
      NEXT_PUBLIC_FF_ACCOUNTS_PAYABLE: "true",
      /* v2 encendidos en prod (wrangler.toml): el e2e debe espejar lo que ven los usuarios.
         Con estos ON, /pagar, /caja/proyeccion y /gestion (un mes) renderean las vistas v2. */
      NEXT_PUBLIC_FF_CAJA_V2: "true",
      NEXT_PUBLIC_FF_PAGAR_V2: "true",
      NEXT_PUBLIC_FF_DASHBOARD_SUMMARY: "true",
      NEXT_PUBLIC_FF_PULSO_DETAIL: "true",
      NEXT_PUBLIC_FF_ASSISTANT: "true",
      /* Panel F29 (SII) — FE-first contra el backend ya listo; cubierto por e2e. */
      NEXT_PUBLIC_FF_SII_QUERIES: "true",
      NEXT_PUBLIC_FF_OBLIGATIONS: "true",
      /* Remuneraciones (BUK) — LIVE en prod (wrangler.toml). Cubierto por e2e
         contra MSW (dotación + planilla). */
      NEXT_PUBLIC_FF_REMUNERACIONES: "true",
      /* Cola de conciliación — OFF en prod (feature nueva, sin validar todavía). Acá ON para
         testear la pantalla ya construida detrás del flag; es "adelanto", no drift de prod. */
      NEXT_PUBLIC_FF_RECONCILIATION_REVIEW: "true",
      /* Config de Administración + Mi cuenta — ON en prod (wrangler.toml). El e2e espeja
         prod para poder hacer smoke de que cada pantalla renderea su vista (no el placeholder). */
      NEXT_PUBLIC_FF_MULTI_CURRENCY: "true",
      NEXT_PUBLIC_FF_INDUSTRY_TEMPLATES: "true",
      NEXT_PUBLIC_FF_MANAGEMENT_DIMENSIONS: "true",
      NEXT_PUBLIC_FF_MI_CUENTA: "true",
    },
  },
});
