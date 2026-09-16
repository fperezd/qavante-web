#!/usr/bin/env node
/* Snapshot OpenAPI del productor (#298).
 *
 * El único acoplamiento contractual con `qavante-api` es la copia versionada de su
 * `docs/contracts/openapi.snapshot.json`. `src/lib/api/types.ts` se genera SOLO desde esa copia,
 * nunca desde la producción viva: así el gate de CI puede afirmar mecánicamente que los tipos
 * consumidos corresponden al contrato que dice el repo, con su SHA de origen a la vista.
 *
 *   node scripts/openapi-snapshot.mjs check           gate de CI (npm run contract:check)
 *   node scripts/openapi-snapshot.mjs sync [--ref X]  actualiza la copia desde el productor
 *                                                     (npm run generate:api:sync)
 *
 * `check`: (1) el sidecar `openapi.snapshot.source.json` declara el SHA de origen y el sha256 del
 * snapshot, y ese sha256 coincide con el archivo; (2) `npm run generate:api` deja
 * `src/lib/api/types.ts` idéntico a lo commiteado (`git diff --exit-code`). Si (2) falla, el
 * árbol queda con el `types.ts` regenerado para que el diff sea el que se commitea.
 *
 * `sync`: clona `--depth 1` la ref pedida del productor (por defecto `main`), copia el snapshot
 * byte a byte, reescribe el sidecar y regenera `types.ts`. Usa las credenciales git locales, así
 * funciona con el repo privado sin tokens en el script.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PRODUCER_REPO = "tooxs-digital/qavante-api";
export const PRODUCER_PATH = "docs/contracts/openapi.snapshot.json";
export const SNAPSHOT_PATH = "docs/contracts/openapi.snapshot.json";
export const SOURCE_PATH = "docs/contracts/openapi.snapshot.source.json";
export const TYPES_PATH = "src/lib/api/types.ts";

const REQUIRED_SOURCE_KEYS = ["repo", "ref", "sha", "path", "sha256", "fetched_at"];
const GIT_SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Sidecar que acompaña al snapshot: de dónde salió y cómo verificar que sigue siendo esa copia. */
export function buildSource({ repo, ref, sha, path: producerPath, snapshot, fetchedAt }) {
  return {
    repo,
    ref,
    sha,
    path: producerPath,
    sha256: sha256(snapshot),
    fetched_at: fetchedAt,
  };
}

