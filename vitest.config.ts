import { defineConfig } from "vitest/config";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// This worktree can reuse node_modules from a neighbouring checkout. Vitest's
// Storybook plugin loads its setup module through Vite's /@fs endpoint, so Vite
// must be allowed to serve that *resolved package directory*. Do not allow the
// neighbouring checkout or its node_modules root: only the addon directory
// containing the setup file is needed by the browser test runner.
const storybookVitestSetupDirectory = path.dirname(
  require.resolve("@storybook/addon-vitest/internal/setup-file"),
);

// Vitest Browser Mode defaults to ::1:63315. Windows commonly reserves
// 63300-63399 for Hyper-V/WSL, making the real Chromium Storybook suite fail
// before it can render any story. Keep the control plane on IPv4 loopback and
// make the port explicit/overridable for a concurrent local run. `strictPort`
// deliberately turns an occupied port into a visible failure instead of
// silently changing the endpoint that the browser must reach.
const browserApiPort = Number.parseInt(process.env.VITEST_BROWSER_API_PORT ?? "51315", 10);
if (!Number.isInteger(browserApiPort) || browserApiPort < 1024 || browserApiPort > 65535) {
  throw new Error("VITEST_BROWSER_API_PORT must be an integer between 1024 and 65535");
}

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

   Ver ADR-0005 (MSW). Ojo: este comentario decía que las stories "renderean con mocks inline /
   fixtures, no fetches reales" y eso es FALSO desde el cableado de las vistas-contenedor —
   refutado midiendo en el issue #299. Muchas stories montan hooks de datos que SÍ llaman `fetch`
   contra la URL base inyectada en `.storybook/main.ts`, y lo que responde es el service worker de
   MSW activado por `mswLoader` con los `parameters.msw.handlers` de cada story. El dominio es un
   `.invalid` que nunca resuelve, así que una story sin handler falla con error de red en vez de
   salir a la red de verdad. */
export default defineConfig({
  server: {
    fs: {
      allow: [storybookVitestSetupDirectory],
    },
  },
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
        /* JSX para el proyecto `unit`. El tsconfig de Next fija `jsx: "preserve"` (Next hace la
           transformación él mismo), así que vite no sabe compilar un `.tsx` y cualquier test que
           importe un componente muere en el PARSEO, no en un assert — por eso el repo tenía cero
           archivos `.test.tsx`. Acotado al proyecto `unit`: el proyecto `storybook` trae su propio
           pipeline de React vía `@storybook/nextjs-vite` y no se toca.

           `cdcfcd68` resolvía esto con un plugin propio de 26 líneas (`qavante-unit-force-jsx-runtime`)
           que volvía a pasar CADA `.tsx` por `esbuild.transform`. Funciona, pero vite 8 en este repo
           ya transforma con **oxc** —avisa "Both esbuild and oxc options were set"— así que ese
           plugin duplicaba el trabajo del transformador nativo. Medido: con esta única opción, el
           test adoptado de `cdcfcd68` pasa igual (3/3) y la suite `unit` entera queda en verde. */
        oxc: { jsx: { runtime: "automatic" } },
        test: {
          name: "unit",
          // El suite local ejecuta I/O real (CLI guards y round-trips XLSX). 5 s es
          // insuficiente bajo la contención legítima de Docker; conserva un límite finito.
          testTimeout: 30_000,
          exclude: [
            "**/node_modules/**",
            "**/.next/**",
            "tests/e2e/**",
            "**/*.stories.tsx",
            // Este archivo usa el runner nativo de Node y se ejecuta por separado.
            "scripts/release-workflow-policy.test.mjs",
            /* CHECKOUTS AUXILIARES DEL ÁRBOL DE TRABAJO.
               Este repo no soporta worktrees de git, así que las copias auxiliares viven como
               directorios sin trackear DENTRO del checkout, cada una con su propio
               `node_modules`. Vitest las recogía y corría sus tests contra OTRA copia de React:
               medido el 2026-10-05, `npm test` reportaba 30 fallos en `worktrees/`,
               `.worktrees/` y `.codex-tmp/` con `src/` entero en verde. En CI no existen, así
               que allá esto es inocuo; en local es la diferencia entre un rojo que significa
               algo y 30 que enseñan a ignorar el rojo. */
            "**/worktrees/**",
            "**/.worktrees/**",
            "**/.codex-tmp/**",
          ],
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
          // Las stories comparten un único documento y el servidor MSW del navegador.
          // Ejecutarlas en paralelo permite que una interacción reemplace los handlers
          // de otra; `fileParallelism` cubre archivos y `maxConcurrency` cubre plays
          // concurrentes dentro de una misma story.
          fileParallelism: false,
          maxConcurrency: 1,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
            api: {
              host: "127.0.0.1",
              port: browserApiPort,
              strictPort: true,
            },
          },
        },
      },
    ],
  },
});
