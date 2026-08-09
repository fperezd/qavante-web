import { describe, it, expect } from "vitest";
import { mapPlanReal, agregarPlanReal } from "./plan-real-model";
import type { BudgetVsActualResponse } from "@/lib/api/planning";

/* Modelo Plan vs Real: mapea líneas de P&L (plan/real/variación) y acumula el anual. */

function resp(
  hasBudget: boolean,
  lines: Array<{ concept: string; budget: string; actual: string }>,
): BudgetVsActualResponse {
  return {
    period: "2026-07",
    has_budget: hasBudget,
    data_state: "available",
    generated_at: "2026-08-01T00:00:00Z",
    lines: lines.map((l) => ({
      concept: l.concept,
      budget: l.budget,
      actual: l.actual,
      variance: String(Number(l.actual) - Number(l.budget)),
      variance_pct: "0",
    })),
  } as unknown as BudgetVsActualResponse;
}

describe("mapPlanReal", () => {
  it("ordena las filas del P&L y calcula variación/%", () => {
    const r = mapPlanReal(
      resp(true, [
        { concept: "revenue", budget: "10000000", actual: "12000000" },
        { concept: "direct_cost", budget: "4000000", actual: "5000000" },
        { concept: "operating_expense", budget: "3000000", actual: "2500000" },
        { concept: "result", budget: "3000000", actual: "4500000" },
      ]),
      "julio",
    );
    expect(r).not.toBeNull();
    expect(r!.tieneBudget).toBe(true);
    expect(r!.filas.map((f) => f.concepto)).toEqual([
      "revenue",
      "direct_cost",
      "operating_expense",
      "result",
    ]);
    const ingresos = r!.filas[0]!;
    expect(ingresos.variacion).toBe(2000000);
    expect(ingresos.variacionPct).toBe(20);
  });

  it("favorable = variacion ≥ 0 para TODAS las líneas (montos SIGNADOS: costos negativos)", () => {
    // Contrato ADR-0091: revenue +, costos/gastos NEGATIVOS. `variance = actual − budget > 0` siempre bueno.
    const r = mapPlanReal(
      resp(true, [
        { concept: "revenue", budget: "10000000", actual: "12000000" }, // +2M → vendió más → favorable
        { concept: "direct_cost", budget: "-4000000", actual: "-5000000" }, // gastó MÁS (−1M) → NO favorable
        { concept: "operating_expense", budget: "-3000000", actual: "-2500000" }, // gastó menos (+0,5M) → favorable
        { concept: "result", budget: "3000000", actual: "2000000" }, // −1M → NO favorable
      ]),
      "julio",
    );
    const byConcept = Object.fromEntries(r!.filas.map((f) => [f.concepto, f.favorable]));
    expect(byConcept.revenue).toBe(true);
    expect(byConcept.direct_cost).toBe(false);
    expect(byConcept.operating_expense).toBe(true);
    expect(byConcept.result).toBe(false);
  });

  it("variacionPct null si el plan es 0 (no dividir por cero)", () => {
    const r = mapPlanReal(
      resp(true, [{ concept: "revenue", budget: "0", actual: "500000" }]),
      "julio",
    );
    expect(r!.filas[0]!.variacionPct).toBeNull();
  });

  it("has_budget=false se propaga (el contenedor muestra estado honesto)", () => {
    const r = mapPlanReal(resp(false, []), "julio");
    expect(r!.tieneBudget).toBe(false);
  });

  it("null si no hay respuesta", () => {
    expect(mapPlanReal(undefined, "julio")).toBeNull();
  });
});

describe("agregarPlanReal", () => {
  it("suma plan y real por concepto sobre los meses y recalcula variación", () => {
    const r = agregarPlanReal(
      [
        resp(true, [
          { concept: "revenue", budget: "10000000", actual: "11000000" },
          { concept: "result", budget: "2000000", actual: "1000000" },
        ]),
        resp(true, [
          { concept: "revenue", budget: "10000000", actual: "9000000" },
          { concept: "result", budget: "2000000", actual: "3000000" },
        ]),
      ],
      "2026 a la fecha",
    );
    const ingresos = r!.filas.find((f) => f.concepto === "revenue")!;
    expect(ingresos.plan).toBe(20000000);
    expect(ingresos.real).toBe(20000000); // 11M + 9M
    expect(ingresos.variacion).toBe(0);
    const resultado = r!.resultado!;
    expect(resultado.plan).toBe(4000000);
    expect(resultado.real).toBe(4000000); // 1M + 3M
  });

  it("tieneBudget=true si al menos un mes tiene presupuesto", () => {
    const r = agregarPlanReal([resp(false, []), resp(true, [])], "2026 a la fecha");
    expect(r!.tieneBudget).toBe(true);
  });

  it("null si no hay ninguna respuesta válida", () => {
    expect(agregarPlanReal([undefined, undefined], "2026")).toBeNull();
  });
});
