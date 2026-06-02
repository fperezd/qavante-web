import { describe, it, expect } from "vitest";
import { parseAmount, agingBars } from "./cobranza-format";
import type { ReceivableAging } from "@/lib/api/cobranza";

describe("parseAmount", () => {
  it("string-decimal → number; vacío/inválido → 0", () => {
    expect(parseAmount("24800000")).toBe(24800000);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount("x")).toBe(0);
  });
});

describe("agingBars", () => {
  const aging: ReceivableAging = {
    current: "16900000",
    d1_30: "3200000",
    d31_60: "2100000",
    d61_90: "1400000",
    d90_plus: "1200000",
  };

  it("devuelve los 5 tramos en orden con label", () => {
    const bars = agingBars(aging);
    expect(bars.map((b) => b.key)).toEqual(["current", "d1_30", "d31_60", "d61_90", "d90_plus"]);
    expect(bars[0]?.label).toBe("Vigente");
    expect(bars[4]?.label).toBe("90+ días");
  });

  it("calcula % del total", () => {
    const bars = agingBars(aging);
    const total = 16900000 + 3200000 + 2100000 + 1400000 + 1200000; // 24.8M
    expect(bars[0]?.pct).toBeCloseTo((16900000 / total) * 100, 5);
    expect(bars.reduce((a, b) => a + b.pct, 0)).toBeCloseTo(100, 5);
  });

  it("total 0 → pct 0 (sin división por cero)", () => {
    const empty: ReceivableAging = {
      current: "0",
      d1_30: "0",
      d31_60: "0",
      d61_90: "0",
      d90_plus: "0",
    };
    expect(agingBars(empty).every((b) => b.pct === 0)).toBe(true);
  });
});
