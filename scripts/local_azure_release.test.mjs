import { describe, expect, it } from "vitest";
import { activeImage, verifyCandidateStatus } from "./local_azure_release.mjs";

const image = "acrqavanteprod.azurecr.io/qavante-web:prod-abc";
const state = (traffic = [{ latestRevision: true, weight: 100 }], mode = "Single") => ({
  properties: {
    configuration: { activeRevisionsMode: mode, ingress: { traffic } },
    template: { containers: [{ image }] },
  },
});

describe("local Azure release", () => {
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
});
