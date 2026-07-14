import { describe, it, expect } from "vitest";
import { calcularBrecha, brechaResidual } from "./brecha-caja-model";

describe("calcularBrecha", () => {
  it("no cubre → faltante", () => {
    const b = calcularBrecha(9_400_000, 18_100_000);
    expect(b.cubre).toBe(false);
    expect(b.faltante).toBe(8_700_000);
    expect(b.holgura).toBe(0);
    expect(b.pctCubierto).toBeCloseTo(51.93, 1);
  });
  it("cubre → holgura", () => {
    const b = calcularBrecha(20_000_000, 18_100_000);
    expect(b.cubre).toBe(true);
    expect(b.faltante).toBe(0);
    expect(b.holgura).toBe(1_900_000);
    expect(b.pctCubierto).toBe(100);
  });
  it("sin críticos → cubre, 100%", () => {
    const b = calcularBrecha(5_000_000, 0);
    expect(b.cubre).toBe(true);
    expect(b.pctCubierto).toBe(100);
  });
  it("caja negativa se trata como 0", () => {
    const b = calcularBrecha(-1000, 5000);
    expect(b.faltante).toBe(5000);
    expect(b.pctCubierto).toBe(0);
  });
});

describe("brechaResidual", () => {
  it("resta lo postergable, nunca bajo 0", () => {
    expect(brechaResidual(8_700_000, 5_500_000)).toBe(3_200_000);
    expect(brechaResidual(3_000_000, 5_000_000)).toBe(0);
  });
});
