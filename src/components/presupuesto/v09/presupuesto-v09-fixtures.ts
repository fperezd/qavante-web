/* Fixtures compartidas por los tests y las stories de V09 · Presupuesto. Sólo datos: nada se
 * formatea acá. Montos INVENTADOS con la forma del contrato — nunca datos de un tenant real (regla
 * de PII, issue #74). */

import type {
  BudgetAccountLine,
  BudgetByAccountResponse,
  BudgetClosingProjectionResponse,
  BudgetLine,
  BudgetVsActualResponse,
} from "@/lib/api/planning";

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

/* ═══════════════════════════ Drill-down nivel 1: budget-by-account (issue #101) ═══════════════ */

function cuenta(over: Partial<BudgetAccountLine> & Pick<BudgetAccountLine, "account_name">): BudgetAccountLine {
  return {
    account_id: null,
    account_code: null,
    budget: "0",
    actual: "0",
    variance: "0",
    variance_pct: "0",
    concept: null,
    concept_status: "unassigned",
    ...over,
  };
}

/** `budget-by-account` del mismo período que `budgetVsActual()`: cuentas `assigned` de los tres
 *  conceptos (caja committed, por eso NO suman exacto contra el devengado de la línea de desvíos
 *  — eso es lo que el cross-foot declara) + una `ambiguous` y una `unassigned` en el bucket "Sin
 *  asignar". */
export function budgetByAccount(
  over: Partial<BudgetByAccountResponse> = {},
): BudgetByAccountResponse {
  return {
    period: PERIODO,
    has_budget: true,
    data_state: "available",
    basis: "cash_committed",
    missing_sources: [],
    generated_at: "2026-08-01T12:00:00Z",
    accounts: [
      cuenta({
        account_id: "a-ventas",
        account_code: "4.1",
        account_name: "Ventas Chile",
        budget: "28000000",
        actual: "30000000",
        variance: "2000000",
        variance_pct: "7.1",
        concept: "revenue",
        concept_status: "assigned",
        impact_types: ["revenue"],
      }),
      cuenta({
        account_id: "a-ventas-exp",
        account_code: "4.2",
        account_name: "Ventas Exportación",
        budget: "2000000",
        actual: "2300000",
        variance: "300000",
        variance_pct: "15",
        concept: "revenue",
        concept_status: "assigned",
        impact_types: ["revenue"],
      }),
      cuenta({
        account_id: "a-insumos",
        account_code: "5.1",
        account_name: "Insumos de producción",
        budget: "-11500000",
        actual: "-12800000",
        variance: "-1300000",
        variance_pct: "-11.3",
        concept: "direct_cost",
        concept_status: "assigned",
        impact_types: ["direct_cost"],
      }),
      cuenta({
        account_id: "a-arriendo",
        account_code: "6.1",
        account_name: "Arriendo oficina",
        budget: "-8500000",
        actual: "-7900000",
        variance: "600000",
        variance_pct: "7.1",
        concept: "operating_expense",
        concept_status: "assigned",
        impact_types: ["operating_expense"],
      }),
      // `ambiguous`: sus impactos caen en más de un concepto — "conflicto explícito, no se
      // reparte" (contrato). Nunca aparece bajo Ingresos/Costos/Gastos.
      cuenta({
        account_id: "a-mixta",
        account_code: "7.1",
        account_name: "Cuenta mixta (ventas y devoluciones de proveedor)",
        budget: "500000",
        actual: "-200000",
        variance: "-700000",
        variance_pct: "-140",
        concept: null,
        concept_status: "ambiguous",
        impact_types: ["revenue", "direct_cost"],
      }),
      // `unassigned`: ningún impacto pertenece al P&L operacional (p.ej. capex/deuda).
      cuenta({
        account_id: "a-capex",
        account_code: "8.1",
        account_name: "Compra de activo fijo",
        budget: "-3000000",
        actual: "-2800000",
        variance: "200000",
        variance_pct: "6.7",
        concept: null,
        concept_status: "unassigned",
        impact_types: ["capex"],
      }),
    ],
    ...over,
  };
}

/** Sin cuentas: `budget-by-account` respondió pero no hay ninguna cuenta del período (el bucket
 *  "Sin asignar" no debe aparecer y cada drill de concepto debe declarar "ninguna cuenta"). */
export function budgetByAccountVacio(): BudgetByAccountResponse {
  return budgetByAccount({ accounts: [] });
}

/* ═══════════════════════════ Proyección de cierre: budget-closing-projection (CC-API #431) ═════ */

/** Cierre disponible: cobertura completa, `projected_result` firmado por el servidor. */
export function closingProjectionDisponible(
  over: Partial<BudgetClosingProjectionResponse> = {},
): BudgetClosingProjectionResponse {
  return {
    fiscal_year: 2026,
    as_of: "2026-08-01",
    method: "closed_actual_plus_remaining_budget",
    currency: "CLP",
    data_state: "estimated",
    coverage: "complete",
    projected_result: "118000000",
    generated_at: "2026-08-01T12:00:00Z",
    periods: [
      { period: "2026-01", basis: "actual_closed", data_state: "available", amount: "9000000" },
      { period: "2026-12", basis: "budget_remaining", data_state: "available", amount: "9500000" },
    ],
    sources: [
      { code: "operational_result", covered_periods: ["2026-01"], missing_periods: [] },
      { code: "approved_budget", covered_periods: ["2026-12"], missing_periods: [] },
    ],
    abstention_reasons: [],
    ...over,
  };
}

/** Cierre con abstención explícita: `projected_result: null` + razones — nunca un 0, nunca
 *  "cierre completo" inventado (Ley 3). */
export function closingProjectionAbstiene(
  over: Partial<BudgetClosingProjectionResponse> = {},
): BudgetClosingProjectionResponse {
  return {
    fiscal_year: 2026,
    as_of: "2026-08-01",
    method: "closed_actual_plus_remaining_budget",
    currency: "CLP",
    data_state: "partial",
    coverage: "partial",
    projected_result: null,
    generated_at: "2026-08-01T12:00:00Z",
    periods: [
      { period: "2026-01", basis: "actual_closed", data_state: "available", amount: "9000000" },
      {
        period: "2026-06",
        basis: "actual_closed",
        data_state: "partial",
        amount: null,
        missing_sources: ["sii_rcv"],
      },
    ],
    sources: [
      { code: "operational_result", covered_periods: ["2026-01"], missing_periods: ["2026-06"] },
      { code: "approved_budget", covered_periods: [], missing_periods: [] },
    ],
    abstention_reasons: [
      "Julio de 2026 todavía no tiene el resultado operacional cerrado (falta la conciliación del RCV).",
    ],
    ...over,
  };
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
