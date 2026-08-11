import { describe, it, expect } from "vitest";
import { buildPlanRealYear } from "./plan-real-year-model";
import type { BudgetByAccountResponse } from "@/lib/api/planning";

/* Plan vs Real por cuenta-mes: pivotea las respuestas mensuales de budget-by-account. */

function resp(
  period: string,
  accounts: BudgetByAccountResponse["accounts"],
  has_budget = true,
): BudgetByAccountResponse {
  return { period, has_budget, data_state: "available", generated_at: "2026-08-01T00:00:00Z", accounts };
}

describe("buildPlanRealYear", () => {
  const grid = buildPlanRealYear([
    resp("2026-01", [
      { account_id: "a1", account_code: "4.1", account_name: "Ventas", budget: "10000000", actual: "12000000", variance: "2000000", variance_pct: "20" },
      { account_id: "c1", account_code: "5.1", account_name: "Sueldos", budget: "-4000000", actual: "-5000000", variance: "-1000000", variance_pct: "-25" },
    ]),
    resp("2026-02", [
      { account_id: "a1", account_code: "4.1", account_name: "Ventas", budget: "10000000", actual: "11000000", variance: "1000000", variance_pct: "10" },
    ]),
  ]);

  it("pivotea a cuentas × meses (falta = null) + total anual por fila", () => {
    expect(grid.filas).toHaveLength(2);
    const ventas = grid.filas.find((f) => f.name === "Ventas")!;
    expect(ventas.meses[0]).toEqual({ real: 12_000_000, variacion: 2_000_000 });
    expect(ventas.meses[1]).toEqual({ real: 11_000_000, variacion: 1_000_000 });
    expect(ventas.totalReal).toBe(23_000_000);
    expect(ventas.totalVariacion).toBe(3_000_000); // a favor
    const sueldos = grid.filas.find((f) => f.name === "Sueldos")!;
    expect(sueldos.meses[1]).toBeNull(); // no vino en feb
    expect(sueldos.totalVariacion).toBe(-1_000_000); // en contra (signado)
  });

  it("totales por mes (signados) + cuántos meses trajeron dato", () => {
    expect(grid.totalRealMes[0]).toBe(7_000_000); // 12M ventas − 5M sueldos
    expect(grid.totalRealMes[1]).toBe(11_000_000); // solo ventas en feb
    expect(grid.mesesConDato).toBe(2);
  });

  it("meses sin respuesta todavía (undefined) no rompen", () => {
    const g = buildPlanRealYear([undefined, resp("2026-02", [], false)]);
    expect(g.filas).toHaveLength(0);
    expect(g.mesesConDato).toBe(0);
  });
});
