import { describe, expect, it } from "vitest";
import { computeRunning, firstBreachIndex, parseAmount, type ProjBucket } from "./projection-format";

const B = (label: string, net: string): ProjBucket => ({
  period: "2026-07-01",
  label,
  inflow: "0",
  outflow: "0",
  net,
});

describe("projection-format", () => {
  it("computeRunning acumula desde el saldo inicial", () => {
    const rows = computeRunning("10000000", [B("S1", "-3000000"), B("S2", "-4000000"), B("S3", "2000000")], null);
    expect(rows.map((r) => r.running)).toEqual([7000000, 3000000, 5000000]);
    expect(rows.every((r) => r.belowMinimum === false)).toBe(true);
  });

  it("marca belowMinimum cuando el acumulado cae bajo la caja mínima", () => {
    const rows = computeRunning("10000000", [B("S1", "-3000000"), B("S2", "-4000000"), B("S3", "-1000000")], "5000000");
    // running: 7M, 3M, 2M → bajo 5M en S2 y S3
    expect(rows.map((r) => r.belowMinimum)).toEqual([false, true, true]);
    expect(firstBreachIndex(rows)).toBe(1);
  });

  it("sin caja mínima no hay quiebre", () => {
    const rows = computeRunning("1000000", [B("S1", "-5000000")], null);
    expect(firstBreachIndex(rows)).toBe(-1);
  });

  it("parseAmount tolera null y basura", () => {
    expect(parseAmount("123.45")).toBeCloseTo(123.45);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount("nan")).toBe(0);
  });
});