/** Problemas del sidecar frente al snapshot real; vacío si es una copia íntegra y trazable. */
export function verifySource(source, snapshot) {
  const problems = [];
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    return [`${SOURCE_PATH} debe ser un objeto JSON`];
  }
  for (const key of REQUIRED_SOURCE_KEYS) {
    if (typeof source[key] !== "string" || source[key] === "") {
      problems.push(`${SOURCE_PATH}: falta "${key}"`);
    }
  }
  if (problems.length > 0) return problems;

  if (!GIT_SHA.test(source.sha)) {
    problems.push(`${SOURCE_PATH}: "sha" no es un SHA de commit completo (40 hex)`);
  }
  if (!SHA256.test(source.sha256)) {
    problems.push(`${SOURCE_PATH}: "sha256" no es un digest sha256 (64 hex)`);
  } else {
    const actual = sha256(snapshot);
    if (actual !== source.sha256) {
      problems.push(
        `${SNAPSHOT_PATH} no coincide con el sha256 declarado en ${SOURCE_PATH} ` +
          `(declarado ${source.sha256}, real ${actual}). ` +
          "El snapshot se actualiza SOLO con `npm run generate:api:sync`, que reescribe el sidecar.",
      );
    }
  }
  if (Number.isNaN(Date.parse(source.fetched_at))) {
    problems.push(`${SOURCE_PATH}: "fetched_at" no es una fecha ISO 8601`);
  }
  return problems;
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function capture(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} salió con ${result.status}`);
  return result.stdout.trim();
}

/** `npm run generate:api`, por el ejecutable de npm que invocó este script (funciona en Windows). */
function generateTypes(cwd) {
  const npm = process.env.npm_execpath;
  const status = npm
    ? run(process.execPath, [npm, "run", "generate:api"], { cwd })
    : run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "generate:api"], {
        cwd,
        shell: process.platform === "win32",
      });
  if (status !== 0) throw new Error(`generate:api salió con ${status}`);
}

export function check(cwd = process.cwd()) {
  const snapshotFile = path.join(cwd, SNAPSHOT_PATH);
  const sourceFile = path.join(cwd, SOURCE_PATH);
  for (const file of [snapshotFile, sourceFile]) {
    if (!existsSync(file)) {
      console.error(`✖ falta ${path.relative(cwd, file)}; corre \`npm run generate:api:sync\`.`);
      return 1;
    }
  }
  const snapshot = readFileSync(snapshotFile);
  const source = JSON.parse(readFileSync(sourceFile, "utf8"));
  const problems = verifySource(source, snapshot);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✖ ${problem}`);
    return 1;
  }
  console.log(
    `✔ ${SNAPSHOT_PATH} es la copia de ${source.repo}@${source.sha.slice(0, 12)} (${source.ref})`,
  );

  // Se compara el archivo tal como estaba en disco con lo regenerado (no sólo `git diff`): así el
  // gate también caza una edición manual todavía sin commitear al correrlo en local.
  const typesFile = path.join(cwd, TYPES_PATH);
  const before = existsSync(typesFile) ? readFileSync(typesFile) : Buffer.alloc(0);
  generateTypes(cwd);
  const after = readFileSync(typesFile);
  const gitStatus = run("git", ["diff", "--exit-code", "--stat", "--", TYPES_PATH], { cwd });
  if (!before.equals(after) || gitStatus !== 0) {
    console.error(
      `✖ ${TYPES_PATH} driftea de ${SNAPSHOT_PATH}: el archivo no es lo que genera ` +
        "`npm run generate:api`. types.ts quedó regenerado en el árbol: revisa el diff y commitealo " +
        "en el mismo PR (o restaura el snapshot si el cambio de contrato no era intencional).",
    );
    return 1;
  }
  console.log(`✔ ${TYPES_PATH} coincide con lo generado desde el snapshot`);
  return 0;
}

export function sync({
  cwd = process.cwd(),
  ref = "main",
  repoUrl = `https://github.com/${PRODUCER_REPO}`,
} = {}) {
  const work = mkdtempSync(path.join(tmpdir(), "qavante-openapi-snapshot-"));
  try {
    console.log(`→ clonando ${repoUrl}@${ref} (--depth 1)…`);
    if (run("git", ["init", "--quiet", work]) !== 0) throw new Error("git init falló");
    if (run("git", ["remote", "add", "origin", repoUrl], { cwd: work }) !== 0)
      throw new Error("git remote falló");
    if (run("git", ["fetch", "--quiet", "--depth", "1", "origin", ref], { cwd: work }) !== 0) {
      throw new Error(`no se pudo traer ${ref} de ${repoUrl}`);
    }
    if (run("git", ["checkout", "--quiet", "FETCH_HEAD"], { cwd: work }) !== 0)
      throw new Error("git checkout falló");
    const sha = capture("git", ["rev-parse", "FETCH_HEAD"], { cwd: work });

    const producerFile = path.join(work, PRODUCER_PATH);
    if (!existsSync(producerFile))
      throw new Error(`${PRODUCER_PATH} no existe en ${repoUrl}@${sha}`);
    const snapshot = readFileSync(producerFile);
    JSON.parse(snapshot.toString("utf8")); // el productor debe publicar JSON válido

    copyFileSync(producerFile, path.join(cwd, SNAPSHOT_PATH));
    const source = buildSource({
      repo: PRODUCER_REPO,
      ref,
      sha,
      path: PRODUCER_PATH,
      snapshot,
      fetchedAt: new Date().toISOString(),
    });
    writeFileSync(path.join(cwd, SOURCE_PATH), `${JSON.stringify(source, null, 2)}\n`);
    console.log(
      `✔ ${SNAPSHOT_PATH} ← ${PRODUCER_REPO}@${sha} (sha256 ${source.sha256.slice(0, 12)}…)`,
    );

    generateTypes(cwd);
    const changed = run("git", ["diff", "--quiet", "--", TYPES_PATH], { cwd }) !== 0;
    console.log(
      changed
        ? `→ ${TYPES_PATH} cambió: revisa el diff como cambio de contrato antes de commitear`
        : `✔ ${TYPES_PATH} no cambia con este snapshot`,
    );
    return 0;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === "--ref" && rest[i + 1]) options.ref = rest[++i];
    else if (rest[i] === "--repo" && rest[i + 1]) options.repoUrl = rest[++i];
    else throw new Error(`argumento desconocido: ${rest[i]}`);
  }
  return { command, options };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { command, options } = parseArgs(process.argv.slice(2));
    if (command === "check") process.exit(check());
    if (command === "sync") process.exit(sync(options));
    console.error(
      "uso: node scripts/openapi-snapshot.mjs <check|sync> [--ref <rama|sha>] [--repo <url>]",
    );
    process.exit(2);
  } catch (error) {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
