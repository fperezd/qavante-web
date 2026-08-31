/* Fixtures compartidas por los tests y las stories de V09 · Presupuesto. Sólo datos: nada se
 * formatea acá. Montos INVENTADOS con la forma del contrato — nunca datos de un tenant real (regla
 * de PII, issue #74). */

import type { BudgetLine, BudgetVsActualResponse } from "@/lib/api/planning";

export const PERIODO = "2026-07";

function linea(over: Partial<BudgetLine> & Pick<BudgetLine, "concept">): BudgetLine {
  return { budget: "0", actual: "0", variance: "0", variance_pct: "0", ...over };
}

/** Forma normal: presupuesto completo, `data_state: "available"`, sin fuentes faltantes. Ingresos
 *  y gastos operacionales van a favor; costo directo se desvió en contra — así la tabla de
 *  desvíos muestra las dos tonalidades (Pill verde/roja) en la misma story. */
export function budgetVsActual(over: Partial<BudgetVsActualResponse> = {}): BudgetVsActualResponse {
  return {
    period: PERIODO,
    has_budget: true,
    data_state: "available",
    missing_sources: [],
    generated_at: "2026-08-01T12:00:00Z",
    lines: [
      linea({
        concept: "revenue",
        budget: "30000000",
        actual: "32500000",
        variance: "2500000",
        variance_pct: "8.3",
      }),
      linea({
        concept: "direct_cost",
        budget: "-12000000",
        actual: "-13400000",
        variance: "-1400000",
        variance_pct: "-11.7",
      }),
      linea({
        concept: "operating_expense",
        budget: "-9000000",
        actual: "-8200000",
        variance: "800000",
        variance_pct: "8.9",
      }),
      linea({
        concept: "result",
        budget: "9000000",
        actual: "10900000",
        variance: "1900000",
        variance_pct: "21.1",
      }),
    ],
    ...over,
  };
}

/** El `result` de `operational-result` que CALZA con el `actual` de la línea `result` de
 *  `budgetVsActual()` (10.900.000) — INV-FIN-001 canónico, `result` contra `result`
 *  (`docs/factory/proposal-pack/08_BUSINESS_INVARIANTS.md`). Para las stories/tests del guard. */
export const RESULT_OPERATIONAL_RESULT = "10900000";

/** `result` de `operational-result` que DIVERGE del `actual` de la línea `result` de
 *  `budgetVsActual()` (10.900.000 vs 9.000.000, ~1,9M) — mismo caso adversarial del reviewer (PR
 *  #102 vuelta 2): `revenue` sigue calzando con `REVENUE_OPERATIONAL_RESULT`, pero `result` no. */
export const RESULT_OPERATIONAL_RESULT_DIVERGENTE = "9000000";

/** El "Real" de la línea `revenue` de `budgetVsActual()` (32.500.000) — comprobación ADICIONAL
 *  sobre `revenue` (no sustituta de INV-FIN-001, ver `RESULT_OPERATIONAL_RESULT`). */
export const REVENUE_OPERATIONAL_RESULT = "32500000";

/** Sin presupuesto del período (`has_budget: false`) — el dueño todavía no lo propuso. */
export function budgetVsActualSinPresupuesto(): BudgetVsActualResponse {
  return {
    period: PERIODO,
    has_budget: false,
    data_state: "available",
    missing_sources: [],
    generated_at: "2026-08-01T12:00:00Z",
    lines: [],
  };
}

/** Dato parcial: hay presupuesto, pero falta una fuente (el motor lo declara en vez de estimar en
 *  silencio). */
export function budgetVsActualIncompleto(): BudgetVsActualResponse {
  return budgetVsActual({ data_state: "partial", missing_sources: ["sii_rcv"] });
}

/** Vas clavado al plan: ninguna línea se desvía (todas con `variance: "0"`). */
export function budgetVsActualSinDesvios(): BudgetVsActualResponse {
  return budgetVsActual({
    lines: [
      linea({
        concept: "revenue",
        budget: "30000000",
        actual: "30000000",
        variance: "0",
        variance_pct: "0",
      }),
      linea({
        concept: "direct_cost",
        budget: "-12000000",
        actual: "-12000000",
        variance: "0",
        variance_pct: "0",
      }),
      linea({
        concept: "operating_expense",
        budget: "-9000000",
        actual: "-9000000",
        variance: "0",
        variance_pct: "0",
      }),
      linea({
        concept: "result",
        budget: "9000000",
        actual: "9000000",
        variance: "0",
        variance_pct: "0",
      }),
    ],
  });
}
