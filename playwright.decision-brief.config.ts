import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { e2eBuildEnv } from "./playwright.e2e-env";

const e2eGoogleFontMock = path.resolve("scripts/e2e-google-font-mock.cjs");

/* Suite aislada de Decision Brief. Construye en otro distDir y sirve en otro
 * puerto que la suite normal OFF: el flag es público y queda inlineado por
 * Next durante `npm run build`, por lo que compartir artefacto no probaría el
 * rollout de manera fiable. */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Las tres matrices comparten el servidor precompilado y ejercitan las cinco
  // superficies completas. Un worker hace el resultado reproducible también en
  // hosts CI con memoria limitada, sin convertir fallas en retries silenciosos.
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3101",
    extraHTTPHeaders: { Accept: "application/json" },
  },
  projects: [
    {
      name: "decision-brief-on",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "**/decision-brief-consistency.flow.spec.ts",
    },
  ],
  webServer: {
    /* Webpack + mock de fuentes. Turbopack 16.3 no resuelve next/font/google
       cuando la descarga falla, y ese fallo no se reintenta. */
    command: "npx next build --webpack && npm start -- -p 3101",
    url: "http://localhost:3101/login",
    reuseExistingServer: false,
    timeout: 600_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      ...e2eBuildEnv(3101, true),
      NEXT_FONT_GOOGLE_MOCKED_RESPONSES: e2eGoogleFontMock,
      NEXT_DIST_DIR: ".next-e2e-decision-brief-on",
    },
  },
});
