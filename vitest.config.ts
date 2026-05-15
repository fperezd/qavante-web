import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/* Vitest 4 con `projects[]` — 2 proyectos:
   1. `unit` — config histórica del repo. 74 unit tests sobre src/.
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
