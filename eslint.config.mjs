import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import prettierConfig from "eslint-config-prettier";
import storybook from "eslint-plugin-storybook";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  prettierConfig,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      ".open-next/**",
      "storybook-static/**", // build output de `npm run build-storybook`
      "next-env.d.ts",
      "src/lib/api/types.ts",
      "public/mockServiceWorker.js", // generado por `npx msw init`, no editar
    ],
  },
  // Storybook flat config recommended — agrega reglas para *.stories.tsx.
  // Va al final para que sus globs no se vean shadow-eados por el ignores anterior.
  ...storybook.configs["flat/recommended"],
];

export default eslintConfig;
