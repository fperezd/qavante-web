import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — Inicio Ejecutivo / Dashboard (Sprint C8, Documento Maestro
   §7.1).

   `GET /api/dashboard/summary` ya existe en el backend (expuesto 2026-06-03,
   acepta cookie). Tipos GENERADOS desde el OpenAPI (regla 3); re-exportados con
   los nombres `Dashboard*` que ya consumen la vista y los helpers. Contrato en
   `docs/backend-contracts/inicio-dashboard-summary-contract.md`.

   Cada bloque es NULLABLE (y opcional en el schema): una fuente puede
   faltar/fallar sin tumbar el dashboard (Maestro §7.1: "carga aunque una fuente
   falle"; faltante ≠ 0). La frase ejecutiva es rule-based (NO LLM, Anexo H.1).
   Montos string-decimal. */

export type DashboardPulso = components["schemas"]["Pulso"];
/** Estados canónicos del Pulso (Anexo C). */
export type PulsoStatus = DashboardPulso["status"];
/** Niveles de confianza conocidos (el backend manda string; mapeamos estos). */
export type Confidence = "high" | "medium" | "low";

export type DashboardCashToday = components["schemas"]["CashToday"];
export type DashboardCashForecast = components["schemas"]["CashForecast"];
export type DashboardCashGap = components["schemas"]["CashGap"];
export type DashboardOverdueCollections = components["schemas"]["OverdueCollections"];
export type DashboardCriticalPayments = components["schemas"]["CriticalPayments"];
export type DashboardOperationalResult = components["schemas"]["OperationalResult"];
export type DashboardAction = components["schemas"]["PriorityAction"];
export type DashboardSummaryResponse = components["schemas"]["DashboardSummaryResponse"];

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
};

/** `GET /api/dashboard/summary` — agregado del Inicio Ejecutivo. NO retry. */
export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: () => api.get<DashboardSummaryResponse>("/api/dashboard/summary"),
    staleTime: 30_000,
    retry: false,
  });
}
