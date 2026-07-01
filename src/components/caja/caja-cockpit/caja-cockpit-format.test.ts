import { describe, expect, it } from "vitest";
import { cashCushion14d, dataStateLabel, parseAmount, runwayTone } from "./caja-cockpit-format";

describe("caja-cockpit-format", () => {
  it("parseAmount tolera null/no-numérico", () => {
    expect(parseAmount("1234567.89")).toBeCloseTo(1234567.89);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount("x")).toBe(0);
  });

  it("runwayTone: <14 danger, <30 warning, ≥30 success, null neutral", () => {
    expect(runwayTone(9)).toBe("danger");
    expect(runwayTone(21)).toBe("warning");
    expect(runwayTone(45)).toBe("success");
    expect(runwayTone(null)).toBe("neutral");
  });

  it("dataStateLabel mapea los 3 estados", () => {
    expect(dataStateLabel("available").tone).toBe("success");
    expect(dataStateLabel("stale").tone).toBe("warning");
    expect(dataStateLabel("estimated").label).toBe("Estimado");
  });

  it("cashCushion14d = proyectada − críticas (con signo)", () => {
    expect(cashCushion14d("5000000", "3000000")).toBe(2000000);
    expect(cashCushion14d("2000000", "3000000")).toBe(-1000000);
  });
});
