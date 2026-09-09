const SHA_RE = /^[0-9a-f]{40}$/;

export const REQUIRED_CI_CHECKS = Object.freeze([
  "lint",
  "qa-rediseno",
  "typecheck",
  "test",
  "test-storybook",
  "build",
  "e2e",
  "lighthouse",
  "secrets-scan",
  "dependency-audit",
]);

export const REQUIRED_RELEASE_CHECKS = Object.freeze([
  ...REQUIRED_CI_CHECKS,
  "chromatic",
  "Analyze (javascript-typescript)",
  "Analyze (python)",
]);

// El BO controla esta allowlist vía CODEOWNERS. Cambiarla es un cambio R2 y
// requiere el mismo pase independiente que el release gate.
export const TRUSTED_BO_LOGINS = Object.freeze(["fperezd"]);

export class ReleaseGateError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReleaseGateError";
  }
}

function fail(message) {
  throw new ReleaseGateError(message);
}

function latestCheckByName(checkRuns) {
  const latest = new Map();
  for (const check of checkRuns) {
    const current = latest.get(check.name);
    const checkOrder = Date.parse(check.completed_at ?? check.started_at ?? check.created_at ?? 0);
    const currentOrder = current
      ? Date.parse(current.completed_at ?? current.started_at ?? current.created_at ?? 0)
      : Number.NEGATIVE_INFINITY;
    if (
      !current ||
      checkOrder > currentOrder ||
      (checkOrder === currentOrder && check.id > current.id)
    ) {
      latest.set(check.name, check);
    }
  }
  return latest;
}

function withoutCodeBlocks(body) {
  return typeof body === "string" ? body.replace(/```[\s\S]*?```/g, "") : "";
}

function hasExactBoSignoff(comments, reviewedSha) {
  const reviewed = new RegExp(`^revisado:\\s*${reviewedSha}\\s*$`, "mi");
  return comments.some((comment) => {
    if (!TRUSTED_BO_LOGINS.includes(comment.user?.login)) return false;
    const body = withoutCodeBlocks(comment.body);
    return /^bo_signoff:\s*APPROVED\s*$/im.test(body) && reviewed.test(body);
  });
}

export function evaluateReleaseGate({
  eventName,
  ref,
  requestedSha,
  workflowSha,
  mainSha,
  mainProtected,
  releaseTreeSha,
  pullRequest,
  pullRequestTreeSha,
  releaseCheckRuns,
  reviewCheckRuns,
  boSignoffComments,
  productionEnvironment,
  requiredChecks = REQUIRED_RELEASE_CHECKS,
}) {
  if (eventName !== "workflow_dispatch") fail("release sólo admite workflow_dispatch");
  if (ref !== "refs/heads/main") fail("el workflow debe ejecutarse desde refs/heads/main");
  if (!SHA_RE.test(requestedSha)) fail("release_sha debe ser un SHA completo de 40 caracteres");
  if (requestedSha !== workflowSha)
    fail("release_sha no coincide con el SHA que definió este workflow");
  if (requestedSha !== mainSha) fail("release_sha no coincide con el tip actual de main");
  if (mainProtected !== true) fail("main no está protegida y no puede habilitar production");

  if (!pullRequest?.merged_at || pullRequest.base?.ref !== "main") {
    fail("el SHA no pertenece a un PR mergeado a main");
  }
  if (pullRequest.merge_commit_sha !== requestedSha) {
    fail("el SHA solicitado no es el merge_commit_sha del PR asociado");
  }
  if (releaseTreeSha !== pullRequestTreeSha) {
    fail("el árbol a desplegar no coincide con el árbol revisado del head del PR");
  }

  const risk = pullRequest.labels
    ?.map((label) => label.name)
    .find((name) => /^risk:R[012]$/.test(name));
  if (!risk) fail("el PR asociado no declara risk:R0, risk:R1 o risk:R2");

  const releaseChecks = latestCheckByName(releaseCheckRuns);
  for (const required of requiredChecks) {
    const check = releaseChecks.get(required);
    if (!check) fail(`falta el check requerido ${required} para release_sha`);
    if (check.status !== "completed" || check.conclusion !== "success") {
      fail(`el check ${required} terminó ${check.status}/${check.conclusion ?? "sin conclusión"}`);
    }
  }

  const reviewCheck = latestCheckByName(reviewCheckRuns).get("gate-review");
  if (!reviewCheck) fail("falta gate-review sobre el SHA exacto revisado del PR");
  if (reviewCheck.status !== "completed" || reviewCheck.conclusion !== "success") {
    fail(`gate-review terminó ${reviewCheck.status}/${reviewCheck.conclusion ?? "sin conclusión"}`);
  }
  if (!hasExactBoSignoff(boSignoffComments, pullRequest.head.sha)) {
    fail("falta sign-off explícito del BO confiable sobre el SHA exacto revisado");
  }

  const branchPolicy = productionEnvironment.deployment_branch_policy;
  if (branchPolicy?.protected_branches !== true || branchPolicy.custom_branch_policies !== false) {
    fail("production no está restringido exclusivamente a ramas protegidas");
  }

  return {
    pullRequestNumber: pullRequest.number,
    pullRequestHeadSha: pullRequest.head.sha,
    releaseSha: requestedSha,
    releaseTreeSha,
    risk,
  };
}

