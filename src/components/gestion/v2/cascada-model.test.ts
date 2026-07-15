import { describe, it, expect } from "vitest";
import { computeCascada, type CascadaEntrada } from "./cascada-model";

const PNL: CascadaEntrada[] = [
  { id: "ing", label: "Ingresos", tipo: "ingreso", monto: 48_200_000 },
  { id: "cd", label: "Costos directos", tipo: "resta", monto: 21_400_000 },
  { id: "mb", label: "Margen bruto", tipo: "subtotal", monto: 0, pct: 55.6 },
  { id: "gl", label: "Gasto laboral", tipo: "resta", monto: 14_900_000 },
  { id: "ho", label: "Honorarios", tipo: "resta", monto: 2_300_000 },
  { id: "gr", label: "Gastos recurrentes", tipo: "resta", monto: 5_100_000 },
  { id: "res", label: "Resultado operacional", tipo: "resultado", monto: 0 },
];

describe("computeCascada", () => {
  const out = computeCascada(PNL);
  const by = (id: string) => out.find((b) => b.id === id)!;

  it("ingresos: barra completa (0 → 100%)", () => {
    expect(by("ing").left).toBe(0);
    expect(by("ing").width).toBeCloseTo(100, 1);
    expect(by("ing").montoFirmado).toBe(48_200_000);
  });

  it("resta: barra flotante que arranca donde queda el acumulado, monto en negativo", () => {
    const cd = by("cd");
    expect(cd.left).toBeCloseTo(55.6, 0); // 26.8M / 48.2M
    expect(cd.width).toBeCloseTo(44.4, 0); // 21.4M / 48.2M
    expect(cd.montoFirmado).toBe(-21_400_000);
    expect(cd.acumulado).toBe(26_800_000);
  });

  it("subtotal: barra total desde 0 hasta el acumulado, con su monto derivado", () => {
    const mb = by("mb");
    expect(mb.left).toBe(0);
    expect(mb.width).toBeCloseTo(55.6, 0);
    expect(mb.montoFirmado).toBe(26_800_000);
  });

  it("resultado: acumulado final = Ingresos − todas las restas", () => {
    const res = by("res");
    expect(res.montoFirmado).toBe(4_500_000); // 48.2 − 21.4 − 14.9 − 2.3 − 5.1
    expect(res.left).toBe(0);
    expect(res.width).toBeCloseTo(9.34, 1);
    expect(res.negativo).toBe(false);
  });

  it("marca negativo cuando el resultado es una pérdida", () => {
    const perdida = computeCascada([
      { id: "ing", label: "Ingresos", tipo: "ingreso", monto: 10_000_000 },
      { id: "c", label: "Costos", tipo: "resta", monto: 13_000_000 },
      { id: "res", label: "Resultado", tipo: "resultado", monto: 0 },
    ]);
    const res = perdida.find((b) => b.id === "res")!;
    expect(res.montoFirmado).toBe(-3_000_000);
    expect(res.negativo).toBe(true);
    expect(res.width).toBeGreaterThan(0);
  });

  it("un ítem chico conserva un ancho mínimo visible", () => {
    expect(by("ho").width).toBeGreaterThanOrEqual(0.8); // honorarios ~4.8%
  });

  it("una línea de ajuste FIRMADA suma o resta según su signo", () => {
    const conAjuste = computeCascada([
      { id: "ing", label: "Ingresos", tipo: "ingreso", monto: 10_000_000 },
      { id: "otros", label: "Otros", tipo: "ajuste", monto: -1_500_000 }, // resta
      { id: "otros2", label: "Otros +", tipo: "ajuste", monto: 500_000 }, // suma
      { id: "res", label: "Resultado", tipo: "resultado", monto: 0 },
    ]);
    const ajusteNeg = conAjuste.find((b) => b.id === "otros")!;
    expect(ajusteNeg.montoFirmado).toBe(-1_500_000); // firmado, no -abs
    expect(conAjuste.find((b) => b.id === "otros2")!.montoFirmado).toBe(500_000);
    // 10 − 1.5 + 0.5 = 9
    expect(conAjuste.find((b) => b.id === "res")!.montoFirmado).toBe(9_000_000);
  });
});
