import { describe, it, expect } from "vitest";
import {
  parseAmount,
  shiftPeriod,
  formatPeriodLabel,
  currentPeriodSantiago,
  formatSignedPct,
  variationTone,
} from "./gestion-format";

describe("parseAmount", () => {
  it("parsea string-decimal; vacío/inválido → 0", () => {
    expect(parseAmount("18500000")).toBe(18500000);
    expect(parseAmount("-300000")).toBe(-300000);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount("x")).toBe(0);
  });
});

describe("shiftPeriod", () => {
  it("suma/resta meses con cruce de año", () => {
    expect(shiftPeriod("2026-05", -1)).toBe("2026-04");
    expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
    expect(shiftPeriod("2026-12", 1)).toBe("2027-01");
    expect(shiftPeriod("2026-05", -12)).toBe("2025-05");
  });
  it("input inválido se devuelve tal cual", () => {
    expect(shiftPeriod("nope", -1)).toBe("nope");
  });
});

describe("formatPeriodLabel", () => {
  it("YYYY-MM → 'mmm YYYY' es-CL", () => {
    expect(formatPeriodLabel("2026-05")).toBe("may 2026");
    expect(formatPeriodLabel("2026-01")).toBe("ene 2026");
    expect(formatPeriodLabel("2026-12")).toBe("dic 2026");
  });
  it("input inválido tal cual", () => {
    expect(formatPeriodLabel("2026-13")).toBe("2026-13");
    expect(formatPeriodLabel("x")).toBe("x");
  });
});

describe("currentPeriodSantiago", () => {
  it("toma el mes en America/Santiago, no UTC (borde de mes)", () => {
    // 2026-06-01 02:00 UTC = 2026-05-31 22:00 en Santiago (UTC-4) → mes 05.
    const d = new Date("2026-06-01T02:00:00Z");
    expect(currentPeriodSantiago(d)).toBe("2026-05");
  });
  it("caso normal", () => {
    expect(currentPeriodSantiago(new Date("2026-05-15T12:00:00Z"))).toBe("2026-05");
  });
});

describe("formatSignedPct", () => {
  it("signo explícito salvo 0", () => {
    expect(formatSignedPct("18.2")).toBe("+18,2%");
    expect(formatSignedPct("-7.1")).toBe("-7,1%");
    expect(formatSignedPct("0")).toBe("0%");
  });
});

describe("variationTone", () => {
  it("positivo up, negativo down, cero flat", () => {
    expect(variationTone("600000")).toBe("up");
    expect(variationTone("-300000")).toBe("down");
    expect(variationTone("0")).toBe("flat");
  });
});
