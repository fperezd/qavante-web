import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import prettierConfig from "eslint-config-prettier";

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
      "next-env.d.ts",
      "src/lib/api/types.ts",
      "public/mockServiceWorker.js", // generado por `npx msw init`, no editar
    ],
  },
];

export default eslintConfig;
