import assert from "node:assert/strict";
import { evaluateChangeEvidence } from "./change-evidence.mjs";

const body = "## Risk\nR0\n## Evidence\nTests\n## Rollback\nRevert";
assert.equal(evaluateChangeEvidence({ files: ["docs/README.md"], body }).risk, "risk:R0");
assert.equal(evaluateChangeEvidence({ files: ["src/example.ts"], body }).material, true);
assert.throws(
  () =>
    evaluateChangeEvidence({
      labels: ["risk:R0"],
      files: ["docs/contracts/openapi.snapshot.json"],
      body,
    }),
  /risk:R2/,
);
assert.throws(
  () =>
    evaluateChangeEvidence({
      labels: ["risk:R0"],
      files: ["src/components/caja/caja-resumen.tsx"],
      body,
    }),
  /risk:R2/,
);
assert.throws(
  () => evaluateChangeEvidence({ files: ["src/example.ts"], body: "sin secciones" }),
  /Faltan secciones/,
);
assert.doesNotThrow(() =>
  evaluateChangeEvidence({
    labels: ["risk:R2"],
    files: ["docs/contracts/openapi.snapshot.json"],
    body,
  }),
);

/* ── Un bump de lockfile no es material ──────────────────────────────────────────────────────
   Dependabot no escribe las secciones y REESCRIBE el cuerpo en cada rebase, así que cada PR de
   dependencias nacía bloqueado y volvía a bloquearse en cada `update-branch`. El cuerpo de abajo
   es el que Dependabot manda de verdad: sin ninguna de las tres secciones. */
const cuerpoDependabot = "Bumps [undici](https://github.com/nodejs/undici) from 7.16.0 to 7.17.0.";

// 1 · sólo `package-lock.json` → no material, pasa sin secciones.
assert.equal(
  evaluateChangeEvidence({ files: ["package-lock.json"], body: cuerpoDependabot }).material,
  false,
);
assert.doesNotThrow(() =>
  evaluateChangeEvidence({ files: ["package-lock.json"], body: cuerpoDependabot }),
);

/* 2 · `package-lock.json` + `package.json` → SIGUE siendo material y sigue pidiendo secciones.
   Ahí hay una dependencia DIRECTA que alguien eligió agregar o subir: eso es una decisión y
   merece una frase. Es el límite del alcance, y es lo que impide que la exención se ensanche. */
assert.equal(
  evaluateChangeEvidence({
    files: ["package-lock.json", "package.json"],
    body,
  }).material,
  true,
);
assert.throws(
  () =>
    evaluateChangeEvidence({
      files: ["package-lock.json", "package.json"],
      body: cuerpoDependabot,
    }),
  /Faltan secciones/,
);

// 3 · `package-lock.json` + un archivo de `src/` → material: que no se cuele código bajo un bump.
assert.throws(
  () =>
    evaluateChangeEvidence({
      files: ["package-lock.json", "src/example.ts"],
      body: cuerpoDependabot,
    }),
  /Faltan secciones/,
);

/* La exención es del lockfile de la raíz y de nada más: un `package-lock.json` anidado (el de un
   paquete cualquiera del árbol) no se exime, porque el regex está anclado a la raíz. */
assert.equal(
  evaluateChangeEvidence({ files: ["tools/algo/package-lock.json"], body }).material,
  true,
);

/* Y `protectedPaths` no se tocó: si un lockfile cayera bajo una ruta protegida, sigue exigiendo
   `risk:R2` aunque no sea material. No material significa "no hace falta la frase", nunca
   "no hace falta el label". */
assert.throws(
  () =>
    evaluateChangeEvidence({
      labels: ["risk:R0"],
      files: ["package-lock.json", "wrangler.toml"],
      body: cuerpoDependabot,
    }),
  /risk:R2/,
);

console.log("change-evidence: OK");