async function allCheckRuns(github, owner, repo, ref) {
  return github.paginate(github.rest.checks.listForRef, {
    owner,
    repo,
    ref,
    per_page: 100,
  });
}

export async function verifyReleaseGate({ github, context, core, requestedSha }) {
  const { owner, repo } = context.repo;
  const { data: branch } = await github.rest.repos.getBranch({ owner, repo, branch: "main" });
  const associated = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
    owner,
    repo,
    commit_sha: requestedSha,
    per_page: 100,
  });
  const candidate = associated.find(
    (pr) => pr.merged_at && pr.base?.ref === "main" && pr.merge_commit_sha === requestedSha,
  );
  if (!candidate) fail("no existe un PR mergeado a main asociado exactamente a release_sha");

  const [
    { data: pullRequest },
    { data: releaseCommit },
    { data: pullRequestHead },
    releaseCheckRuns,
    reviewCheckRuns,
    boSignoffComments,
    environmentResponse,
  ] = await Promise.all([
    github.rest.pulls.get({ owner, repo, pull_number: candidate.number }),
    github.rest.repos.getCommit({ owner, repo, ref: requestedSha }),
    github.rest.repos.getCommit({ owner, repo, ref: candidate.head.sha }),
    allCheckRuns(github, owner, repo, requestedSha),
    allCheckRuns(github, owner, repo, candidate.head.sha),
    github.paginate(github.rest.issues.listComments, {
      owner,
      repo,
      issue_number: candidate.number,
      per_page: 100,
    }),
    github.rest.repos.getEnvironment({ owner, repo, environment_name: "production" }),
  ]);

  const result = evaluateReleaseGate({
    eventName: context.eventName,
    ref: context.ref,
    requestedSha,
    workflowSha: context.sha,
    mainSha: branch.commit.sha,
    mainProtected: branch.protected,
    releaseTreeSha: releaseCommit.commit.tree.sha,
    pullRequest,
    pullRequestTreeSha: pullRequestHead.commit.tree.sha,
    releaseCheckRuns,
    reviewCheckRuns,
    boSignoffComments,
    productionEnvironment: environmentResponse.data,
  });

  core.info(
    `Gate release PASS: PR #${result.pullRequestNumber}, ${result.risk}, ` +
      `release ${result.releaseSha}, tree ${result.releaseTreeSha}, review ${result.pullRequestHeadSha}`,
  );
  core.setOutput("pull_request_number", String(result.pullRequestNumber));
  core.setOutput("pull_request_head_sha", result.pullRequestHeadSha);
  core.setOutput("release_tree_sha", result.releaseTreeSha);
  core.setOutput("risk", result.risk);
  return result;
}
