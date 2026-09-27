import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getReleaseMetadata } from "@/lib/release-metadata";

describe("release metadata", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("publica sólo procedencia completa y validada", () => {
    expect(
      getReleaseMetadata({
        QAVANTE_RELEASE_SHA: "a".repeat(40),
        QAVANTE_RELEASE_TREE_SHA: "c".repeat(40),
        QAVANTE_RELEASE_BUNDLE_SHA256: "b".repeat(64),
        QAVANTE_RELEASE_VERSION: "0.1.0",
        QAVANTE_RELEASE_IMAGE_REF: `acrqavanteprod.azurecr.io/qavante-web@sha256:${"d".repeat(64)}`,
      }),
    ).toEqual({
      complete: true,
      sourceSha: "a".repeat(40),
      sourceTree: "c".repeat(40),
      bundleSha256: "b".repeat(64),
      version: "0.1.0",
      imageRef: `acrqavanteprod.azurecr.io/qavante-web@sha256:${"d".repeat(64)}`,
    });
  });

  it.each([
    [{}, null, null, null, null, null],
    [{ QAVANTE_RELEASE_SHA: "a".repeat(39) }, "a".repeat(39), null, null, null, null],
    [
      { QAVANTE_RELEASE_SHA: "a".repeat(40), QAVANTE_RELEASE_BUNDLE_SHA256: "not-a-digest" },
      "a".repeat(40),
      null,
      "not-a-digest",
      null,
      null,
    ],
  ])(
    "degrada a no disponible sin inventar procedencia",
    (env, sourceSha, sourceTree, bundleSha256, version, imageRef) => {
      expect(getReleaseMetadata(env)).toEqual({
        complete: false,
        sourceSha,
        sourceTree,
        bundleSha256,
        version,
        imageRef,
      });
    },
  );

  it("responde 503 y no-cache cuando la procedencia no está configurada", async () => {
    vi.stubEnv("QAVANTE_RELEASE_SHA", "unreleased");
    vi.stubEnv("QAVANTE_RELEASE_TREE_SHA", "unreleased");
    vi.stubEnv("QAVANTE_RELEASE_BUNDLE_SHA256", "unreleased");
    vi.stubEnv("QAVANTE_RELEASE_VERSION", "unreleased");
    vi.stubEnv("QAVANTE_RELEASE_IMAGE_REF", "unreleased");

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({
      status: "unavailable",
      provenance_schema_version: 2,
      source_sha: null,
      source_tree: null,
      bundle_sha256: null,
      version: null,
      image_ref: null,
    });
  });

  it("expone los identificadores exactos que el release inyectó", async () => {
    vi.stubEnv("QAVANTE_RELEASE_SHA", "a".repeat(40));
    vi.stubEnv("QAVANTE_RELEASE_TREE_SHA", "c".repeat(40));
    vi.stubEnv("QAVANTE_RELEASE_BUNDLE_SHA256", "b".repeat(64));
    vi.stubEnv("QAVANTE_RELEASE_VERSION", "0.1.0");
    vi.stubEnv(
      "QAVANTE_RELEASE_IMAGE_REF",
      `acrqavanteprod.azurecr.io/qavante-web@sha256:${"d".repeat(64)}`,
    );

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      provenance_schema_version: 2,
      source_sha: "a".repeat(40),
      source_tree: "c".repeat(40),
      bundle_sha256: "b".repeat(64),
      version: "0.1.0",
      image_ref: `acrqavanteprod.azurecr.io/qavante-web@sha256:${"d".repeat(64)}`,
    });
  });
});
