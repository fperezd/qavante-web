import { describe, expect, it } from "vitest";
import { aggregateSyncStatus, type SourceStatus } from "./sources-status";

const src = (over: Partial<SourceStatus>): SourceStatus => ({
  source: "sii",
  state: "ok",
  ...over,
});

describe("aggregateSyncStatus", () => {
  it("todas ok → level ok, última sync = la más reciente", () => {
    const r = aggregateSyncStatus([
      src({ source: "sii", last_sync: "2026-06-25T10:00:00Z" }),
      src({ source: "bice", last_sync: "2026-06-25T12:30:00Z" }),
    ]);
    expect(r.level).toBe("ok");
    expect(r.lastSync).toBe("2026-06-25T12:30:00Z");
    expect(r.problemCount).toBe(0);
  });

  it("una stale → warning", () => {
    const r = aggregateSyncStatus([src({ state: "ok" }), src({ source: "tgr", state: "stale" })]);
    expect(r.level).toBe("warning");
    expect(r.problemCount).toBe(1);
  });

  it("error gana sobre stale", () => {
    const r = aggregateSyncStatus([
      src({ state: "stale" }),
      src({ source: "bice", state: "error" }),
    ]);
    expect(r.level).toBe("error");
    expect(r.problemCount).toBe(2);
  });

  it("lista vacía → ok sin última sync", () => {
    const r = aggregateSyncStatus([]);
    expect(r.level).toBe("ok");
    expect(r.lastSync).toBeNull();
    expect(r.problemCount).toBe(0);
  });
});
