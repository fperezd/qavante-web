import type { Preview } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initialize, mswLoader } from "msw-storybook-addon";
import React from "react";

/* Importa el CSS global del app — Tailwind 4 directives + tokens Qavante
   + tipografía. Sin este import las stories pierden el styling del DS. */
import "../src/app/globals.css";

/* `NEXT_PUBLIC_API_URL` — hallazgo de revisión (PR #95): sin `.env.local` (gitignored, no
 * existe en CI ni en un worktree fresco), `src/lib/api/client.ts` corta ANTES de llamar a
 * `fetch` con "NEXT_PUBLIC_API_URL no configurada" (`ApiError` inmediato, NO la "loading state
 * perpetuo" que asumía el comentario de abajo). Toda story que monta un componente con hooks de
 * datos (`useXxx` sobre `api.get`) caía siempre a esa rama de error, nunca a los handlers MSW de
 * `parameters.msw.handlers`: los mocks estaban ahí, escritos, pero INERTES. Nadie lo notó porque
 * hasta ahora ninguna story tenía un `play()` que afirmara sobre texto derivado de datos reales.
 *
 * Se parchea ACÁ (no en `vitest.config.ts`) porque un `define` a nivel de proyecto Vitest resultó
 * filtrarse al proyecto `unit` — reprodujo un `href` con slash final espurio en
 * `administracion-v12-view.test.tsx` corriendo AISLADO, con `--project unit` solo. Este archivo
 * sólo lo carga el proyecto `storybook`, así que no hay blast radius fuera de las stories.
 *
 * El dominio es adrede `.invalid` (RFC 2606: reservado, NUNCA resuelve) — no
 * `https://api.qavante.com` real: con `onUnhandledRequest: "bypass"` (abajo), cualquier request
 * de una story SIN handler para ese endpoint (p.ej. `EmpresasView` pide más de lo que su story
 * mockea) se habría ido de verdad a producción. Contra un `.invalid`, el mismo request falla
 * rápido con un error de red (`ApiError network_error`) — nunca un 401 real que dispare
 * `redirectToLogin()` y navegue el iframe del test (lo probé: con un dominio real, eso rompía
 * `empresas-view.stories.tsx` con "Cannot connect to the iframe"). Corre ANTES que cualquier
 * story importe (transitivamente) `client.ts`, así que la constante ya queda resuelta cuando ese
 * módulo se evalúa por primera vez. */
if (typeof process !== "undefined") {
  process.env.NEXT_PUBLIC_API_URL ||= "https://api.storybook.invalid";
}

/* msw-storybook-addon — habilita stories de vistas-contenedor que llaman
   hooks de TanStack Query. Cada story declara `parameters.msw.handlers`
   con un array de handlers MSW (mismo shape que `src/test/msw/handlers.ts`).
   Sin handlers la story cae a un error de red silencioso (ver nota de
   `NEXT_PUBLIC_API_URL` arriba) — no al "loading perpetuo" que asumía este comentario.
   Service worker servido desde `/public/mockServiceWorker.js` (ya existe
   por el dev-mode MSW del app). */
initialize({
  /* `bypass` — si el handler no matchea, deja pasar la request real (default
     `warn` ensucia la consola). Para Chromatic preferimos silencio. */
  onUnhandledRequest: "bypass",
});

/* QueryClient por story — sin retries para que stories no se queden esperando.
   Los hooks que mutan (useInviteUser, useUpdateUser, etc.) fallarán dentro del
   story porque el handler MSW no está activo, pero la UI inicial renderea OK. */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      /* 'todo' = panel a11y muestra hallazgos sin bloquear (no fail tests).
         Coherente con #64 que agregó skip-link + landmark labels. */
      test: "todo",
    },
    backgrounds: {
      default: "qavante-surface",
      values: [
        { name: "qavante-surface", value: "#ffffff" },
        { name: "qavante-background", value: "#f7f7f8" },
      ],
    },
    /* Anti-flakiness de Chromatic (visual regression). Sin esto, las stories
       con spinner (`animate-spin` en Loader2 — QavanteButton loading, cards
       en estado loading) generan diffs no deterministas: cada captura agarra
       el spinner en otro ángulo. Causa raíz de los 4 falsos positivos vistos
       en PR #86 (cero archivos UI cambiados vs baseline).
         - pauseAnimationAtEnd: congela animaciones CSS en su frame final.
         - delay: deja asentar fuentes/layout antes del snapshot.
         - diffThreshold: 0.2 tolera antialiasing sub-pixel sin enmascarar
           regresiones reales (cambios estructurales superan 0.2 holgado;
           Chromatic default 0.063 es muy sensible para apps con tipografía). */
    chromatic: {
      pauseAnimationAtEnd: true,
      delay: 300,
      diffThreshold: 0.2,
    },
  },
  decorators: [
    (Story) => {
      const client = makeQueryClient();
      return (
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
  /* mswLoader — corre antes del render para activar los handlers MSW
     declarados en `parameters.msw.handlers` de cada story. Stories sin
     `parameters.msw` no pasan por aquí (no-op). */
  loaders: [mswLoader],
};

export default preview;
