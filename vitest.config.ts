import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /* tests/e2e/ son specs de Playwright; viven en el mismo glob default
       de vitest pero no son compatibles con su runner. Mantenemos vitest
       enfocado en unit tests (src/ + tests/unit/) y dejamos los e2e al
       job e2e del CI que ejecuta `npm run e2e` (Playwright). */
    exclude: ["**/node_modules/**", "**/.next/**", "tests/e2e/**"],
  },
});
