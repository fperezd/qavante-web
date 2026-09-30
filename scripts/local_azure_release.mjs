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
const SHA_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const provenanceEnvironmentNames = [
  "QAVANTE_RELEASE_SHA",
  "QAVANTE_RELEASE_TREE_SHA",
  "QAVANTE_RELEASE_BUNDLE_SHA256",
  "QAVANTE_RELEASE_VERSION",
  "QAVANTE_RELEASE_IMAGE_REF",
];

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

// Mismo contrato que la API (tooxs-digital/qavante-api
// scripts/local_azure_release.mjs): credenciales de smoke y material Cosign
// presentes antes de leer o mutar Azure. Sólo se informan nombres faltantes.
export const releaseCredentialNames = [
  "SMOKE_RUT",
  "SMOKE_PASSWORD",
  "COSIGN_KEY",
  "COSIGN_PUBLIC_KEY",
  "COSIGN_PASSWORD",
];

export function requireReleaseCredentials(environment) {
  const missing = releaseCredentialNames.filter(
    (name) => typeof environment?.[name] !== "string" || environment[name].length === 0,
  );
  if (missing.length)
    throw new Error(
      `smoke credentials and Cosign signing key/public key/password are required: ${missing.join(", ")}`,
    );
}

// Cosign `verify` devuelve un arreglo de payloads firmados. Sólo acredita la
// promoción si alguno firma exactamente el digest que se va a activar.
export function verifySignatureForDigest(signature, digest) {
  if (!/^sha256:[a-f0-9]{64}$/.test(digest || "") || !Array.isArray(signature)) {
    throw new Error("image signature verification returned no usable evidence");
  }
  const signed = signature.some(
    (entry) => entry?.critical?.image?.["docker-manifest-digest"] === digest,
  );
  if (!signed) throw new Error("Cosign evidence does not attest the promoted image digest");
}

function hostOf(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// La imagen web hornea NEXT_PUBLIC_* en build: si apunta a otro host, ningún
// cambio de entorno en Azure lo corrige. Se verifica contra `docker image
// inspect` antes de firmar y publicar, junto a la identidad de fuente horneada.
export function assertBakedWebImage(
  imageEnvironment,
  { releaseSha, releaseTree, sourceDigest, version },
) {
  if (!Array.isArray(imageEnvironment)) throw new Error("Docker image has no environment");
  const baked = new Map();
  for (const entry of imageEnvironment) {
    const index = typeof entry === "string" ? entry.indexOf("=") : -1;
    if (index > 0) baked.set(entry.slice(0, index), entry.slice(index + 1));
  }
  const expected = {
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_APP_ENV: "prod",
    QAVANTE_RELEASE_SHA: releaseSha,
    QAVANTE_RELEASE_TREE_SHA: releaseTree,
    QAVANTE_RELEASE_BUNDLE_SHA256: sourceDigest,
    QAVANTE_RELEASE_VERSION: version,
  };
  for (const [name, value] of Object.entries(expected)) {
    if (baked.get(name) !== value) {
      const host =
        name === "NEXT_PUBLIC_API_URL"
          ? ` (observed host ${hostOf(baked.get(name)) ?? "<none>"})`
          : "";
      throw new Error(`Docker image baked ${name} differs from the release manifest${host}`);
    }
  }
  return true;
}

// Paridad con azureRuntimeIntegrationReadiness de la API: lectura de metadata
// del Container App antes de cualquier mutación. La web no tiene secretos de
// integración; lo aplicable es no enviar al navegador ni al servidor un
// backend que no sea el dominio canónico ni un host *.azurecontainerapps.io.
export function azureWebRuntimeReadiness(state) {
  const environment = templateEnvironment(state);
  for (const [name, value] of environment) {
    if (typeof value !== "string") continue;
    const host = hostOf(value);
    if (host && host.endsWith(".azurecontainerapps.io")) {
      throw new Error(
        `Azure web ${name} points at a Container Apps host (${host}); use the canonical domain`,
      );
    }
  }
  if (environment.has("NEXT_PUBLIC_API_URL") && environment.get("NEXT_PUBLIC_API_URL") !== apiUrl) {
    throw new Error(`Azure web NEXT_PUBLIC_API_URL must be exactly ${apiUrl}`);
  }
  return true;
}

function imageEnvironment(imageTag) {
  return JSON.parse(
    run("docker", ["image", "inspect", "--format", "{{json .Config.Env}}", imageTag], {
      capture: true,
    }),
  );
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

export function releaseEnvironment({ releaseSha, releaseTree, sourceDigest, version, imageRef }) {
  if (!SHA_RE.test(releaseSha) || !SHA_RE.test(releaseTree))
    throw new Error("release provenance has an invalid source SHA or tree");
  if (!SHA256_RE.test(sourceDigest))
    throw new Error("release provenance has an invalid source digest");
  if (!VERSION_RE.test(version))
    throw new Error("release provenance has an invalid package version");
  if (!/^acrqavanteprod\.azurecr\.io\/qavante-web@sha256:[0-9a-f]{64}$/.test(imageRef))
    throw new Error("release provenance has an invalid immutable image reference");
  return [
    `QAVANTE_RELEASE_SHA=${releaseSha}`,
    `QAVANTE_RELEASE_TREE_SHA=${releaseTree}`,
    `QAVANTE_RELEASE_BUNDLE_SHA256=${sourceDigest}`,
    `QAVANTE_RELEASE_VERSION=${version}`,
    `QAVANTE_RELEASE_IMAGE_REF=${imageRef}`,
  ];
}

function templateEnvironment(state) {
  const entries = state?.properties?.template?.containers?.[0]?.env;
  if (!Array.isArray(entries)) throw new Error("Azure state has no container environment");
  const values = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry.name !== "string") continue;
    if (values.has(entry.name))
      throw new Error(`Azure state repeats environment variable ${entry.name}`);
    values.set(entry.name, entry.value);
  }
  return values;
}

