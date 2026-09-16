import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertValidProvenanceInputs,
  asMs,
  DEFAULT_BUDGET_MS,
  isProvenanceMatch,
  pollRuntimeProvenance,
  RuntimeProvenanceError,
} from "./verify-runtime.mjs";

const RELEASE_SHA = "a".repeat(40);
const BUNDLE_SHA = "b".repeat(64);
const OLD_BODY = { status: "ok", source_sha: "c".repeat(40), bundle_sha256: "d".repeat(64) };
const MATCH_BODY = { status: "ok", source_sha: RELEASE_SHA, bundle_sha256: BUNDLE_SHA };

const jsonResponse = (body, status = 200) => ({
  status,
  statusText: status === 200 ? "OK" : "Error",
  text: async () => JSON.stringify(body),
});

const errorResponse = (status) => ({
  status,
  statusText: "Service Unavailable",
  text: async () => "<html>upstream error</html>",
});

// Reloj falso: cada sleepImpl "consume" intervalMs de presupuesto sin esperar
// de verdad, para no dejar la suite real de tests colgada 120s.
function fakeClock(startMs = 0) {
  let current = startMs;
  return {
    now: () => current,
    sleepImpl: async (ms) => {
      current += ms;
    },
  };
}

test("isProvenanceMatch: exige status ok + ambos SHA", () => {
  assert.equal(isProvenanceMatch(MATCH_BODY, RELEASE_SHA, BUNDLE_SHA), true);
  assert.equal(isProvenanceMatch(OLD_BODY, RELEASE_SHA, BUNDLE_SHA), false);
  assert.equal(
    isProvenanceMatch({ ...MATCH_BODY, status: "error" }, RELEASE_SHA, BUNDLE_SHA),
    false,
  );
  assert.equal(
    isProvenanceMatch({ ...MATCH_BODY, bundle_sha256: "otro" }, RELEASE_SHA, BUNDLE_SHA),
    false,
  );
  assert.equal(isProvenanceMatch(null, RELEASE_SHA, BUNDLE_SHA), false);
  assert.equal(isProvenanceMatch(undefined, RELEASE_SHA, BUNDLE_SHA), false);
});

test("isProvenanceMatch: un prefijo compartido no cuenta como coincidencia (mata la mutación de comparar por prefijo)", () => {
  const partialSourceSha = RELEASE_SHA.slice(0, 7) + "z".repeat(33);
  assert.equal(
    isProvenanceMatch({ ...MATCH_BODY, source_sha: partialSourceSha }, RELEASE_SHA, BUNDLE_SHA),
    false,
  );
  const partialBundleSha = BUNDLE_SHA.slice(0, 7) + "z".repeat(57);
  assert.equal(
    isProvenanceMatch({ ...MATCH_BODY, bundle_sha256: partialBundleSha }, RELEASE_SHA, BUNDLE_SHA),
    false,
  );
});

test("isProvenanceMatch: releaseSha/bundleSha inválidos (undefined, largo incorrecto) nunca coinciden", () => {
  assert.equal(isProvenanceMatch(MATCH_BODY, undefined, undefined), false);
  assert.equal(
    isProvenanceMatch(
      { status: "ok", source_sha: undefined, bundle_sha256: undefined },
      undefined,
      undefined,
    ),
    false,
  );
  assert.equal(isProvenanceMatch(MATCH_BODY, RELEASE_SHA.slice(0, 39), BUNDLE_SHA), false);
  assert.equal(isProvenanceMatch(MATCH_BODY, RELEASE_SHA, BUNDLE_SHA.slice(0, 63)), false);
});

