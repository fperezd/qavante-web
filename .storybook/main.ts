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
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs", "@storybook/addon-vitest"],
  framework: "@storybook/nextjs-vite",
  staticDirs: ["../public"],

  /* `NEXT_PUBLIC_API_URL` — se inyecta ACÁ, en tiempo de build, porque el builder reemplaza
     `process.env` por un objeto literal `{}` en el bundle: cualquier escritura en tiempo de
     módulo (`process.env.X ||= ...` en `preview.tsx`, como estaba antes) cae sobre un objeto
     descartable y `src/lib/api/client.ts` termina leyendo `({}).NEXT_PUBLIC_API_URL ?? ""`.
     Con la cadena vacía, `client.ts` lanza `ApiError(..., "config_missing")` ANTES de tocar
     `fetch`, así que los handlers de `parameters.msw.handlers` nunca se ejercitan y la story
     pinta "Esta función no está disponible en este momento.".

     Eso no se veía en `test-storybook`: vitest browser mode transforma los módulos en caliente
     y deja un `process.env` real y mutable, donde el parche de `preview.tsx` sí tomaba. Sólo
     rompía en el build estático — exactamente lo que snapshotea Chromatic — y es la causa de 34
     de los 51 errores de componente del issue #299 (el service worker de MSW estaba sano:
     registrado, con scope `/` y "Mocking enabled" en consola).

     Se hace con `define` de Vite y NO con el campo `env` de Storybook: `env` se probó primero
     y el builder de Vite de Storybook 10 no lo traslada al bundle (medido — el chunk seguía
     saliendo con `{}.NEXT_PUBLIC_API_URL`). `define` sí gana, porque la clave más específica
     (`process.env.NEXT_PUBLIC_API_URL`) se resuelve antes que el reemplazo genérico de
     `process.env`.

     El alcance es sólo este `configDir`, así que no se filtra al proyecto `unit` de Vitest —
     que fue el problema que en su momento descartó ponerlo en `vitest.config.ts`. Respeta un
     valor real del entorno si existe. El default es un dominio `.invalid` (RFC 2606, nunca
     resuelve) para que una story sin handler falle con un error de red en vez de pegarle a
     producción: ver la nota larga en `preview.tsx`. */
  viteFinal: async (config) => ({
    ...config,
    define: {
      ...config.define,
      /* CUIDADO: se respeta la variable del entorno si está seteada. Con `onUnhandledRequest:
         "bypass"` en `preview.tsx`, construir Storybook con esta variable apuntando a un backend
         real hace que toda story sin handler MSW le pegue de verdad. No exportarla al construir. */
      "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(
        process.env.NEXT_PUBLIC_API_URL || "https://api.storybook.invalid",
      ),
      /* Igual que E2E: sin maquetas ni CTAs locales que no existen en prod. */
      "process.env.NEXT_PUBLIC_APP_ENV": JSON.stringify(
        process.env.NEXT_PUBLIC_APP_ENV || "storybook",
      ),
    },
  }),
};

export default config;
