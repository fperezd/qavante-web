import { describe, it, expect } from "vitest";
import { buildBudgetGrid, MESES_GRID, SECCIONES_GRID } from "./budget-grid-model";
import type { BudgetGridResponse } from "@/lib/api/planning";

/* Modelo de la grilla anual editable: agrupa cuentas por sección, subtotales por mes y Resultado. */

function meses(...v: number[]): { [k: string]: string } {
  const o: { [k: string]: string } = {};
  v.forEach((x, i) => (o[String(i + 1)] = String(x)));
  return o;
}

const RESP: BudgetGridResponse = {
  year: 2026,
  currency: "CLP",
  status: "draft",
  accepted: false,
  has_budget: true,
  total_year: "0",
  generated_at: "2026-08-01T00:00:00Z",
  categories: [
    // 2 meses para simplificar (el resto queda en 0).
    { account_id: "a1", account_code: "4.1", account_name: "Ventas", impact_type: "revenue", months: meses(10_000_000, 12_000_000), total_year: "22000000" },
    { account_id: "c1", account_code: "5.1", account_name: "Sueldos", impact_type: "direct_cost", months: meses(-4_000_000, -4_000_000), total_year: "-8000000" },
    { account_id: "g1", account_code: "6.1", account_name: "Arriendo", impact_type: "operating_expense", months: meses(-1_000_000, -1_000_000), total_year: "-2000000" },
  ],
};

describe("buildBudgetGrid", () => {
  it("agrupa las cuentas en las 3 secciones de P&L en orden", () => {
    const g = buildBudgetGrid(RESP);
    expect(g.secciones.map((s) => s.label)).toEqual(SECCIONES_GRID.map((s) => s.label));
    expect(g.secciones[0]!.filas.map((f) => f.name)).toEqual(["Ventas"]);
    expect(g.secciones[1]!.filas.map((f) => f.name)).toEqual(["Sueldos"]);
  });

  it("expande months {1..12} a 12 celdas (falta = 0) y calcula el total anual por fila", () => {
    const g = buildBudgetGrid(RESP);
    const ventas = g.secciones[0]!.filas[0]!;
    expect(ventas.meses).toHaveLength(12);
    expect(ventas.meses[0]).toBe(10_000_000);
    expect(ventas.meses[1]).toBe(12_000_000);
    expect(ventas.meses[2]).toBe(0);
    expect(ventas.totalAnio).toBe(22_000_000);
  });

  it("subtotal por sección y Resultado = suma SIGNADA de todas las secciones, por mes", () => {
    const g = buildBudgetGrid(RESP);
    // Mes 1: 10M ingresos − 4M sueldos − 1M arriendo = 5M.
    expect(g.resultadoMeses[0]).toBe(5_000_000);
    // Mes 2: 12M − 4M − 1M = 7M.
    expect(g.resultadoMeses[1]).toBe(7_000_000);
    expect(g.resultadoAnio).toBe(12_000_000);
    expect(g.secciones[1]!.totalAnio).toBe(-8_000_000); // costos signados
  });

  it("propaga estado y bandera de aceptado", () => {
    const g = buildBudgetGrid(RESP);
    expect(g.status).toBe("draft");
    expect(g.accepted).toBe(false);
    expect(MESES_GRID).toHaveLength(12);
  });
});
