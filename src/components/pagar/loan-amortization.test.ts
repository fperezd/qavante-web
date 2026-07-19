import { describe, expect, it } from "vitest";
import { loanPreview } from "./loan-amortization";

describe("loanPreview — amortización francesa", () => {
  it("sin interés: cuota = capital / n", () => {
    const p = loanPreview(1200000, 0, 12);
    expect(p?.monthlyPayment).toBe(100000);
    expect(p?.totalToPay).toBe(1200000);
    expect(p?.totalInterest).toBe(0);
  });

  it("sin interés con capital que no divide exacto: interés = 0, no un −$1 fantasma", () => {
    const p = loanPreview(1000000, 0, 3); // 1.000.000 / 3 = 333.333,33 → cuota 333.333
    expect(p?.monthlyPayment).toBe(333333);
    expect(p?.totalInterest).toBe(0); // antes: 999.999 − 1.000.000 = −1
  });

  it("con interés mensual: cuota > capital/n y hay interés total", () => {
    const p = loanPreview(12000000, 0.015, 12);
    expect(p).not.toBeNull();
    // sin interés serían 1.000.000; con 1.5%/mes la cuota es mayor.
    expect(p!.monthlyPayment).toBeGreaterThan(1000000);
    expect(p!.totalInterest).toBeGreaterThan(0);
    expect(p!.totalToPay).toBe(p!.monthlyPayment * 12);
  });

  it("datos inválidos → null", () => {
    expect(loanPreview(0, 0.01, 12)).toBeNull();
    expect(loanPreview(1000, 0.01, 0)).toBeNull();
    expect(loanPreview(1000, -0.01, 12)).toBeNull();
  });
});
