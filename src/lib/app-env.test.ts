import { afterEach, describe, expect, it, vi } from "vitest";
import { isLocalDevAppEnv } from "./app-env";

describe("isLocalDevAppEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("es true en development y cuando no hay valor (default local)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "development");
    expect(isLocalDevAppEnv()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "");
    expect(isLocalDevAppEnv()).toBe(true);
  });

  it("es false en staging, qas y production", () => {
    for (const env of ["staging", "qas", "production", "PRODUCTION"]) {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", env);
      expect(isLocalDevAppEnv()).toBe(false);
    }
  });
});
