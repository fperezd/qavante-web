import { defineConfig } from "@playwright/test";

/* Config para el e2e REAL de consistencia de datos: corre contra el backend EN VIVO (api.qavante.com),
   sin dev-server local ni MSW. Se invoca aparte del CI normal:

     QAVANTE_SESSION="<cookie qavante_session de tu sesión>" \
       npx playwright test --config=playwright.real.config.ts

   Sin `QAVANTE_SESSION` los tests se saltan (test.skip), así que es inofensivo. La sesión se pasa por
   env en runtime; NUNCA se commitea. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /data-consistency\.real\.spec\.ts/,
  fullyParallel: false,
  timeout: 30_000,
  reporter: [["list"]],
  // Sin `webServer` ni MSW: esto pega al backend real, no a un mock.
  use: {
    baseURL: process.env.QAVANTE_API ?? "https://api.qavante.com",
    extraHTTPHeaders: {
      ...(process.env.QAVANTE_SESSION
        ? { Cookie: `qavante_session=${process.env.QAVANTE_SESSION}` }
        : {}),
      Origin: process.env.QAVANTE_ORIGIN ?? "https://app.qavante.com",
    },
  },
});
