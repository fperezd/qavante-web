import { defineConfig } from "@playwright/test";

/* Config mínima de Playwright para Sprint C0. Sólo cubre tests de
   request HTTP (sin browser), por eso no usamos `projects` con devices.
   Cuando agreguemos UI specs en C1+, sumar projects: chromium/webkit/firefox
   y un `npx playwright install` en CI. */
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
  webServer: {
    command: "npm run build && npm start -- -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
