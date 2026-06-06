import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/* Vitest 4 con `projects[]` — 2 proyectos:
   1. `unit` — config histórica del repo. 500+ unit tests sobre src/.
      Excluye tests/e2e/ (Playwright) y stories (browser-only).
   2. `storybook` — auto-genera un test por story con el plugin
      @storybook/addon-vitest. Renderea la story en un browser headless
      (Chromium via Playwright) y valida que monta sin errores. Opt-in
      via `npm run test:storybook` o `vitest --project storybook`.

   Diseño intencional: `npm run test` corre SOLO el proyecto `unit` —
   queremos que el flujo dev y el job `test` de CI sigan siendo rápidos
   (~7s vs ~30-60s del proyecto storybook). El job `test:storybook` corre
   en CI como gate separado.

   Ver ADR-0005 (MSW) — el plugin storybookTest no requiere MSW porque
   las stories renderean con mocks inline / fixtures, no fetches reales. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    /* Coverage ratchet (hallazgo #8 del 360). Se corre con `npm run test:coverage`
       (y en CI). NO hay umbral GLOBAL a propósito: el repo cubre componentes vía
       Storybook y flujos vía e2e, así que la cobertura unit de `src/` es parcial
       por diseño (~44% en src/lib, dominado por los hooks de datos que NO se
       unit-testean). Un piso global sería engañoso o frágil (false-fails en PRs no
       relacionados).

       En cambio, fijamos un piso POR-ARCHIVO solo en la lógica crítica/segura que
       ya está bien cubierta por unit tests, como guarda anti-regresión ("no gutees
       los tests de estos archivos"). Floors ~debajo del actual (medido 2026-06-05:
       client.ts 84% lines, feature-flags.ts 100%, error-messages.ts 95%). */
    coverage: {
      provider: "v8",
      reporter: ["text-summary"],
      thresholds: {
        "src/lib/api/client.ts": { statements: 78, branches: 75, functions: 50, lines: 78 },
        "src/lib/feature-flags.ts": { statements: 95, branches: 85, functions: 90, lines: 95 },
        "src/lib/api/error-messages.ts": { statements: 90, branches: 85, functions: 90, lines: 90 },
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          exclude: ["**/node_modules/**", "**/.next/**", "tests/e2e/**", "**/*.stories.tsx"],
          setupFiles: ["./src/test/msw/vitest.setup.ts"],
        },
      },
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