test("asMs: valor no numérico o <= 0 cae al default", () => {
  assert.equal(asMs("abc", DEFAULT_BUDGET_MS), DEFAULT_BUDGET_MS);
  assert.equal(asMs(undefined, DEFAULT_BUDGET_MS), DEFAULT_BUDGET_MS);
  assert.equal(asMs("0", DEFAULT_BUDGET_MS), DEFAULT_BUDGET_MS);
  assert.equal(asMs("-5", DEFAULT_BUDGET_MS), DEFAULT_BUDGET_MS);
  assert.equal(asMs("NaN", DEFAULT_BUDGET_MS), DEFAULT_BUDGET_MS);
  assert.equal(asMs("60000", DEFAULT_BUDGET_MS), 60_000);
});

test("assertValidProvenanceInputs: SHA bien formados no lanzan", () => {
  assert.doesNotThrow(() => assertValidProvenanceInputs(RELEASE_SHA, BUNDLE_SHA));
});

test("assertValidProvenanceInputs: RELEASE_SHA de 39 caracteres lanza de inmediato", () => {
  assert.throws(
    () => assertValidProvenanceInputs(RELEASE_SHA.slice(0, 39), BUNDLE_SHA),
    (error) => {
      assert.ok(error instanceof RuntimeProvenanceError);
      assert.match(error.message, /RELEASE_SHA inválido/);
      return true;
    },
  );
});

test("assertValidProvenanceInputs: BUNDLE_SHA256 de 63 caracteres lanza de inmediato", () => {
  assert.throws(
    () => assertValidProvenanceInputs(RELEASE_SHA, BUNDLE_SHA.slice(0, 63)),
    (error) => {
      assert.ok(error instanceof RuntimeProvenanceError);
      assert.match(error.message, /BUNDLE_SHA256 inválido/);
      return true;
    },
  );
});

test("assertValidProvenanceInputs: mayúsculas o caracteres no hex también lanzan", () => {
  assert.throws(() => assertValidProvenanceInputs(RELEASE_SHA.toUpperCase(), BUNDLE_SHA));
  assert.throws(() => assertValidProvenanceInputs("g".repeat(40), BUNDLE_SHA));
});

test("pollRuntimeProvenance: RELEASE_SHA de 39 caracteres aborta en el intento 0, sin llamar a fetch", async () => {
  const { now, sleepImpl } = fakeClock();
  let calls = 0;
  await assert.rejects(
    () =>
      pollRuntimeProvenance({
        url: "https://app.qavante.com/api/release",
        releaseSha: RELEASE_SHA.slice(0, 39),
        bundleSha: BUNDLE_SHA,
        fetchImpl: async () => {
          calls += 1;
          return jsonResponse(MATCH_BODY);
        },
        now,
        sleepImpl,
      }),
    (error) => {
      assert.ok(error instanceof RuntimeProvenanceError);
      assert.match(error.message, /RELEASE_SHA inválido/);
      return true;
    },
  );
  assert.equal(calls, 0, "no debe haber consultado /api/release con un SHA malformado");
});

test("pollRuntimeProvenance: BUNDLE_SHA256 de 63 caracteres aborta en el intento 0, sin llamar a fetch", async () => {
  const { now, sleepImpl } = fakeClock();
  let calls = 0;
  await assert.rejects(
    () =>
      pollRuntimeProvenance({
        url: "https://app.qavante.com/api/release",
        releaseSha: RELEASE_SHA,
        bundleSha: BUNDLE_SHA.slice(0, 63),
        fetchImpl: async () => {
          calls += 1;
          return jsonResponse(MATCH_BODY);
        },
        now,
        sleepImpl,
      }),
    (error) => {
      assert.ok(error instanceof RuntimeProvenanceError);
      assert.match(error.message, /BUNDLE_SHA256 inválido/);
      return true;
    },
  );
  assert.equal(calls, 0, "no debe haber consultado /api/release con un bundle_sha256 malformado");
});

