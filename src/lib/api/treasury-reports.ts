/* Capa de datos — Treasury Reports: cash flow agregado (Sprint C3 MVP).
 *
 * Source de verdad: tag "treasury-reports" del OpenAPI. Hoy expone un solo
 * endpoint:
 *   GET /api/treasury/reports/cash-flow
 *     ?period_from=YYYY-MM&period_to=YYYY-MM
 *     &granularity=month|week|day
 *     &financial_layer=committed|budget|forecast|scenario|...
 *     &group_by=none|canonical_category|management_account
 *     &currency, account_id, currency_code, scenario_id, version_id, include_attention
 *
 * Scope MVP (alineado a addendum frontend-v2 §25.3): exponer el reporte agregado
 * tal cual viene, sin inventar "caja mínima" ni "acciones recomendadas" en FE.
 * Esos quedan para Fase 2 cuando el backend entregue contrato. */
import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type CashFlowBucket = components["schemas"]["CashFlowBucket"];
export type CashFlowGroup = components["schemas"]["CashFlowGroup"];
export type CashFlowGrandTotal = components["schemas"]["CashFlowGrandTotal"];
export type CashFlowReportResponse = components["schemas"]["CashFlowReportResponse"];

export type CashFlowGranularity = "month" | "week" | "day";
export type CashFlowFinancialLayer =
  | "committed"
  | "budget"
  | "forecast"
  | "scenario"
  | "manual_simulation"
  | "ai_projection";
export type CashFlowGroupBy = "none" | "canonical_category" | "management_account";
export type CashFlowCurrency = "functional" | "original";

export interface CashFlowReportParams {
  /** YYYY-MM inclusive (default: mes actual). */
  period_from: string;
  /** YYYY-MM inclusive (default: mes siguiente). */
  period_to: string;
  granularity?: CashFlowGranularity;
  financial_layer?: CashFlowFinancialLayer;
  group_by?: CashFlowGroupBy;
  currency?: CashFlowCurrency;
  currency_code?: string;
  account_id?: string;
  scenario_id?: string;
  version_id?: string;
  include_attention?: boolean;
}

export const treasuryReportsKeys = {
  all: ["treasury-reports"] as const,
  cashFlow: (params: CashFlowReportParams) =>
    [...treasuryReportsKeys.all, "cash-flow", params] as const,
};

/** Construye el query string para GET /api/treasury/reports/cash-flow.
    Exportado para testing — el orden no es semánticamente significativo,
    pero estabilizamos el shape para que el query key + caché de
    react-query sean predecibles. */
export function buildCashFlowQuery(p: CashFlowReportParams): string {
  const s = new URLSearchParams();
  s.set("period_from", p.period_from);
  s.set("period_to", p.period_to);
  if (p.granularity) s.set("granularity", p.granularity);
  if (p.financial_layer) s.set("financial_layer", p.financial_layer);
  if (p.group_by) s.set("group_by", p.group_by);
  if (p.currency) s.set("currency", p.currency);
  if (p.currency_code) s.set("currency_code", p.currency_code);
  if (p.account_id) s.set("account_id", p.account_id);
  if (p.scenario_id) s.set("scenario_id", p.scenario_id);
  if (p.version_id) s.set("version_id", p.version_id);
  if (p.include_attention != null) s.set("include_attention", String(p.include_attention));
  return `?${s.toString()}`;
}

/** `GET /api/treasury/reports/cash-flow` — reporte agregado por período. */
export function useCashFlowReport(params: CashFlowReportParams) {
  return useQuery({
    queryKey: treasuryReportsKeys.cashFlow(params),
    queryFn: () =>
      api.get<CashFlowReportResponse>(
        `/api/treasury/reports/cash-flow${buildCashFlowQuery(params)}`,
      ),
    /* 30s: el reporte agrega financial_impacts ya clasificados; cambia cuando
       el usuario clasifica movimientos nuevos. Refresh on focus alcanza. */
    staleTime: 30_000,
    retry: false,
    /* Habilita el fetch sólo si los dos extremos del rango están seteados. La
       UI puede montar el componente antes de que el usuario elija periodo. */
    enabled: Boolean(params.period_from && params.period_to),
  });
}

/* Helper puro para defaultear rango = mes actual → mes siguiente (mes + 1).
   Con granularity=week da ~8-9 semanas. Aislado del componente para testear. */
export function defaultCashFlowRange(now: Date = new Date()): {
  period_from: string;
  period_to: string;
} {
  const y0 = now.getFullYear();
  const m0 = now.getMonth(); // 0-based
  const from = `${y0}-${String(m0 + 1).padStart(2, "0")}`;
  const next = new Date(y0, m0 + 1, 1);
  const to = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  return { period_from: from, period_to: to };
}
