import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import type { BudgetVsActualResponse } from "@/lib/api/planning";
import type { BalanceData } from "@/lib/api/treasury";
import { cajaHoy } from "@/lib/finanzas/caja-hoy";
import { parseAmountOrNull } from "@/lib/formatters/amount";

/** Only published financial actions; the forecast and bookkeeping already have their own destinations. */
export function accionesFinancierasInicio(data: DashboardSummaryV2 | null) {
  const seen = new Set<string>();
  return [...(data?.priority_actions ?? [])]
    .filter((action) => /^\/(cobrar|pagar)(\/|\?|#|$)/.test(action.cta_href))
    .sort((a, b) => a.priority - b.priority)
    .filter((action) => {
      const key = [action.cta_href, action.reason, action.deadline].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

/** Presentation only: never reconstruct a gap from obligations minus projected cash. */
export function resumenCaja(data: DashboardSummaryV2 | null, now = new Date()) {
  const cash = cajaHoy(data);
  const gap = data?.cash_gap;
  const minimum = parseAmountOrNull(data?.cash_forecast?.min_14d);
  const amount = parseAmountOrNull(gap?.cash_gap_amount_14d);
  const projected = parseAmountOrNull(gap?.projected_cash_14d);
  const needsAttention = gap?.has_gap === true || (minimum != null && minimum < 0);
  const sameDay = (value: string | null | undefined) => {
    if (!value || !Number.isFinite(new Date(value).valueOf())) return false;
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" });
    return formatter.format(new Date(value)) === formatter.format(now);
  };
  return {
    cash,
    needsAttention,
    projectionCurrent: sameDay(gap?.last_updated) && sameDay(data?.cash_forecast?.last_updated),
    // A positive closing balance alone never establishes coverage inside the horizon.
    noGapReported:
      gap?.has_gap === false &&
      amount === 0 &&
      minimum != null &&
      minimum >= 0 &&
      projected != null &&
      projected >= 0 &&
      cash.monto != null &&
      cash.estado === "available" &&
      sameDay(cash.actualizado) &&
      sameDay(gap.last_updated) &&
      sameDay(data?.cash_forecast?.last_updated),
    gapAmount: needsAttention && amount != null && amount > 0 ? amount : null,
    projected,
    minimum,
  };
}

/** Signed budget contract: expense variance < 0 is over budget. Read variance as supplied. */
export function gastosSobrePresupuesto(data: BudgetVsActualResponse | null | undefined) {
  if (!data?.has_budget || data.data_state !== "available" || data.missing_sources?.length)
    return [];
  return (data.lines ?? []).flatMap((line) => {
    if (line.concept !== "direct_cost" && line.concept !== "operating_expense") return [];
    const budget = parseAmountOrNull(line.budget);
    const actual = parseAmountOrNull(line.actual);
    const variance = parseAmountOrNull(line.variance);
    if (budget == null || actual == null || variance == null || variance >= 0) return [];
    // Positive expense values violate this signed contract; do not turn them into an assertion.
    if (budget > 0 || actual > 0) return [];
    return [
      {
        concept: line.concept,
        label: line.concept === "direct_cost" ? "los costos directos" : "los gastos",
        budget: Math.abs(budget),
        actual: Math.abs(actual),
        over: Math.abs(variance),
      },
    ];
  });
}

/** Only reported credit amounts. Missing available amount is not cupo minus assumed usage. */
export function creditoInformado(balance: BalanceData | undefined) {
  if (!balance) return null;
  const total = parseAmountOrNull(balance.montoAprobadoMonto);
  const available = parseAmountOrNull(balance.montoDisponibleMonto);
  const currency = balance.montoAprobadoCodigoMoneda?.trim();
  if (total == null || total <= 0 || !currency) return null;
  const availableCurrency = balance.montoDisponibleCodigoMoneda?.trim();
  return {
    total,
    currency,
    available:
      availableCurrency === currency && available != null && available >= 0 ? available : null,
  };
}
