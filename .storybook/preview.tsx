import type { Preview } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initialize, mswLoader } from "msw-storybook-addon";
import React from "react";

/* Importa el CSS global del app — Tailwind 4 directives + tokens Qavante
   + tipografía. Sin este import las stories pierden el styling del DS. */
import "../src/app/globals.css";

/* msw-storybook-addon — habilita stories de vistas-contenedor que llaman
   hooks de TanStack Query. Cada story declara `parameters.msw.handlers`
   con un array de handlers MSW (mismo shape que `src/test/msw/handlers.ts`).
   Sin handlers la story renderea sin red (loading state perpetuo).
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
