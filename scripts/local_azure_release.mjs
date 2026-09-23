import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pollRuntimeProvenance } from "../.github/release/verify-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repository = "tooxs-digital/qavante-web";
const subscription = "bfb4d4b6-d4b4-4c13-aee8-aa1df5c58839";
const registry = "acrqavanteprod";
const image = `${registry}.azurecr.io/qavante-web`;
const app = "ca-qavante-web-prod";
const group = "qavante-prod";
const appUrl = "https://app.qavante.com";
const apiUrl = "https://api.qavante.com";
const candidateContext = "local-release-candidate";
const browserImage =
  "mcr.microsoft.com/playwright@sha256:9bd26ad900bb5e0f4dee75839e957a89ae89c2b7ab1e76050e559790e946b948";

function run(program, args, { cwd = root, capture = false, env = process.env } = {}) {
  const windowsAz = process.platform === "win32" && program === "az";
  const executable = windowsAz
    ? "C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\python.exe"
    : program;
  const commandArgs = windowsAz ? ["-IBm", "azure.cli", ...args] : args;
  const result = spawnSync(executable, commandArgs, {
    cwd,
    env,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${program} failed (${result.status}): ${capture ? result.stderr.trim() : args[0]}`,
    );
  return capture ? result.stdout.trim() : "";
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}
function save(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}
function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}
function github(resource) {
  return JSON.parse(run("gh", ["api", `repos/${repository}/${resource}`], { capture: true }));
}
function az(args) {
  return run("az", [...args, "--subscription", subscription, "-o", "json", "--only-show-errors"], {
    capture: true,
  });
}

function preflight(file) {
  run("python", ["scripts/local_release_preflight.py", "--output", file]);
  return readJson(file);
}

export function activeImage(state) {
  const traffic = state?.properties?.configuration?.ingress?.traffic;
  const imageName = state?.properties?.template?.containers?.[0]?.image;
  if (
    state?.properties?.configuration?.activeRevisionsMode?.toLowerCase() !== "single" ||
    !Array.isArray(traffic) ||
    traffic.length !== 1 ||
    traffic[0].weight !== 100 ||
    (!imageName?.startsWith(`${image}:`) && !imageName?.startsWith(`${image}@sha256:`))
  ) {
    throw new Error("Azure production is not a single 100% active Qavante image");
  }
  return imageName;
}

export function verifyCandidateStatus(statuses, actor, sourceDigest) {
  const latest = statuses
    .filter((item) => item.context === candidateContext)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "") || b.id - a.id)[0];
  if (
    !latest ||
    latest.state !== "success" ||
    latest.creator?.login !== actor ||
    latest.description !== `source-sha256:${sourceDigest}`
  ) {
    throw new Error("no matching authenticated release candidate status");
  }
  return latest.id;
}

function azureState() {
  return JSON.parse(az(["containerapp", "show", "-n", app, "-g", group]));
}

function remoteDigest(tag) {
  const result = JSON.parse(
    az(["acr", "repository", "show", "--name", registry, "--image", `qavante-web:${tag}`]),
  );
  if (!/^sha256:[0-9a-f]{64}$/.test(result.digest || ""))
    throw new Error("ACR returned no immutable manifest digest");
  return result.digest;
}

function smoke(source) {
  const { SMOKE_RUT, SMOKE_PASSWORD } = process.env;
  if (!SMOKE_RUT || !SMOKE_PASSWORD)
    throw new Error("authenticated smoke credentials are required");
  run(
    "docker",
    [
      "run",
      "--rm",
      "--ipc=host",
      "--mount",
      `type=bind,source=${source},target=/workspace`,
      "-w",
      "/workspace",
      "--env",
      "CI",
      "--env",
      "SMOKE_RUT",
      "--env",
      "SMOKE_PASSWORD",
      "--env",
      "SMOKE_BASE_URL",
      "--env",
      "SMOKE_API_URL",
      browserImage,
      "npm",
      "run",
      "smoke",
    ],
    { env: { ...process.env, CI: "true", SMOKE_BASE_URL: appUrl, SMOKE_API_URL: apiUrl } },
  );
}

async function prepare(directory) {
  if (existsSync(directory)) throw new Error("release directory already exists");
  mkdirSync(directory, { recursive: true });
  const gate = preflight(path.join(directory, "preflight.json"));
  const archive = path.join(directory, "source.tar");
  const source = path.join(directory, "source");
  mkdirSync(source);
  run("git", ["archive", "--format=tar", `--output=${archive}`, "HEAD"]);
  const sourceDigest = sha256(archive);
  run("tar", ["-xf", archive, "-C", source]);
  const tag = `prod-${gate.release_sha}`;
  const taggedImage = `${image}:${tag}`;
  run("docker", [
    "build",
    "--pull",
    "--build-arg",
    `NEXT_PUBLIC_API_URL=${apiUrl}`,
    "--build-arg",
    "NEXT_PUBLIC_APP_ENV=prod",
    "--build-arg",
    `QAVANTE_RELEASE_SHA=${gate.release_sha}`,
    "--build-arg",
    `QAVANTE_RELEASE_BUNDLE_SHA256=${sourceDigest}`,
    "--label",
    `org.opencontainers.image.revision=${gate.release_sha}`,
    "--label",
    `com.qavante.source-sha256=${sourceDigest}`,
    "-t",
    taggedImage,
    source,
  ]);
  run("python", ["scripts/verify_source_archive.py", archive, source]);
  const imageId = run("docker", ["image", "inspect", "--format", "{{.Id}}", taggedImage], {
    capture: true,
  });
  if (!/^sha256:[0-9a-f]{64}$/.test(imageId)) throw new Error("Docker returned no image ID");
  if (github("commits/main").sha !== gate.release_sha)
    throw new Error("main advanced during build");
  const actor = JSON.parse(run("gh", ["api", "user"], { capture: true })).login;
  const status = JSON.parse(
    run(
      "gh",
      [
        "api",
        "--method",
        "POST",
        `repos/${repository}/statuses/${gate.release_sha}`,
        "-f",
        "state=success",
        "-f",
        `context=${candidateContext}`,
        "-f",
        `description=source-sha256:${sourceDigest}`,
      ],
      { capture: true },
    ),
  );
  if (status.creator?.login !== actor || status.description !== `source-sha256:${sourceDigest}`) {
    throw new Error("release candidate status does not match publisher or source");
  }
  save(path.join(directory, "release-manifest.json"), {
    ...gate,
    source_sha256: sourceDigest,
    image_id: imageId,
    image_tag: taggedImage,
    candidate_status_id: status.id,
    smoke_image: browserImage,
    prepared_at: new Date().toISOString(),
  });
}

async function promote(directory) {
  const manifest = readJson(path.join(directory, "release-manifest.json"));
  if (existsSync(path.join(directory, "production-receipt.json")))
    throw new Error("release already promoted");
  const attempt = path.join(directory, `attempt-${randomUUID()}`);
  mkdirSync(attempt);
  const gate = preflight(path.join(attempt, "preflight.json"));
  for (const key of ["release_sha", "release_tree", "reviewed_head_sha", "reviewed_pull_request"]) {
    if (manifest[key] !== gate[key]) throw new Error(`release gate changed: ${key}`);
  }
  const source = path.join(attempt, "source");
  if (
    sha256(path.join(directory, "source.tar")) !== manifest.source_sha256 ||
    manifest.smoke_image !== browserImage ||
    run("docker", ["image", "inspect", "--format", "{{.Id}}", manifest.image_tag], {
      capture: true,
    }) !== manifest.image_id
  ) {
    throw new Error("prepared artifact identity changed");
  }
  const actor = JSON.parse(run("gh", ["api", "user"], { capture: true })).login;
  const statuses = github(`commits/${manifest.release_sha}/statuses?per_page=100`);
  if (
    !Array.isArray(statuses) ||
    statuses.length >= 100 ||
    verifyCandidateStatus(statuses, actor, manifest.source_sha256) !== manifest.candidate_status_id
  ) {
    throw new Error("release candidate status changed");
  }
  if (!process.env.SMOKE_RUT || !process.env.SMOKE_PASSWORD)
    throw new Error("smoke credentials missing");
  const account = JSON.parse(
    run("az", ["account", "show", "--subscription", subscription, "-o", "json"], {
      capture: true,
    }),
  );
  if (account.id !== subscription) throw new Error("Azure CLI is not on the Qavante subscription");
  const before = azureState();
  const oldImage = activeImage(before);
  const oldTag = oldImage.split(":").at(-1);
  const oldDigest = oldImage.includes("@sha256:") ? oldImage.split("@")[1] : remoteDigest(oldTag);
  const rollbackImage = `${image}@${oldDigest}`;
  save(path.join(attempt, "azure-before.json"), before);
  mkdirSync(source);
  run("tar", ["-xf", path.join(directory, "source.tar"), "-C", source]);
  run("docker", [
    "run",
    "--rm",
    "--mount",
    `type=bind,source=${source},target=/workspace`,
    "-w",
    "/workspace",
    browserImage,
    "npm",
    "ci",
    "--no-audit",
    "--no-fund",
  ]);
  smoke(source);
  if (activeImage(azureState()) !== oldImage)
    throw new Error("Azure deployment changed during preflight");
  az(["acr", "login", "--name", registry]);
  run("docker", ["push", manifest.image_tag]);
  const digest = remoteDigest(manifest.image_tag.split(":").at(-1));
  const releaseImage = `${image}@${digest}`;
  save(path.join(attempt, "pushed-image.json"), {
    image: releaseImage,
    local_image_id: manifest.image_id,
  });
  let promotionStarted = false;
  try {
    promotionStarted = true;
    az(["containerapp", "update", "-n", app, "-g", group, "--image", releaseImage]);
    const after = azureState();
    if (activeImage(after) !== releaseImage)
      throw new Error("Azure did not activate the exact image digest");
    save(path.join(attempt, "azure-after.json"), after);
    const runtime = await pollRuntimeProvenance({
      url: `${appUrl}/api/release`,
      releaseSha: manifest.release_sha,
      bundleSha: manifest.source_sha256,
      budgetMs: 300_000,
    });
    save(path.join(attempt, "runtime-release.json"), runtime.body);
    smoke(source);
    save(path.join(directory, "production-receipt.json"), {
      ...manifest,
      attempt,
      image_digest: digest,
      rollback_image: rollbackImage,
      observed_at: new Date().toISOString(),
    });
  } catch (error) {
    if (promotionStarted) {
      let restored = false;
      let smokePassed = false;
      let rollbackError = null;
      try {
        const observedImage = activeImage(azureState());
        if (![oldImage, rollbackImage, releaseImage].includes(observedImage)) {
          throw new Error("Azure changed to an unrelated image; automatic rollback is unsafe");
        }
        if (observedImage !== oldImage && observedImage !== rollbackImage) {
          az(["containerapp", "update", "-n", app, "-g", group, "--image", rollbackImage]);
        }
        restored = [oldImage, rollbackImage].includes(activeImage(azureState()));
        if (restored) {
          smoke(source);
          smokePassed = true;
        }
      } catch (failure) {
        rollbackError = String(failure);
      }
      save(path.join(attempt, "rollback-receipt.json"), {
        restored,
        smoke_passed: smokePassed,
        rollback_image: rollbackImage,
        reason: String(error),
        rollback_error: rollbackError,
        observed_at: new Date().toISOString(),
      });
      if (!restored || !smokePassed)
        throw new Error(`release failed and rollback is unverified: ${error}; ${rollbackError}`);
    }
    throw error;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [operation, directory] = process.argv.slice(2);
  if (!["prepare", "promote"].includes(operation) || !directory || !path.isAbsolute(directory)) {
    console.error(
      "usage: node scripts/local_azure_release.mjs prepare|promote <absolute-directory>",
    );
    process.exitCode = 2;
  } else {
    try {
      if (operation === "prepare") await prepare(directory);
      else await promote(directory);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
