import { describe, expect, it } from "vitest";
import { monthValue, startDateForMonth } from "./onboarding-import-window";

describe("onboarding import window", () => {
  it("presenta un mes y siempre persiste su primer día", () => {
    expect(monthValue("2026-09-01")).toBe("2026-09");
    expect(startDateForMonth("2026-03")).toBe("2026-03-01");
  });

  it("no convierte un mes vacío en una fecha inventada", () => {
    expect(startDateForMonth("")).toBe("");
  });
});
