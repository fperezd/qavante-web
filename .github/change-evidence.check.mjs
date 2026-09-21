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
console.log("change-evidence: OK");
