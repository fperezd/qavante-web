import { defineConfig, devices } from "@playwright/test";

/* QA E2E de PRODUCCIÓN, estrictamente de solo lectura (informe QA 2026-10-05, hallazgos B01–B28).

   Corre contra la app desplegada (https://app.qavante.com por defecto) con la sesión de un usuario
   real, sin dev-server ni MSW. La sesión va SOLO por env en runtime y nunca se commitea ni se
   escribe en la evidencia:

     QAVANTE_SESSION="<cookie qavante_session>" npm run test:e2e:qa-prod

   Sin `QAVANTE_SESSION` todo se salta (test.skip), así que es inofensivo en CI.

   Cada test afirma lo que DEBERÍA pasar: mientras el bug exista, el test falla, y la evidencia
   (screenshot + JSON de las llamadas /api) queda en `test-results/qa-produccion/<ID>/`.
   Ver `tests/e2e/qa-produccion/README.md`. */

const APP = process.env.QAVANTE_APP ?? "https://app.qavante.com";

export default defineConfig({
  testDir: "./tests/e2e/qa-produccion",
  testMatch: /.*\.spec\.ts/,
  /* `lectores.spec.ts` prueba que los selectores del gate enganchen, y lo hace contra la build MSW
     en localhost: corre en el project `qa-gate` de `playwright.config.ts`, no acá. `gemelos.spec.ts`
     SÍ corre acá a propósito: son puros y confirman, en el mismo run que mide producción, que los
     doce comparadores se pondrían rojos si la verdad cambiara. */
  testIgnore: /lectores\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Los artefactos propios de Playwright (trazas, videos) van aparte de la evidencia por hallazgo.
  outputDir: "test-results/qa-produccion/_playwright",
  reporter: [["list"], ["json", { outputFile: "test-results/qa-produccion/resultado.json" }]],
  use: {
    ...devices["Desktop Chrome"],
    // Sin `webServer` ni MSW: pega a la app y a la API reales.
    baseURL: APP,
    locale: "es-CL",
    timezoneId: "America/Santiago",
    // Las trazas guardan cookies y headers: no se generan para no filtrar la sesión.
    trace: "off",
    video: "off",
    screenshot: "off",
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
});