test("pollRuntimeProvenance: coincide a la primera respuesta", async () => {
  const { now, sleepImpl } = fakeClock();
  let calls = 0;
  const result = await pollRuntimeProvenance({
    url: "https://app.qavante.com/api/release",
    releaseSha: RELEASE_SHA,
    bundleSha: BUNDLE_SHA,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse(MATCH_BODY);
    },
    now,
    sleepImpl,
  });
  assert.equal(calls, 1);
  assert.equal(result.attempts, 1);
  assert.deepEqual(result.body, MATCH_BODY);
});

test("pollRuntimeProvenance: coincide en el tercer intento tras dos respuestas viejas", async () => {
  const { now, sleepImpl } = fakeClock();
  let calls = 0;
  const result = await pollRuntimeProvenance({
    url: "https://app.qavante.com/api/release",
    releaseSha: RELEASE_SHA,
    bundleSha: BUNDLE_SHA,
    fetchImpl: async () => {
      calls += 1;
      if (calls < 3) return jsonResponse(OLD_BODY);
      return jsonResponse(MATCH_BODY);
    },
    now,
    sleepImpl,
  });
  assert.equal(calls, 3);
  assert.equal(result.attempts, 3);
  assert.deepEqual(result.body, MATCH_BODY);
});

test("pollRuntimeProvenance: nunca coincide -> error con el último cuerpo tras agotar el presupuesto", async () => {
  const { now, sleepImpl } = fakeClock();
  let calls = 0;
  const bodies = [];
  await assert.rejects(
    () =>
      pollRuntimeProvenance({
        url: "https://app.qavante.com/api/release",
        releaseSha: RELEASE_SHA,
        bundleSha: BUNDLE_SHA,
        budgetMs: 20_000,
        intervalMs: 5_000,
        fetchImpl: async () => {
          calls += 1;
          const body = {
            status: "ok",
            source_sha: `stale-${calls}`.padEnd(40, "0"),
            bundle_sha256: BUNDLE_SHA,
          };
          bodies.push(body);
          return jsonResponse(body);
        },
        now,
        sleepImpl,
      }),
    (error) => {
      assert.ok(error instanceof RuntimeProvenanceError);
      assert.deepEqual(error.lastBody, bodies.at(-1));
      assert.match(error.message, /agotar el presupuesto/);
      return true;
    },
  );
  // 20s de presupuesto / 5s de intervalo: intento inicial + 4 reintentos.
  assert.equal(calls, 5);
});

test("pollRuntimeProvenance: 5xx reintenta en vez de fallar de inmediato", async () => {
  const { now, sleepImpl } = fakeClock();
  let calls = 0;
  const result = await pollRuntimeProvenance({
    url: "https://app.qavante.com/api/release",
    releaseSha: RELEASE_SHA,
    bundleSha: BUNDLE_SHA,
    budgetMs: 20_000,
    intervalMs: 5_000,
    fetchImpl: async () => {
      calls += 1;
      if (calls <= 2) return errorResponse(503);
      return jsonResponse(MATCH_BODY);
    },
    now,
    sleepImpl,
  });
  assert.equal(calls, 3);
  assert.equal(result.attempts, 3);
  assert.deepEqual(result.body, MATCH_BODY);
});

test("pollRuntimeProvenance: 5xx persistente agota el presupuesto y falla con el último cuerpo", async () => {
  const { now, sleepImpl } = fakeClock();
  let calls = 0;
  await assert.rejects(
    () =>
      pollRuntimeProvenance({
        url: "https://app.qavante.com/api/release",
        releaseSha: RELEASE_SHA,
        bundleSha: BUNDLE_SHA,
        budgetMs: 10_000,
        intervalMs: 5_000,
        fetchImpl: async () => {
          calls += 1;
          return errorResponse(503);
        },
        now,
        sleepImpl,
      }),
    (error) => {
      assert.ok(error instanceof RuntimeProvenanceError);
      assert.equal(error.lastBody.status, 503);
      return true;
    },
  );
  // 10s de presupuesto / 5s de intervalo: intento inicial + 2 reintentos.
  assert.equal(calls, 3);
});

console.log("verify-runtime: sondeo de procedencia OK");
