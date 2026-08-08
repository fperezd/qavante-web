/* Capa de datos — Planning: Presupuesto vs Real (plan/real), la vista contable clásica que un dueño
   está acostumbrado a ver. Source de verdad: tag "planning" del OpenAPI.
     GET /api/planning/budget-vs-actual?period=YYYY-MM   → por línea de P&L (ingresos/costo/gastos/resultado)
     GET /api/planning/budget-by-account?period=YYYY-MM   → drill-down por cuenta de gestión
   Solo LECTURA: el presupuesto se carga como financial-impacts (layer budget); no hay UI de carga aún. */
import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type BudgetVsActualResponse = components["schemas"]["BudgetVsActualResponse"];
export type BudgetLine = components["schemas"]["BudgetLine"];
export type BudgetByAccountResponse = components["schemas"]["BudgetByAccountResponse"];

export const planningKeys = {
  all: ["planning"] as const,
  budgetVsActual: (period: string) => [...planningKeys.all, "budget-vs-actual", period] as const,
};

/** Query options de budget-vs-actual (compartido por el hook mensual y por `useQueries` del anual). */
export function budgetVsActualQueryOptions(period: string, enabled = true) {
  return {
    queryKey: planningKeys.budgetVsActual(period),
    queryFn: () =>
      api.get<BudgetVsActualResponse>(
        `/api/planning/budget-vs-actual?period=${encodeURIComponent(period)}`,
      ),
    enabled: enabled && period !== "",
    staleTime: 30_000,
    retry: false,
  };
}

/** `GET /api/planning/budget-vs-actual?period=YYYY-MM` — plan vs real por línea de P&L del mes.
 *  `has_budget=false` si no hay presupuesto cargado del período (el contenedor muestra estado honesto). */
export function useBudgetVsActual(period: string, enabled = true) {
  return useQuery(budgetVsActualQueryOptions(period, enabled));
}
