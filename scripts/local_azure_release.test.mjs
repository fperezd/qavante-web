import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  activeImage,
  assertBakedWebImage,
  azureWebRuntimeReadiness,
  isRollbackRuntimeMatch,
  releaseCredentialNames,
  releaseEnvironment,
  requireReleaseCredentials,
  rollbackReleaseEnvironment,
  rollbackUpdateArguments,
  verifyCandidateStatus,
  verifySignatureForDigest,
} from "./local_azure_release.mjs";

const image = "acrqavanteprod.azurecr.io/qavante-web:prod-abc";
const state = (traffic = [{ latestRevision: true, weight: 100 }], mode = "Single") => ({
  properties: {
    configuration: { activeRevisionsMode: mode, ingress: { traffic } },
    template: { containers: [{ image }] },
  },
});

describe("local Azure release", () => {
  it("blocks the legacy local CLI by default", () => {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("./local_azure_release.mjs", import.meta.url)), "prepare"],
      {
        encoding: "utf8",
        env: { ...process.env, QAVANTE_ENABLE_LEGACY_LOCAL_RELEASE: "" },
      },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/release local desactivado; usar Deploy web to Azure PROD/);
  });

  it("requires a single revision serving all production traffic", () => {
    expect(activeImage(state())).toBe(image);
    expect(() => activeImage(state([{ weight: 80 }, { weight: 20 }]))).toThrow(/single 100%/);
    expect(() => activeImage(state([{ weight: 100 }], "Multiple"))).toThrow(/single 100%/);
  });

  it("rejects an image outside the production registry", () => {
    const other = state();
    other.properties.template.containers[0].image = "example.com/other:prod";
    expect(() => activeImage(other)).toThrow(/single 100%/);
  });

  it("requires the latest candidate status to match the source digest and actor", () => {
    const digest = "a".repeat(64);
    const first = {
      id: 1,
      context: "local-release-candidate",
      state: "success",
      creator: { login: "fperezd" },
      description: `source-sha256:${digest}`,
      created_at: "2026-09-22T01:00:00Z",
    };
    expect(verifyCandidateStatus([first], "fperezd", digest)).toBe(1);
    expect(() =>
      verifyCandidateStatus(
        [first, { ...first, id: 2, state: "failure", created_at: "2026-09-22T02:00:00Z" }],
        "fperezd",
        digest,
      ),
    ).toThrow(/matching/);
    expect(() => verifyCandidateStatus([first], "other", digest)).toThrow(/matching/);
  });

  it("injects only complete immutable provenance into the Container App revision", () => {
    const environment = releaseEnvironment({
      releaseSha: "a".repeat(40),
      releaseTree: "b".repeat(40),
      sourceDigest: "c".repeat(64),
      version: "0.1.0",
      imageRef: `acrqavanteprod.azurecr.io/qavante-web@sha256:${"d".repeat(64)}`,
    });
    expect(environment).toEqual([
      `QAVANTE_RELEASE_SHA=${"a".repeat(40)}`,
      `QAVANTE_RELEASE_TREE_SHA=${"b".repeat(40)}`,
      `QAVANTE_RELEASE_BUNDLE_SHA256=${"c".repeat(64)}`,
      "QAVANTE_RELEASE_VERSION=0.1.0",
      `QAVANTE_RELEASE_IMAGE_REF=acrqavanteprod.azurecr.io/qavante-web@sha256:${"d".repeat(64)}`,
    ]);
    expect(() =>
      releaseEnvironment({
        releaseSha: "a".repeat(40),
        releaseTree: "b".repeat(40),
        sourceDigest: "c".repeat(64),
        version: "0.1.0",
        imageRef: "acrqavanteprod.azurecr.io/qavante-web:mutable-tag",
      }),
    ).toThrow(/immutable image/);
  });

  it("restores prior provenance or explicitly removes values that were absent", () => {
    const before = state();
    before.properties.template.containers[0].env = [
      { name: "QAVANTE_RELEASE_SHA", value: "a".repeat(40) },
      { name: "QAVANTE_RELEASE_TREE_SHA", value: "b".repeat(40) },
      { name: "QAVANTE_RELEASE_BUNDLE_SHA256", value: "c".repeat(64) },
      { name: "QAVANTE_RELEASE_VERSION", value: "0.1.0" },
      { name: "SOME_OTHER_FLAG", value: "true" },
    ];
    expect(rollbackReleaseEnvironment(before)).toEqual({
      set: [
        `QAVANTE_RELEASE_SHA=${"a".repeat(40)}`,
        `QAVANTE_RELEASE_TREE_SHA=${"b".repeat(40)}`,
        `QAVANTE_RELEASE_BUNDLE_SHA256=${"c".repeat(64)}`,
        "QAVANTE_RELEASE_VERSION=0.1.0",
      ],
      remove: ["QAVANTE_RELEASE_IMAGE_REF"],
    });
    expect(
      rollbackUpdateArguments(
        before,
        `acrqavanteprod.azurecr.io/qavante-web@sha256:${"d".repeat(64)}`,
      ),
    ).toEqual(
      expect.arrayContaining([
        "--set-env-vars",
        `QAVANTE_RELEASE_SHA=${"a".repeat(40)}`,
        "--remove-env-vars",
        "QAVANTE_RELEASE_IMAGE_REF",
      ]),
    );
  });

  it("verifies rollback against the previous runtime identity, never the failed release", () => {
    const rollbackImage = `acrqavanteprod.azurecr.io/qavante-web@sha256:${"d".repeat(64)}`;
    const before = state();
    before.properties.template.containers[0].env = [
      { name: "QAVANTE_RELEASE_SHA", value: "a".repeat(40) },
      { name: "QAVANTE_RELEASE_TREE_SHA", value: "b".repeat(40) },
      { name: "QAVANTE_RELEASE_BUNDLE_SHA256", value: "c".repeat(64) },
      { name: "QAVANTE_RELEASE_VERSION", value: "0.1.0" },
      { name: "QAVANTE_RELEASE_IMAGE_REF", value: rollbackImage },
    ];
    const oldRuntime = {
      status: "ok",
      source_sha: "a".repeat(40),
      source_tree: "b".repeat(40),
      bundle_sha256: "c".repeat(64),
      version: "0.1.0",
      image_ref: rollbackImage,
    };
    expect(isRollbackRuntimeMatch(oldRuntime, before, rollbackImage)).toBe(true);
    expect(
      isRollbackRuntimeMatch(
        {
          ...oldRuntime,
          image_ref: `acrqavanteprod.azurecr.io/qavante-web@sha256:${"e".repeat(64)}`,
        },
        before,
        rollbackImage,
      ),
    ).toBe(false);
    const partialPriorProvenance = state();
    partialPriorProvenance.properties.template.containers[0].env = [
      { name: "QAVANTE_RELEASE_SHA", value: "a".repeat(40) },
    ];
    expect(
      isRollbackRuntimeMatch(
        { status: "unavailable", source_sha: null, bundle_sha256: null },
        partialPriorProvenance,
        rollbackImage,
      ),
    ).toBe(false);
    const noPriorProvenance = state();
    noPriorProvenance.properties.template.containers[0].env = [];
    expect(
      isRollbackRuntimeMatch(
        {
          status: "unavailable",
          source_sha: null,
          source_tree: null,
          bundle_sha256: null,
          version: null,
          image_ref: null,
        },
        noPriorProvenance,
        rollbackImage,
      ),
    ).toBe(true);
    // Contrato realmente desplegado antes de la provenance v2: los tres
    // campos nuevos no existían. No se acepta ningún valor no nulo.
    expect(
      isRollbackRuntimeMatch(
        { status: "unavailable", source_sha: null, bundle_sha256: null },
        noPriorProvenance,
        rollbackImage,
      ),
    ).toBe(true);
    expect(
      isRollbackRuntimeMatch(
        {
          status: "unavailable",
          source_sha: null,
          bundle_sha256: null,
          source_tree: "unexpected",
        },
        noPriorProvenance,
        rollbackImage,
      ),
    ).toBe(false);
  });
});

