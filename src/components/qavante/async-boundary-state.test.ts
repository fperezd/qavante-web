import { describe, it, expect } from "vitest";
import { resolveAsyncState } from "./async-boundary-state";

describe("resolveAsyncState", () => {
  const base = { isLoading: false, isError: false, data: undefined };

  it("loading gana sobre todo", () => {
    expect(resolveAsyncState({ isLoading: true, isError: true, data: 1 })).toBe("loading");
  });

  it("error antes que data", () => {
    expect(resolveAsyncState({ ...base, isError: true, data: 1 })).toBe("error");
  });

  it("data undefined → nodata", () => {
    expect(resolveAsyncState(base)).toBe("nodata");
  });

  it("data presente sin isEmpty → ready", () => {
    expect(resolveAsyncState({ ...base, data: { items: [1] } })).toBe("ready");
  });

  it("isEmpty true → empty", () => {
    expect(resolveAsyncState({ ...base, data: { items: [] } }, (d) => d.items.length === 0)).toBe(
      "empty",
    );
  });

  it("isEmpty false → ready", () => {
    expect(resolveAsyncState({ ...base, data: { items: [1] } }, (d) => d.items.length === 0)).toBe(
      "ready",
    );
  });

  it("data puede ser falsy legítimo (0) sin caer en nodata", () => {
    expect(resolveAsyncState({ ...base, data: 0 })).toBe("ready");
  });
});
