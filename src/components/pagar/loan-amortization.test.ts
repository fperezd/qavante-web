import { describe, expect, it } from "vitest";
import { loanPreview, monthlyRateFromPayment } from "./loan-amortization";

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

describe("monthlyRateFromPayment — la tasa que esconde una cuota", () => {
  it("ida y vuelta con loanPreview: la tasa derivada reproduce la cuota", () => {
    // Control positivo del solver: sin esto, una tasa cualquiera pasaría por buena.
    const cuota = loanPreview(12000000, 0.015, 12)!.monthlyPayment;
    const r = monthlyRateFromPayment(12000000, cuota, 12)!;
    expect(r).toBeCloseTo(0.015, 5);
    expect(loanPreview(12000000, r, 12)!.monthlyPayment).toBe(cuota);
  });

  it("crédito real de X Capital: $5.000.000 en 6 cuotas de $938.187 ≈ 3,5 %/mes", () => {
    const r = monthlyRateFromPayment(5000000, 938187, 6)!;
    expect(r).toBeGreaterThan(0.034);
    expect(r).toBeLessThan(0.036);
    // Y la cuota vuelve a salir igual (al peso).
    expect(loanPreview(5000000, r, 6)!.monthlyPayment).toBe(938187);
  });

  it("sin interés: cuota × n == capital → tasa exactamente 0, no un residuo", () => {
    expect(monthlyRateFromPayment(1200000, 100000, 12)).toBe(0);
  });

  it("devolver menos de lo prestado no tiene tasa que lo explique", () => {
    expect(monthlyRateFromPayment(5000000, 100000, 6)).toBeNull();
  });

  it("datos fuera de rango → null, nunca NaN ni Infinity", () => {
    expect(monthlyRateFromPayment(0, 938187, 6)).toBeNull();
    expect(monthlyRateFromPayment(5000000, 0, 6)).toBeNull();
    expect(monthlyRateFromPayment(5000000, 938187, 0)).toBeNull();
  });

  it("una cuota altísima sigue dando una tasa finita, no null por desborde", () => {
    const r = monthlyRateFromPayment(1000000, 900000, 6);
    expect(r).not.toBeNull();
    expect(Number.isFinite(r!)).toBe(true);
  });
});

describe("[R2] la cuota se redondea con los decimales de la moneda", () => {
  it("en UF no se pierde el centésimo: 129,03 no es 129", () => {
    // Redondear siempre al entero suponía que todo era peso; en UF eso son ~$19.000
    // de diferencia por cuota.
    const p = loanPreview(1500.25, 0.005, 12, 4);
    expect(p?.monthlyPayment).toBeCloseTo(129.1212, 3);
    // Control negativo con su gemelo: sin los decimales de la moneda, esto era 129.
    expect(loanPreview(1500.25, 0.005, 12)?.monthlyPayment).toBe(129);
  });

  it("en peso sigue siendo entero (control positivo del caso de siempre)", () => {
    expect(loanPreview(12000000, 0.015, 12, 0)?.monthlyPayment).toBe(
      loanPreview(12000000, 0.015, 12)?.monthlyPayment,
    );
    expect(Number.isInteger(loanPreview(12000000, 0.015, 12, 0)!.monthlyPayment)).toBe(true);
  });

  it("el total sigue siendo la cuota por el plazo, sin arrastre binario", () => {
    const p = loanPreview(1500.25, 0.005, 12, 4)!;
    expect(p.totalToPay).toBeCloseTo(p.monthlyPayment * 12, 4);
  });
});

describe("[R2] el interés total no arrastra basura binaria", () => {
  it("en UF queda a la escala de la moneda, no 49.20440000000008", () => {
    const p = loanPreview(1500.25, 0.005, 12, 4)!;
    expect(p.totalInterest).toBe(Math.round(p.totalInterest * 10000) / 10000);
    // Control positivo: sigue siendo la diferencia real, no un cero cómodo.
    expect(p.totalInterest).toBeGreaterThan(0);
    expect(p.totalInterest).toBeCloseTo(p.totalToPay - 1500.25, 3);
  });
});
