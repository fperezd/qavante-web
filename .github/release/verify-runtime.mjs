// Sondea /api/release hasta que Cloudflare propaga el deploy o se agota el
// presupuesto. Reemplaza el `curl --retry` + `node -e` de un solo intento:
// ese combo sólo reintentaba errores HTTP, así que una respuesta 200 con el
// SHA/bundle anteriores (propagación en curso) se aceptaba como definitiva y
// el paso fallaba con un deploy que en realidad estaba sirviendo bien unos
// segundos después. Ver qavante-web#294.
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const DEFAULT_BUDGET_MS = 120_000;
export const DEFAULT_INTERVAL_MS = 5_000;
export const DEFAULT_RUNTIME_RELEASE_URL = "https://app.qavante.com/api/release";

export const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;
export const BUNDLE_SHA256_PATTERN = /^[0-9a-f]{64}$/;
export const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
export const IMAGE_REF_PATTERN = /^[a-z0-9][a-z0-9._/-]*@sha256:[0-9a-f]{64}$/;

export class RuntimeProvenanceError extends Error {
  constructor(message, lastBody) {
    super(message);
    this.name = "RuntimeProvenanceError";
    this.lastBody = lastBody;
  }
}

// Un RELEASE_SHA/BUNDLE_SHA256 malformado (input humano vía workflow_dispatch,
// o un output de job roto) nunca va a coincidir en /api/release: sin esto se
// queman los 120s completos del presupuesto y el mensaje final ("agotó el
// presupuesto") sugiere lag de propagación cuando en realidad el valor de
// entrada estaba mal desde el intento 0. Se valida antes de la primera
// llamada a fetch.
export function assertValidProvenanceInputs(
  releaseSha,
  bundleSha,
  { treeSha, version, imageRef } = {},
) {
  if (typeof releaseSha !== "string" || !RELEASE_SHA_PATTERN.test(releaseSha)) {
    throw new RuntimeProvenanceError(
      `RELEASE_SHA inválido: se esperaba un SHA-1 de 40 caracteres hexadecimales en minúsculas, recibido ${JSON.stringify(releaseSha)}`,
      null,
    );
  }
  if (typeof bundleSha !== "string" || !BUNDLE_SHA256_PATTERN.test(bundleSha)) {
    throw new RuntimeProvenanceError(
      `BUNDLE_SHA256 inválido: se esperaba un SHA-256 de 64 caracteres hexadecimales en minúsculas, recibido ${JSON.stringify(bundleSha)}`,
      null,
    );
  }
  if (
    treeSha !== undefined &&
    (typeof treeSha !== "string" || !RELEASE_SHA_PATTERN.test(treeSha))
  ) {
    throw new RuntimeProvenanceError(
      `RELEASE_TREE_SHA invÃ¡lido: se esperaba un SHA-1 de 40 caracteres hexadecimales en minÃºsculas, recibido ${JSON.stringify(treeSha)}`,
      null,
    );
  }
  if (version !== undefined && (typeof version !== "string" || !VERSION_PATTERN.test(version))) {
    throw new RuntimeProvenanceError(
      `RELEASE_VERSION invÃ¡lida: se esperaba semver, recibido ${JSON.stringify(version)}`,
      null,
    );
  }
  if (
    imageRef !== undefined &&
    (typeof imageRef !== "string" || !IMAGE_REF_PATTERN.test(imageRef))
  ) {
    throw new RuntimeProvenanceError(
      `RELEASE_IMAGE_REF invÃ¡lida: se esperaba una referencia OCI por digest, recibido ${JSON.stringify(imageRef)}`,
      null,
    );
  }
}

// Función pura: compara la respuesta de /api/release contra la procedencia
// esperada del release que se acaba de promover. Sin ella (y sin este sondeo)
// una respuesta con el bundle anterior "coincide" por accidente sólo si
// alguien afloja la comparación; se mantiene explícita e independiente del
// bucle para poder testearla sin red ni temporizadores.
export function isProvenanceMatch(json, releaseSha, bundleSha, expected = {}) {
  const { treeSha, version, imageRef } = expected;
  return (
    !!json &&
    typeof json === "object" &&
    typeof releaseSha === "string" &&
    releaseSha.length === 40 &&
    typeof bundleSha === "string" &&
    bundleSha.length === 64 &&
    json.status === "ok" &&
    json.source_sha === releaseSha &&
    json.bundle_sha256 === bundleSha &&
    (treeSha === undefined || json.source_tree === treeSha) &&
    (version === undefined || json.version === version) &&
    (imageRef === undefined || json.image_ref === imageRef)
  );
}

