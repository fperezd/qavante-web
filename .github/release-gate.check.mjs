import assert from "node:assert/strict";
import fs from "node:fs";
import { evaluateReleaseGate, REQUIRED_RELEASE_CHECKS, ReleaseGateError } from "./release-gate.mjs";

const RELEASE_SHA = "a".repeat(40);
const HEAD_SHA = "b".repeat(40);
const TREE_SHA = "c".repeat(40);
const now = "2026-09-07T12:00:00Z";
const success = (name, id = 1) => ({
  id,
  name,
  status: "completed",
  conclusion: "success",
  completed_at: now,
});

const valid = (risk = "risk:R2") => ({
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
    head: { sha: HEAD_SHA },
    labels: risk ? [{ name: risk }] : [],
  },
  pullRequestTreeSha: TREE_SHA,
  releaseCheckRuns: REQUIRED_RELEASE_CHECKS.map((name, index) => success(name, index + 1)),
  evidenceCheckRuns: [success("change-evidence")],
  boSignoffComments: [
    {
      user: { login: "fperezd" },
      body: `bo_signoff: APPROVED\nrevisado: ${HEAD_SHA}`,
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
      assert.ok(error instanceof ReleaseGateError, `${name}: tipo`);
      assert.match(error.message, expected, `${name}: mensaje`);
      return true;
    },
  );
};

assert.equal(evaluateReleaseGate(valid()).risk, "risk:R2");
assert.equal(evaluateReleaseGate(valid("risk:R1")).risk, "risk:R1");
assert.equal(evaluateReleaseGate(valid(null)).risk, "risk:R0");
assert.doesNotThrow(() => {
  const input = valid("risk:R1");
  input.boSignoffComments = [];
  evaluateReleaseGate(input);
});

reject("push automático", (input) => (input.eventName = "push"), /workflow_dispatch/);
reject("otro SHA", (input) => (input.mainSha = "d".repeat(40)), /tip actual/);
reject("main sin protección", (input) => (input.mainProtected = false), /no está protegida/);
reject("árbol distinto", (input) => (input.pullRequestTreeSha = "d".repeat(40)), /árbol/);
reject("check faltante", (input) => input.releaseCheckRuns.pop(), /falta el check/);
reject(
  "check rojo",
  (input) => (input.releaseCheckRuns[0].conclusion = "failure"),
  /terminó completed\/failure/,
);
reject("evidencia faltante", (input) => (input.evidenceCheckRuns = []), /falta change-evidence/);
reject(
  "evidencia roja",
  (input) => (input.evidenceCheckRuns[0].conclusion = "failure"),
  /change-evidence terminó/,
);
reject("R2 sin sign-off", (input) => (input.boSignoffComments = []), /sign-off explícito/);
reject(
  "sign-off sobre otro SHA",
  (input) => (input.boSignoffComments[0].body = `bo_signoff: APPROVED\nrevisado: ${RELEASE_SHA}`),
  /sign-off explícito/,
);
reject(
  "environment abierto",
  (input) => (input.productionEnvironment.deployment_branch_policy = null),
  /ramas protegidas/,
);

const ci = fs.readFileSync(new URL("./workflows/ci.yml", import.meta.url), "utf8");
assert.match(ci, /^  required:\s*$/m);
assert.match(ci, /name: ci-required/);
assert.match(ci, /cancel-in-progress: true/);
assert.equal((ci.match(/npm ci\s*$/gm) || []).length < 7, true, "CI debe consolidar npm ci");
assert.match(ci, /npm run contract:check/);
assert.match(ci, /npm run build/);
assert.match(ci, /npm run e2e/);
assert.match(ci, /npm run lighthouse/);
assert.match(ci, /gitleaks detect/);

const evidence = fs.readFileSync(
  new URL("./workflows/change-evidence.yml", import.meta.url),
  "utf8",
);
assert.match(evidence, /name: change-evidence/);
assert.doesNotMatch(evidence, /pull_request_review|issue_comment/);

const chromatic = fs.readFileSync(new URL("./workflows/chromatic.yml", import.meta.url), "utf8");
assert.match(chromatic, /cancel-in-progress: true/);
assert.match(chromatic, /paths:/);
assert.match(chromatic, /\.storybook\/\*\*/);
assert.equal(REQUIRED_RELEASE_CHECKS.includes("chromatic"), false);

const localRelease = fs.readFileSync(
  new URL("../scripts/local_azure_release.mjs", import.meta.url),
  "utf8",
);
assert.match(localRelease, /scripts\/local_release_preflight\.py/);
assert.match(localRelease, /run\("docker", \["push"/);
assert.match(localRelease, /\["containerapp", "update"/);
assert.match(localRelease, /@sha256:\[0-9a-f\]\{64\}/);
assert.match(localRelease, /SMOKE_RUT/);

console.log("release-gate: escenarios positivos y negativos OK");
