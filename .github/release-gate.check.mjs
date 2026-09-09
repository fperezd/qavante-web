import assert from "node:assert/strict";
import fs from "node:fs";
import {
  evaluateReleaseGate,
  REQUIRED_CI_CHECKS,
  REQUIRED_RELEASE_CHECKS,
  ReleaseGateError,
} from "./release-gate.mjs";

const RELEASE_SHA = "a".repeat(40);
const REVIEW_SHA = "b".repeat(40);
const TREE_SHA = "c".repeat(40);
const now = "2026-09-07T12:00:00Z";
const success = (name, id = 1) => ({
  id,
  name,
  status: "completed",
  conclusion: "success",
  completed_at: now,
});

const valid = () => ({
  eventName: "workflow_dispatch",
  ref: "refs/heads/main",
  requestedSha: RELEASE_SHA,
  workflowSha: RELEASE_SHA,
  mainSha: RELEASE_SHA,
  mainProtected: true,
  releaseTreeSha: TREE_SHA,
  pullRequest: {
    number: 205,
    merged_at: now,
    merge_commit_sha: RELEASE_SHA,
    base: { ref: "main" },
    head: { sha: REVIEW_SHA },
    labels: [{ name: "risk:R2" }],
  },
  pullRequestTreeSha: TREE_SHA,
  releaseCheckRuns: REQUIRED_RELEASE_CHECKS.map((name, index) => success(name, index + 1)),
  reviewCheckRuns: [success("gate-review")],
  boSignoffComments: [
    {
      user: { login: "fperezd" },
      body: `bo_signoff: APPROVED\nrevisado: ${REVIEW_SHA}`,
    },
  ],
  productionEnvironment: {
    deployment_branch_policy: { protected_branches: true, custom_branch_policies: false },
  },
});

const reject = (name, mutate, expected) => {
  const input = valid();
  mutate(input);
  assert.throws(
    () => evaluateReleaseGate(input),
    (error) => {
      assert.ok(error instanceof ReleaseGateError, `${name}: tipo de error`);
      assert.match(error.message, expected, `${name}: mensaje`);
      return true;
    },
  );
};

assert.deepEqual(evaluateReleaseGate(valid()), {
  pullRequestNumber: 205,
  pullRequestHeadSha: REVIEW_SHA,
  releaseSha: RELEASE_SHA,
  releaseTreeSha: TREE_SHA,
  risk: "risk:R2",
});

reject("push automático", (input) => (input.eventName = "push"), /workflow_dispatch/);
reject("rama manual", (input) => (input.ref = "refs/heads/a/release"), /refs\/heads\/main/);
reject("SHA corto", (input) => (input.requestedSha = RELEASE_SHA.slice(0, 7)), /40 caracteres/);
reject(
  "workflow de otro SHA",
  (input) => (input.workflowSha = "d".repeat(40)),
  /definió este workflow/,
);
reject("otro SHA", (input) => (input.mainSha = "d".repeat(40)), /tip actual/);
reject("main sin protección", (input) => (input.mainProtected = false), /main no está protegida/);
reject("sin PR", (input) => (input.pullRequest.merged_at = null), /PR mergeado/);
reject(
  "merge distinto",
  (input) => (input.pullRequest.merge_commit_sha = "d".repeat(40)),
  /merge_commit_sha/,
);
reject("árbol distinto", (input) => (input.pullRequestTreeSha = "d".repeat(40)), /árbol revisado/);
reject("sin riesgo", (input) => (input.pullRequest.labels = []), /no declara/);
reject("check faltante", (input) => input.releaseCheckRuns.pop(), /falta el check/);
for (const conclusion of ["failure", "cancelled", "skipped", "neutral", null]) {
  reject(
    `check ${conclusion ?? "sin conclusión"}`,
    (input) => {
      input.releaseCheckRuns[0] = { ...input.releaseCheckRuns[0], conclusion };
    },
    /terminó completed/,
  );
}
reject(
  "check pendiente",
  (input) => {
    input.releaseCheckRuns[0] = {
      ...input.releaseCheckRuns[0],
      status: "in_progress",
      conclusion: null,
    };
  },
  /in_progress/,
);
reject("gate-review faltante", (input) => (input.reviewCheckRuns = []), /falta gate-review/);
reject(
  "gate-review rojo",
  (input) => (input.reviewCheckRuns[0] = { ...input.reviewCheckRuns[0], conclusion: "failure" }),
  /gate-review terminó/,
);
reject("sin sign-off BO", (input) => (input.boSignoffComments = []), /sign-off explícito/);
reject(
  "sign-off de identidad no confiable",
  (input) => (input.boSignoffComments[0].user.login = "otro"),
  /sign-off explícito/,
);
reject(
  "sign-off para otro SHA",
  (input) => (input.boSignoffComments[0].body = `bo_signoff: APPROVED\nrevisado: ${RELEASE_SHA}`),
  /sign-off explícito/,
);
reject(
  "sign-off sólo citado",
  (input) =>
    (input.boSignoffComments[0].body = `\`\`\`\nbo_signoff: APPROVED\nrevisado: ${REVIEW_SHA}\n\`\`\``),
  /sign-off explícito/,
);
reject(
  "environment abierto a cualquier rama",
  (input) => (input.productionEnvironment.deployment_branch_policy = null),
  /ramas protegidas/,
);
reject(
  "environment con política custom no probada",
  (input) =>
    (input.productionEnvironment.deployment_branch_policy = {
      protected_branches: false,
      custom_branch_policies: true,
    }),
  /ramas protegidas/,
);