// Azure no elimina vars que no se mencionan en --set-env-vars. Por eso el
// rollback debe reconstruir este subconjunto desde el estado anterior y pedir
// explícitamente la eliminación de las que antes no existían.
export function rollbackReleaseEnvironment(before) {
  const prior = templateEnvironment(before);
  const set = [];
  const remove = [];
  for (const name of provenanceEnvironmentNames) {
    if (!prior.has(name)) {
      remove.push(name);
      continue;
    }
    const value = prior.get(name);
    if (typeof value !== "string")
      throw new Error(`previous release provenance ${name} is not a literal value`);
    set.push(`${name}=${value}`);
  }
  return { set, remove };
}

export function rollbackUpdateArguments(before, rollbackImage) {
  const environment = rollbackReleaseEnvironment(before);
  const args = ["containerapp", "update", "-n", app, "-g", group, "--image", rollbackImage];
  if (environment.set.length) args.push("--set-env-vars", ...environment.set);
  if (environment.remove.length) args.push("--remove-env-vars", ...environment.remove);
  return args;
}

export function isRollbackRuntimeMatch(body, before, rollbackImage) {
  const prior = templateEnvironment(before);
  const values = Object.fromEntries(
    provenanceEnvironmentNames.map((name) => [name, prior.get(name)]),
  );
  const present = provenanceEnvironmentNames.filter((name) => prior.has(name));
  if (present.length === 0) {
    // Las revisiones anteriores a este contrato sólo devolvían los dos campos
    // originales. Aceptamos exactamente su señal de indisponibilidad: no
    // confundimos campos nuevos ausentes con una procedencia válida, ni
    // toleramos valores no nulos en ninguno de ellos.
    const absentOrNull = (value) => value === undefined || value === null;
    return (
      body?.status === "unavailable" &&
      body.source_sha === null &&
      body.bundle_sha256 === null &&
      absentOrNull(body.source_tree) &&
      absentOrNull(body.version) &&
      absentOrNull(body.image_ref)
    );
  }
  // Cualquier subset es corrupción de identidad, no un release legacy. Si
  // aceptáramos su 503 nulo, una revisión que dejó una sola clave nueva podría
  // ocultar precisamente el estado que el rollback debe recuperar.
  if (present.length !== provenanceEnvironmentNames.length) return false;
  try {
    releaseEnvironment({
      releaseSha: values.QAVANTE_RELEASE_SHA,
      releaseTree: values.QAVANTE_RELEASE_TREE_SHA,
      sourceDigest: values.QAVANTE_RELEASE_BUNDLE_SHA256,
      version: values.QAVANTE_RELEASE_VERSION,
      imageRef: values.QAVANTE_RELEASE_IMAGE_REF,
    });
  } catch {
    return false;
  }
  return (
    values.QAVANTE_RELEASE_IMAGE_REF === rollbackImage &&
    body?.status === "ok" &&
    body.source_sha === values.QAVANTE_RELEASE_SHA &&
    body.source_tree === values.QAVANTE_RELEASE_TREE_SHA &&
    body.bundle_sha256 === values.QAVANTE_RELEASE_BUNDLE_SHA256 &&
    body.version === values.QAVANTE_RELEASE_VERSION &&
    body.image_ref === values.QAVANTE_RELEASE_IMAGE_REF
  );
}

async function verifyRollbackRuntime(before, rollbackImage, { budgetMs = 300_000 } = {}) {
  const deadline = Date.now() + budgetMs;
  let lastBody = null;
  do {
    try {
      const response = await fetch(`${appUrl}/api/release`);
      lastBody = await response.json();
    } catch (error) {
      lastBody = { error: String(error?.message ?? error) };
    }
    if (isRollbackRuntimeMatch(lastBody, before, rollbackImage)) return lastBody;
    if (Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5_000));
  } while (Date.now() < deadline);
  throw new Error(
    `rollback runtime provenance did not match previous revision: ${JSON.stringify(lastBody)}`,
  );
}

