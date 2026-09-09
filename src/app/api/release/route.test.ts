import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, getReleaseMetadata } from "./route";

describe("release metadata", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("publica sólo procedencia completa y validada", () => {
    expect(
      getReleaseMetadata({
        QAVANTE_RELEASE_SHA: "a".repeat(40),
        QAVANTE_RELEASE_BUNDLE_SHA256: "b".repeat(64),
      }),
    ).toEqual({
      complete: true,
      sourceSha: "a".repeat(40),
      bundleSha256: "b".repeat(64),
    });
  });

  it.each([
    [{}, null, null],
    [{ QAVANTE_RELEASE_SHA: "a".repeat(39) }, "a".repeat(39), null],
    [
      { QAVANTE_RELEASE_SHA: "a".repeat(40), QAVANTE_RELEASE_BUNDLE_SHA256: "not-a-digest" },
      "a".repeat(40),
      "not-a-digest",
    ],
  ])("degrada a no disponible sin inventar procedencia", (env, sourceSha, bundleSha256) => {
    expect(getReleaseMetadata(env)).toEqual({ complete: false, sourceSha, bundleSha256 });
  });

  it("responde 503 y no-cache cuando la procedencia no está configurada", async () => {
    vi.stubEnv("QAVANTE_RELEASE_SHA", "unreleased");
    vi.stubEnv("QAVANTE_RELEASE_BUNDLE_SHA256", "unreleased");

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({
      status: "unavailable",
      source_sha: null,
      bundle_sha256: null,
    });
  });

  it("expone los identificadores exactos que el release inyectó", async () => {
    vi.stubEnv("QAVANTE_RELEASE_SHA", "a".repeat(40));
    vi.stubEnv("QAVANTE_RELEASE_BUNDLE_SHA256", "b".repeat(64));

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      source_sha: "a".repeat(40),
      bundle_sha256: "b".repeat(64),
    });
  });
});
