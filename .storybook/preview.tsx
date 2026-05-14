import type { Preview } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

/* Importa el CSS global del app — Tailwind 4 directives + tokens Qavante
   + tipografía. Sin este import las stories pierden el styling del DS. */
import "../src/app/globals.css";

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
};

export default preview;