describe("local Azure release signing and preflight parity with the API", () => {
  const digest = `sha256:${"d".repeat(64)}`;
  const identity = {
    releaseSha: "a".repeat(40),
    releaseTree: "b".repeat(40),
    sourceDigest: "c".repeat(64),
    version: "0.1.0",
  };
  const bakedEnvironment = (overrides = {}) =>
    Object.entries({
      PATH: "/usr/local/bin",
      NEXT_PUBLIC_API_URL: "https://api.qavante.com",
      NEXT_PUBLIC_APP_ENV: "prod",
      QAVANTE_RELEASE_SHA: identity.releaseSha,
      QAVANTE_RELEASE_TREE_SHA: identity.releaseTree,
      QAVANTE_RELEASE_BUNDLE_SHA256: identity.sourceDigest,
      QAVANTE_RELEASE_VERSION: identity.version,
      QAVANTE_RELEASE_IMAGE_REF: "unreleased",
      ...overrides,
    })
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => `${name}=${value}`);

  it("requires smoke and Cosign material before touching Azure, naming only what is missing", () => {
    const complete = {
      SMOKE_RUT: "rut",
      SMOKE_PASSWORD: "password",
      COSIGN_KEY: "cosign.key",
      COSIGN_PUBLIC_KEY: "cosign.pub",
      COSIGN_PASSWORD: "secret-pass",
    };
    expect(releaseCredentialNames).toEqual(Object.keys(complete));
    expect(() => requireReleaseCredentials(complete)).not.toThrow();
    for (const name of Object.keys(complete)) {
      const missing = { ...complete, [name]: "" };
      expect(() => requireReleaseCredentials(missing)).toThrow(new RegExp(`required: ${name}$`));
    }
    let message = "";
    try {
      requireReleaseCredentials({ ...complete, COSIGN_KEY: undefined });
    } catch (error) {
      message = String(error);
    }
    expect(message).not.toContain("secret-pass");
  });

  it("accepts Cosign evidence only for the exact promoted digest", () => {
    const evidence = [{ critical: { image: { "docker-manifest-digest": digest } } }];
    expect(() => verifySignatureForDigest(evidence, digest)).not.toThrow();
    expect(() => verifySignatureForDigest(evidence, `sha256:${"e".repeat(64)}`)).toThrow(
      /does not attest/,
    );
    expect(() => verifySignatureForDigest([], digest)).toThrow(/does not attest/);
    expect(() => verifySignatureForDigest({}, digest)).toThrow(/no usable evidence/);
    expect(() => verifySignatureForDigest(evidence, "prod-mutable-tag")).toThrow(
      /no usable evidence/,
    );
  });

  it("requires the image to bake the canonical API domain and the exact source identity", () => {
    expect(assertBakedWebImage(bakedEnvironment(), identity)).toBe(true);
    expect(() =>
      assertBakedWebImage(
        bakedEnvironment({
          NEXT_PUBLIC_API_URL: "https://ca-qavante-api-prod.x.eastus2.azurecontainerapps.io",
        }),
        identity,
      ),
    ).toThrow(
      /NEXT_PUBLIC_API_URL .*observed host ca-qavante-api-prod\.x\.eastus2\.azurecontainerapps\.io/,
    );
    expect(() =>
      assertBakedWebImage(bakedEnvironment({ NEXT_PUBLIC_API_URL: undefined }), identity),
    ).toThrow(/NEXT_PUBLIC_API_URL/);
    expect(() =>
      assertBakedWebImage(bakedEnvironment({ NEXT_PUBLIC_APP_ENV: "qas" }), identity),
    ).toThrow(/NEXT_PUBLIC_APP_ENV/);
    for (const name of [
      "QAVANTE_RELEASE_SHA",
      "QAVANTE_RELEASE_TREE_SHA",
      "QAVANTE_RELEASE_BUNDLE_SHA256",
      "QAVANTE_RELEASE_VERSION",
    ]) {
      expect(() =>
        assertBakedWebImage(bakedEnvironment({ [name]: "unreleased" }), identity),
      ).toThrow(new RegExp(name));
    }
    expect(() => assertBakedWebImage(null, identity)).toThrow(/no environment/);
  });

  it("rejects Container Apps hosts and non-canonical API URLs in the web runtime", () => {
    const runtime = (env) => {
      const current = state();
      current.properties.template.containers[0].env = env;
      return current;
    };
    expect(azureWebRuntimeReadiness(runtime([{ name: "SOME_FLAG", value: "true" }]))).toBe(true);
    expect(
      azureWebRuntimeReadiness(
        runtime([{ name: "NEXT_PUBLIC_API_URL", value: "https://api.qavante.com" }]),
      ),
    ).toBe(true);
    expect(() =>
      azureWebRuntimeReadiness(
        runtime([{ name: "NEXT_PUBLIC_API_URL", value: "https://api-qas.qavante.com" }]),
      ),
    ).toThrow(/must be exactly https:\/\/api\.qavante\.com/);
    expect(() =>
      azureWebRuntimeReadiness(
        runtime([
          {
            name: "BACKEND_URL",
            value: "https://ca-qavante-api-prod.x.eastus2.azurecontainerapps.io/api",
          },
        ]),
      ),
    ).toThrow(/BACKEND_URL points at a Container Apps host/);
    expect(() => azureWebRuntimeReadiness(state())).toThrow(/no container environment/);
  });

  it("signs and verifies the digest before Azure can activate it, and binds the receipt", () => {
    const source = readFileSync(new URL("./local_azure_release.mjs", import.meta.url), "utf8");
    const promote = source.slice(source.indexOf("async function promote("));
    const credentials = promote.indexOf("requireReleaseCredentials(process.env)");
    const azureRead = promote.indexOf("const before = azureState();");
    const readiness = promote.indexOf("azureWebRuntimeReadiness(before)");
    const baked = promote.indexOf("assertBakedWebImage(imageEnvironment(manifest.image_tag)");
    const push = promote.indexOf('run("docker", ["push", manifest.image_tag]);');
    const sign = promote.indexOf(
      'run("cosign", ["sign", "--yes", "--key", process.env.COSIGN_KEY, releaseImage]);',
    );
    const verify = promote.indexOf("verifySignatureForDigest(signature, digest);");
    const update = promote.indexOf("promotionStarted = true;");
    const receipt = promote.indexOf('save(path.join(directory, "production-receipt.json")');
    expect(credentials).toBeGreaterThan(0);
    expect(credentials).toBeLessThan(azureRead);
    expect(readiness).toBeGreaterThan(azureRead);
    expect(readiness).toBeLessThan(push);
    expect(baked).toBeGreaterThan(0);
    expect(baked).toBeLessThan(push);
    expect(sign).toBeGreaterThan(push);
    expect(verify).toBeGreaterThan(sign);
    expect(update).toBeGreaterThan(verify);
    expect(promote).toMatch(
      /signature_verification_sha256: sha256\(path\.join\(attempt, "signature-verification\.json"\)\)/,
    );
    expect(receipt).toBeGreaterThan(update);
    const prepare = source.slice(
      source.indexOf("async function prepare("),
      source.indexOf("async function promote("),
    );
    expect(prepare).toContain("assertBakedWebImage(imageEnvironment(taggedImage)");
    expect(prepare.indexOf("assertBakedWebImage")).toBeLessThan(
      prepare.indexOf("context=${candidateContext}"),
    );
  });
});
