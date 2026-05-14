import type { StorybookConfig } from "@storybook/nextjs-vite";

/* Storybook 10 + nextjs-vite — documentación viva del Design System Qavante
   (Anexo B del Doc Maestro). Stories co-located junto a los componentes
   (`src/components/**​/*.stories.tsx`). Resuelve issue #69 (Capa 1).

   Decisiones intencionales:
   - Addons: solo `addon-a11y` (alineado con foco a11y del proyecto, PR #64)
     y `addon-docs` (auto-docs de los componentes). NO incluyo:
     - `@chromatic-com/storybook`: visual regression queda para PR posterior.
     - `@storybook/addon-vitest`: requiere refactor invasivo de vitest.config.
     - `@storybook/addon-mcp`: no aplica al proyecto.
   - Stories NO usan MDX (mantenemos stack consistente con resto del repo). */

const config: StorybookConfig = {
  stories: ["../src/components/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: "@storybook/nextjs-vite",
  staticDirs: ["../public"],
};

export default config;