function packageVersion() {
  const version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
  if (typeof version !== "string" || !VERSION_RE.test(version))
    throw new Error("package.json has no valid immutable release version");
  return version;
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
  const version = packageVersion();
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
    `QAVANTE_RELEASE_TREE_SHA=${gate.release_tree}`,
    "--build-arg",
    `QAVANTE_RELEASE_BUNDLE_SHA256=${sourceDigest}`,
    "--build-arg",
    `QAVANTE_RELEASE_VERSION=${version}`,
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
  assertBakedWebImage(imageEnvironment(taggedImage), {
    releaseSha: gate.release_sha,
    releaseTree: gate.release_tree,
    sourceDigest,
    version,
  });
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
    release_version: version,
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
  requireReleaseCredentials(process.env);
  assertBakedWebImage(imageEnvironment(manifest.image_tag), {
    releaseSha: manifest.release_sha,
    releaseTree: manifest.release_tree,
    sourceDigest: manifest.source_sha256,
    version: manifest.release_version,
  });
  const account = JSON.parse(
    run("az", ["account", "show", "--subscription", subscription, "-o", "json"], {
      capture: true,
    }),
  );
  if (account.id !== subscription) throw new Error("Azure CLI is not on the Qavante subscription");
  const before = azureState();
  azureWebRuntimeReadiness(before);
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
  // Igual que la API: firmar por digest y verificar con la clave pública antes
  // de que Azure pueda activar la imagen. COSIGN_PASSWORD viaja por el entorno.
  run("cosign", ["sign", "--yes", "--key", process.env.COSIGN_KEY, releaseImage]);
  const signature = JSON.parse(
    run("cosign", ["verify", "--key", process.env.COSIGN_PUBLIC_KEY, releaseImage], {
      capture: true,
    }),
  );
  verifySignatureForDigest(signature, digest);
  save(path.join(attempt, "signature-verification.json"), signature);
  const environment = releaseEnvironment({
    releaseSha: manifest.release_sha,
    releaseTree: manifest.release_tree,
    sourceDigest: manifest.source_sha256,
    version: manifest.release_version,
    imageRef: releaseImage,
  });
  save(path.join(attempt, "pushed-image.json"), {
    image: releaseImage,
    local_image_id: manifest.image_id,
  });
  let promotionStarted = false;
  try {
    promotionStarted = true;
    az([
      "containerapp",
      "update",
      "-n",
      app,
      "-g",
      group,
      "--image",
      releaseImage,
      "--set-env-vars",
      ...environment,
    ]);
    const after = azureState();
    if (activeImage(after) !== releaseImage)
      throw new Error("Azure did not activate the exact image digest");
    save(path.join(attempt, "azure-after.json"), after);
    const runtime = await pollRuntimeProvenance({
      url: `${appUrl}/api/release`,
      releaseSha: manifest.release_sha,
      bundleSha: manifest.source_sha256,
      treeSha: manifest.release_tree,
      version: manifest.release_version,
      imageRef: releaseImage,
      budgetMs: 300_000,
    });
    save(path.join(attempt, "runtime-release.json"), runtime.body);
    smoke(source);
    save(path.join(directory, "production-receipt.json"), {
      ...manifest,
      attempt,
      image_digest: digest,
      signature_verification_sha256: sha256(path.join(attempt, "signature-verification.json")),
      rollback_image: rollbackImage,
      observed_at: new Date().toISOString(),
    });
  } catch (error) {
    if (promotionStarted) {
      let restored = false;
      let runtimeProvenanceVerified = false;
      let smokePassed = false;
      let rollbackError = null;
      try {
        const observedImage = activeImage(azureState());
        if (![oldImage, rollbackImage, releaseImage].includes(observedImage)) {
          throw new Error("Azure changed to an unrelated image; automatic rollback is unsafe");
        }
        // Incluso si ya volvió a la imagen anterior, un update parcial puede
        // haber dejado env vars de la revisión nueva. Restauramos siempre
        // imagen + subset de provenance desde `before`.
        az(rollbackUpdateArguments(before, rollbackImage));
        restored = activeImage(azureState()) === rollbackImage;
        if (restored) {
          const runtime = await verifyRollbackRuntime(before, rollbackImage);
          save(path.join(attempt, "rollback-runtime-release.json"), runtime);
          runtimeProvenanceVerified = true;
          smoke(source);
          smokePassed = true;
        }
      } catch (failure) {
        rollbackError = String(failure);
      }
      save(path.join(attempt, "rollback-receipt.json"), {
        restored,
        runtime_provenance_verified: runtimeProvenanceVerified,
        smoke_passed: smokePassed,
        rollback_image: rollbackImage,
        reason: String(error),
        rollback_error: rollbackError,
        observed_at: new Date().toISOString(),
      });
      if (!restored || !runtimeProvenanceVerified || !smokePassed)
        throw new Error(`release failed and rollback is unverified: ${error}; ${rollbackError}`);
    }
    throw error;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [operation, directory] = process.argv.slice(2);
  // Ruta local desactivada por defecto: Azure PROD se despliega con GitHub Actions.
  // Se conserva como referencia y sólo se habilita por decisión explícita del owner.
  if (process.env.QAVANTE_ENABLE_LEGACY_LOCAL_RELEASE !== "1") {
    console.error("release local desactivado; usar Deploy web to Azure PROD");
    process.exitCode = 2;
  } else if (
    !["prepare", "promote"].includes(operation) ||
    !directory ||
    !path.isAbsolute(directory)
  ) {
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