async function readBody(response) {
  const text = await response.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    // Respuesta no-JSON (por ejemplo un 502/503 con HTML de error de
    // Cloudflare): igual queda registrada como "última respuesta" para el
    // mensaje de error final.
    return { status: response.status, statusText: response.statusText, raw: text };
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sondea `url` hasta que la procedencia coincide o se agota `budgetMs`.
 * Un 5xx persistente no falla de inmediato: es sólo una respuesta más que no
 * coincide, y se reintenta igual que un 200 con datos viejos. Si el
 * presupuesto completo se agota recibiendo sólo 5xx, el resultado es el mismo
 * fallo que cualquier otro agotamiento de presupuesto, con el último cuerpo
 * visto (JSON.parse fallido incluido) en el mensaje.
 */
export async function pollRuntimeProvenance({
  url,
  releaseSha,
  bundleSha,
  treeSha,
  version,
  imageRef,
  budgetMs = DEFAULT_BUDGET_MS,
  intervalMs = DEFAULT_INTERVAL_MS,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
  now = Date.now,
}) {
  const expected = { treeSha, version, imageRef };
  assertValidProvenanceInputs(releaseSha, bundleSha, expected);

  const deadline = now() + budgetMs;
  let lastBody = null;
  let attempts = 0;

  for (;;) {
    attempts += 1;
    try {
      const response = await fetchImpl(url);
      lastBody = await readBody(response);
    } catch (error) {
      lastBody = { error: String(error?.message ?? error) };
    }

    if (isProvenanceMatch(lastBody, releaseSha, bundleSha, expected)) {
      return { body: lastBody, attempts };
    }

    if (now() >= deadline) {
      throw new RuntimeProvenanceError(
        `runtime provenance: ${url} no coincidió con release_sha=${releaseSha} ` +
          `bundle_sha256=${bundleSha} tras agotar el presupuesto de ${budgetMs}ms ` +
          `(${attempts} intento(s)). Última respuesta: ${JSON.stringify(lastBody)}`,
        lastBody,
      );
    }

    await sleepImpl(intervalMs);
  }
}

function requireEnv(name, pattern) {
  const value = process.env[name];
  if (!value) throw new Error(`falta la variable de entorno ${name}`);
  if (pattern && !pattern.test(value)) {
    throw new Error(`${name} inválido: "${value}" no matchea ${pattern}`);
  }
  return value;
}

// Un valor no numérico (o <= 0) en el env dejaría `budgetMs`/`intervalMs` en
// NaN: `now() >= deadline` nunca es true con NaN, así que el bucle no
// terminaría nunca. Con esto cualquier valor inválido cae al default.
export const asMs = (raw, def) => {
  const n = Number(raw ?? def);
  return Number.isFinite(n) && n > 0 ? n : def;
};

async function main() {
  const releaseSha = requireEnv("RELEASE_SHA", RELEASE_SHA_PATTERN);
  const bundleSha = requireEnv("BUNDLE_SHA256", BUNDLE_SHA256_PATTERN);
  const url = process.env.RUNTIME_RELEASE_URL ?? DEFAULT_RUNTIME_RELEASE_URL;
  const budgetMs = asMs(process.env.RUNTIME_RELEASE_BUDGET_MS, DEFAULT_BUDGET_MS);
  const intervalMs = asMs(process.env.RUNTIME_RELEASE_INTERVAL_MS, DEFAULT_INTERVAL_MS);
  const outputPath = process.env.RUNTIME_RELEASE_OUTPUT ?? "runtime-release.json";

  try {
    const { body, attempts } = await pollRuntimeProvenance({
      url,
      releaseSha,
      bundleSha,
      budgetMs,
      intervalMs,
    });
    await writeFile(outputPath, JSON.stringify(body, null, 2) + "\n");
    console.log(`runtime provenance PASS tras ${attempts} intento(s): ${JSON.stringify(body)}`);
  } catch (error) {
    if (error instanceof RuntimeProvenanceError) {
      await writeFile(outputPath, JSON.stringify(error.lastBody, null, 2) + "\n");
    }
    console.error(error.message);
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
