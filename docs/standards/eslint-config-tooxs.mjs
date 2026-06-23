/**
 * eslint-config-tooxs — Preset de enforcement del Tooxs Frontend Standard.
 *
 * Codifica las prohibiciones DURAS del estándar (§11, §12) como reglas que
 * rompen el build, no como prosa que alguien debe recordar. Esto es lo que
 * convierte el estándar en arquitectura: el linter impide la violación.
 *
 * ── Adopción (sin romper CI el día 1) ────────────────────────────────────
 * 1. Copiá este archivo al repo (o, en Fase 2, instalá @tooxs/eslint-config).
 * 2. En tu eslint.config.mjs:
 *
 *      import tooxs from "./docs/standards/eslint-config-tooxs.mjs";
 *      export default [ ...compat.extends(...), prettierConfig, ...tooxs ];
 *
 * 3. Primer rollout: bajá las reglas nuevas a "warn" para no romper CI sobre
 *    código preexistente; subílas a "error" tras limpiar (1 PR por regla).
 *
 * Requiere: @typescript-eslint (ya viene con next/typescript).
 */

/** Severidad global del preset. Arrancá en "warn", subí a "error". */
const LEVEL = "error";

/** @type {import("eslint").Linter.Config[]} */
const tooxsStandard = [
  {
    name: "tooxs/hard-rules",
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // §12 — Tipado estricto: prohibido `any` sin justificación.
      // Para el escape legítimo, usar `// eslint-disable-next-line` + comentario.
      "@typescript-eslint/no-explicit-any": LEVEL,

      // §11 — NUNCA declarar runtime edge: rompe el adapter @opennextjs/cloudflare.
      "no-restricted-syntax": [
        LEVEL,
        {
          selector:
            "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name='runtime']",
          message:
            "Prohibido `export const runtime`. El default (Node-on-workerd) es el correcto; declarar 'edge' rompe el build de Cloudflare. Ver Tooxs Frontend Standard §11.",
        },
        {
          // §3 — Errores: no mostrar el mensaje crudo del backend al usuario.
          selector: "MemberExpression[property.name='message'][object.name='error']",
          message:
            "No expongas `error.message` crudo en UI. Usá apiErrorToUserMessage(error). Ver §3.4.",
        },
      ],

      // §11 — Storage del navegador prohibido (incompatible con el runtime y
      // jamás para tokens; tokens solo en cookies httpOnly).
      "no-restricted-globals": [
        LEVEL,
        {
          name: "localStorage",
          message:
            "Prohibido localStorage (incompatible con el target Edge; nunca para tokens). Tokens en cookies httpOnly. Ver §11.",
        },
        {
          name: "sessionStorage",
          message: "Prohibido sessionStorage. Ver Tooxs Frontend Standard §11.",
        },
        {
          name: "indexedDB",
          message: "Prohibido IndexedDB. Ver Tooxs Frontend Standard §11.",
        },
        {
          name: "Buffer",
          message: "Prohibido el global Buffer (Node-only). Usá Uint8Array / Web APIs. Ver §11.",
        },
      ],

      // §11 — APIs Node-only: no se importan en el frontend.
      "no-restricted-imports": [
        LEVEL,
        {
          paths: [
            { name: "fs", message: "API Node-only. Mové la lógica al backend. §11." },
            { name: "node:fs", message: "API Node-only. §11." },
            { name: "path", message: "API Node-only. §11." },
            { name: "node:path", message: "API Node-only. §11." },
            { name: "child_process", message: "API Node-only. §11." },
            { name: "node:child_process", message: "API Node-only. §11." },
            { name: "os", message: "API Node-only. §11." },
          ],
          patterns: [
            {
              group: ["**/api/types"],
              importNames: ["default"],
              message:
                "types.ts es generado (openapi-typescript). Importá tipos nombrados, no lo edites a mano. §12.",
            },
          ],
        },
      ],
    },
  },

  // Los tests y stories pueden relajar `any` puntualmente (fixtures/mocks).
  {
    name: "tooxs/test-overrides",
    files: ["**/*.test.{ts,tsx}", "**/*.stories.tsx", "src/test/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default tooxsStandard;
