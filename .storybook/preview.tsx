import type { Preview } from "@storybook/nextjs-vite";

/* Importa el CSS global del app — Tailwind 4 directives + tokens Qavante
   + tipografía. Sin este import las stories pierden el styling del DS. */
import "../src/app/globals.css";

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
};

export default preview;
