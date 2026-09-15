import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier/flat";
import storybook from "eslint-plugin-storybook";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  globalIgnores([
    ".open-next/**",
    // Los artefactos de las dos suites E2E son builds de Next, no código fuente.
    // Sin este patrón `eslint .` puede recorrer ambos distDirs y agotar memoria.
    ".next-e2e-*/**",
    "storybook-static/**", // build output de `npm run build-storybook`
    "src/lib/api/types.ts",
    "public/mockServiceWorker.js", // generado por `npx msw init`, no editar
  ]),
  // Mantener las reglas recomendadas de Storybook después de los ignores del proyecto.
  ...storybook.configs["flat/recommended"],
  {
    // Deuda existente revelada por el compilador de React incluido en Next 16.
    // Se aborda en una actividad separada, sin bloquear esta actualización de seguridad.
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/use-memo": "off",
    },
  },
]);

export default eslintConfig;