const rerun = valid();
rerun.releaseCheckRuns.push({
  ...success("lint", 999),
  completed_at: "2026-09-07T12:05:00Z",
});
assert.doesNotThrow(() => evaluateReleaseGate(rerun));

reject(
  "re-run rojo posterior",
  (input) => {
    input.releaseCheckRuns.push({
      ...success("lint", 999),
      conclusion: "failure",
      completed_at: "2026-09-07T12:05:00Z",
    });
  },
  /lint terminó completed\/failure/,
);

const ciWorkflow = fs.readFileSync(new URL("./workflows/ci.yml", import.meta.url), "utf8");
for (const checkName of REQUIRED_CI_CHECKS) {
  assert.match(
    ciWorkflow,
    new RegExp(`^  ${checkName}:`, "m"),
    `CI debe conservar el job ${checkName}`,
  );
}
assert.ok(REQUIRED_RELEASE_CHECKS.includes("chromatic"));
assert.ok(REQUIRED_RELEASE_CHECKS.includes("Analyze (javascript-typescript)"));
assert.ok(REQUIRED_RELEASE_CHECKS.includes("Analyze (python)"));

const releaseWorkflow = fs.readFileSync(
  new URL("./workflows/deploy-cloudflare.yml", import.meta.url),
  "utf8",
);
const releaseGateSource = fs.readFileSync(new URL("./release-gate.mjs", import.meta.url), "utf8");
const deployRunbook = fs.readFileSync(
  new URL("../docs/operations/deploy-runbook.md", import.meta.url),
  "utf8",
);
const secretsRunbook = fs.readFileSync(
  new URL("../docs/operations/github-secrets.md", import.meta.url),
  "utf8",
);
assert.doesNotMatch(releaseWorkflow, /^  push:/m, "deploy no puede dispararse por push");
assert.match(releaseWorkflow, /^  workflow_dispatch:/m);
assert.match(releaseWorkflow, /environment:\s*\n\s*name: production/);
assert.equal(
  [...releaseWorkflow.matchAll(/verifyReleaseGate/g)].length,
  2,
  "el gate se valida antes del build y otra vez antes de promover",
);
assert.match(releaseWorkflow, /git\/ref\/heads\/main/);
assert.match(releaseWorkflow, /secrets\.PRODUCTION_CLOUDFLARE_API_TOKEN/);
assert.match(releaseWorkflow, /secrets\.PRODUCTION_SMOKE_RUT/);
const referencedSecrets = [...releaseWorkflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(
  (match) => match[1],
);
assert.ok(referencedSecrets.length >= 4);
assert.ok(
  referencedSecrets.every((name) => name.startsWith("PRODUCTION_")),
  `toda credencial debe ser environment-scoped por nombre: ${referencedSecrets.join(", ")}`,
);
assert.doesNotMatch(
  releaseWorkflow,
  /PRODUCTION_RELEASE_GATE_GITHUB_TOKEN|RELEASE_GATE_PROTECTION_TOKEN/,
  "el workflow no debe depender de un token administrativo adicional",
);
assert.doesNotMatch(
  releaseGateSource,
  /branches\/\{branch\}\/protection|PRODUCTION_RELEASE_GATE_GITHUB_TOKEN/,
  "el gate no debe afirmar que reconsulta protección detallada sin credenciales",
);
assert.doesNotMatch(
  secretsRunbook,
  /PRODUCTION_RELEASE_GATE_GITHUB_TOKEN|Administration:\s*Read/,
  "la documentación no debe conservar un contrato de secret eliminado",
);
assert.match(
  deployRunbook,
  /no puede reconsultar en runtime/i,
  "el runbook debe declarar el límite de verificación runtime",
);
assert.match(
  deployRunbook,
  /strict.*enforce_admins|enforce_admins.*strict/is,
  "el runbook debe conservar la exigencia operacional de main",
);
assert.doesNotMatch(
  releaseWorkflow,
  /wrangler deploy[^\n]*--var/,
  "release debe preservar todas las vars versionadas",
);

console.log("release-gate: escenarios positivos y negativos OK");
