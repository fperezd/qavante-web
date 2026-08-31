import { describe, it, expect } from "vitest";
import { mapPlanReal, agregarPlanReal } from "./plan-real-model";
import { triadaV09 } from "@/components/presupuesto/v09/presupuesto-v09-model";
import type { BudgetVsActualResponse } from "@/lib/api/planning";

/* Modelo Plan vs Real: mapea líneas de P&L (plan/real/variación) y acumula el anual. */

interface LineaFixture {
  concept: string;
  budget: string;
  actual: string;
  /** Si se omite, se calcula `actual - budget` (mismo valor que el backend calcularía en el caso
   *  normal). Pasarlo explícito permite fijar un `variance`/`variance_pct` DISCREPANTE de
   *  `actual - budget`, igual que el fixture de `presupuesto-v09-model.test.ts` — la única forma de
   *  probar que MENSUAL lee el campo del backend en vez de recalcularlo. */
  variance?: string;
  /** Igual que `variance`: si se omite, se calcula `variance / |budget| * 100` (budget=0 → "0", como
   *  documenta `BudgetLine.variance_pct` del contrato). */
  variance_pct?: string;
}

function linea(l: LineaFixture) {
  const budgetNum = Number(l.budget);
  const actualNum = Number(l.actual);
  const varianceNum = actualNum - budgetNum;
  return {
    concept: l.concept,
    budget: l.budget,
    actual: l.actual,
    variance: l.variance ?? String(varianceNum),
    variance_pct:
      l.variance_pct ?? (budgetNum !== 0 ? String((varianceNum / Math.abs(budgetNum)) * 100) : "0"),
  };
}

function resp(hasBudget: boolean, lines: LineaFixture[]): BudgetVsActualResponse {
  return {
    period: "2026-07",
    has_budget: hasBudget,
    data_state: "available",
    generated_at: "2026-08-01T00:00:00Z",
    lines: lines.map(linea),
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

  /* ── LEY 1 (qavante-web#103) ──────────────────────────────────────────────────────────────
   * Fixture con los números REALES del issue: backend budget=9.000.000, actual=10.900.000 →
   * `variance_pct` = "21.1" (el backend YA lo trae calculado y redondeado a 1 decimal). El código
   * viejo ignoraba ese campo y recalculaba `Math.round((1900000/9000000)*100)` = 21 — perdiendo el
   * decimal. Con el fix, `variacionPct` debe ser EXACTAMENTE 21.1 (no 21, no un objeto vacío: un
   * número, sin redondear en el modelo — el redondeo a 1 decimal es de `formatPct`, no de acá). */
  it("MENSUAL lee `variance_pct` del backend SIN redondear a entero (21,1 %, no 21 %)", () => {
    const r = mapPlanReal(
      resp(true, [
        { concept: "result", budget: "9000000", actual: "10900000", variance_pct: "21.1" },
      ]),
      "julio",
    );
    const resultado = r!.resultado!;
    expect(resultado.variacionPct).toBe(21.1); // el número correcto: NO el entero redondeado.
    expect(resultado.variacionPct).not.toBe(21); // gemelo negativo del mismo assert: el bug viejo.
  });

  /* Backend `variance` DELIBERADAMENTE distinto de `actual - budget` (mismo patrón que
   * `presupuesto-v09-model.test.ts`, "aunque no calce con actual−budget"): si `mapPlanReal`
   * recalculara en vez de leer, este test caería. `actual - budget` = 1.900.000; el `variance`
   * fijado por el backend es 2.500.000 — deben leerse los 2.500.000. */
  it("MENSUAL lee `variance` del backend tal cual, aunque no calce con actual−budget (nunca se recalcula)", () => {
    const r = mapPlanReal(
      resp(true, [
        {
          concept: "result",
          budget: "9000000",
          actual: "10900000",
          variance: "2500000",
          variance_pct: "27.8",
        },
      ]),
      "julio",
    );
    const resultado = r!.resultado!;
    expect(resultado.variacion).toBe(2500000); // el campo del backend...
    expect(resultado.variacion).not.toBe(1900000); // ...no el actual − budget recalculado.
  });

  /* ── LEY 1 — el mismo backend, el mismo número en las DOS pantallas ──────────────────────────
   * Con la MISMA respuesta de `/api/planning/budget-vs-actual`, el desvío que pinta el widget de
   * Inicio (`mapPlanReal`) y el que pinta V09 Presupuesto (`triadaV09`) deben COINCIDIR — es
   * literalmente la condición de encendido de `presupuestoV09` (issue #103). Si alguien vuelve a
   * derivar `real - plan` + redondeo en cualquiera de los dos módulos, este test cae. */
  it("Ley 1: el desvío del widget de Inicio coincide con el de V09 Presupuesto (mismo backend)", () => {
    const backend = resp(true, [
      { concept: "revenue", budget: "30000000", actual: "32500000", variance_pct: "8.3" },
      { concept: "direct_cost", budget: "-12000000", actual: "-13400000", variance_pct: "-11.7" },
      { concept: "operating_expense", budget: "-9000000", actual: "-8200000", variance_pct: "8.9" },
      { concept: "result", budget: "9000000", actual: "10900000", variance_pct: "21.1" },
    ]);

    const inicio = mapPlanReal(backend, "julio")!.resultado!;
    const v09 = triadaV09("julio", backend)!;

    expect(inicio.variacionPct).toBe(v09.desvioPct); // el mismo número...
    expect(inicio.variacionPct).toBe(21.1); // ...y es el 21,1 % del backend, no un 21 % redondeado.
    expect(inicio.variacion).toBe(v09.desvio);
    expect(inicio.plan).toBe(v09.plan);
    expect(inicio.real).toBe(v09.real);
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
  /* ANUAL no tiene un `variance`/`variance_pct` de backend para el RANGO (sólo mensual existe) —
   * sigue derivando de los TOTALES ya sumados. Este describe documenta que eso es intencional (ver
   * cabecera de `plan-real-model.ts`), no una regresión de #103. */
  it("suma plan y real por concepto sobre los meses y deriva la variación de los totales", () => {
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
