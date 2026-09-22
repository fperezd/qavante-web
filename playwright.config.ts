import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { e2eBuildEnv } from "./playwright.e2e-env";

const e2eGoogleFontMock = path.resolve("scripts/e2e-google-font-mock.cjs");

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
  // Los flows hacen mutaciones MSW y navegación sobre la misma aplicación. Ejecutarlos
  // serialmente evita carreras entre recorridos legacy sin reducir la matriz ni ocultar fallos.
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3100",
    extraHTTPHeaders: { Accept: "application/json" },
  },
  projects: [
    {
      name: "http",
      use: {},
      // `*.real.spec.ts` corre SOLO con playwright.real.config.ts (backend en vivo), nunca en el CI/MSW.
      // Los smoke post-deploy autentican contra app.qavante.com con una cookie de
      // ese dominio; no pueden ejecutarse de forma válida contra localhost.
      testIgnore: [
        "**/*.mobile.spec.ts",
        "**/*.flow.spec.ts",
        "**/*.real.spec.ts",
        "**/*.smoke.spec.ts",
      ],
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
      /* La prueba transversal del Brief requiere su build ON dedicado. El run
         normal conserva los flujos legacy y prueba el kill switch en OFF. */
      testIgnore: "**/decision-brief-consistency.flow.spec.ts",
    },
  ],
  webServer: {
    /* Webpack + mock de fuentes. Turbopack 16.3 no resuelve next/font/google
       cuando la descarga falla, y ese fallo no se reintenta. */
    command: "npx next build --webpack && npm start -- -p 3100",
    url: "http://localhost:3100/login",
    /* Nunca reusar un proceso local: de lo contrario un build ON previo puede
       volver verde falsamente el kill switch OFF. */
    reuseExistingServer: false,
    /* La build OFF conserva todas las rutas legacy y puede tardar más que la
       variante ON reducida. El límite explícito conserva un fallo observable
       sin cortar una compilación sana en hosts Windows con presión de memoria. */
    timeout: 600_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      // ON y OFF derivan del mismo set explícito; sólo el Brief cambia aquí.
      ...e2eBuildEnv(3100, false),
      NEXT_FONT_GOOGLE_MOCKED_RESPONSES: e2eGoogleFontMock,
      NEXT_DIST_DIR: ".next-e2e-off",
    },
  },
});
