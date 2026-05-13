import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    /* tests/e2e/ son specs de Playwright; viven en el mismo glob default
       de vitest pero no son compatibles con su runner. Mantenemos vitest
       enfocado en unit tests (src/ + tests/unit/) y dejamos los e2e al
       job e2e del CI que ejecuta `npm run e2e` (Playwright). */
    exclude: ["**/node_modules/**", "**/.next/**", "tests/e2e/**"],
    /* MSW server global: arranca antes de los tests, resetea handlers + db
       entre cada uno, cierra al final. Ver ADR-0005. */
    setupFiles: ["./src/test/msw/vitest.setup.ts"],
  },
});
