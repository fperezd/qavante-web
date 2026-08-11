/* Capa de datos — Planning: Presupuesto vs Real (plan/real), la vista contable clásica que un dueño
   está acostumbrado a ver. Source de verdad: tag "planning" del OpenAPI.
     GET /api/planning/budget-vs-actual?period=YYYY-MM   → por línea de P&L (ingresos/costo/gastos/resultado)
     GET /api/planning/budget-by-account?period=YYYY-MM   → drill-down por cuenta de gestión
   Solo LECTURA: el presupuesto se carga como financial-impacts (layer budget); no hay UI de carga aún. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type BudgetVsActualResponse = components["schemas"]["BudgetVsActualResponse"];
export type BudgetLine = components["schemas"]["BudgetLine"];
export type BudgetByAccountResponse = components["schemas"]["BudgetByAccountResponse"];
export type BudgetAccountLine = components["schemas"]["BudgetAccountLine"];
export type BudgetGridResponse = components["schemas"]["BudgetGridResponse"];
export type BudgetGridCategory = components["schemas"]["BudgetGridCategory"];
export type BudgetEditRequest = components["schemas"]["BudgetEditRequest"];
export type BudgetEditResponse = components["schemas"]["BudgetEditResponse"];
export type BudgetAcceptResponse = components["schemas"]["BudgetAcceptResponse"];

export const planningKeys = {
  all: ["planning"] as const,
  budgetVsActual: (period: string) => [...planningKeys.all, "budget-vs-actual", period] as const,
  budgetByAccount: (period: string) => [...planningKeys.all, "budget-by-account", period] as const,
  budgetGrid: (year: number) => [...planningKeys.all, "budget-grid", year] as const,
};

/** Query options de budget-by-account (plan vs real POR CUENTA de un mes). Compartido por `useQueries`
 *  del plan/real anual (una query por mes → carga progresiva). */
export function budgetByAccountQueryOptions(period: string, enabled = true) {
  return {
    queryKey: planningKeys.budgetByAccount(period),
    queryFn: () =>
      api.get<BudgetByAccountResponse>(
        `/api/planning/budget-by-account?period=${encodeURIComponent(period)}`,
      ),
    enabled: enabled && period !== "",
    staleTime: 30_000,
    retry: false,
  };
}

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

/* `POST /api/planning/budget/propose` (ADR-0091 F1a, CC-API #870) — PROPONE el presupuesto del año desde
   el histórico real (tendencia + estacionalidad + recurrentes + meta simple del dueño). No se llena a mano.
   Tipos inline: el endpoint aún no está en el OpenAPI generado (correr `generate:api` cuando se publique).
   Ver el contrato en qavante-web#883. */
export interface ProposeBudgetRequest {
  fiscal_year: number;
  /** {categoria: pct} — ej. `{ revenue: 0.08 }` para +8% ventas. Opcional (sin meta = plan neutro). */
  meta?: Record<string, number>;
  recurring?: unknown[];
}
export interface ProposeBudgetResponse {
  version_id: string;
  fiscal_year: number;
  result_year: string;
  history_months: number;
  impacts_written: number;
}

/** Propone (o re-propone) el presupuesto del año. Al terminar invalida planning → `budget-vs-actual`
 *  refetchea y pasa a `has_budget=true`. Es una acción explícita del dueño (botón), no automática. */
export function useProposeBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProposeBudgetRequest) =>
      api.post<ProposeBudgetResponse>("/api/planning/budget/propose", { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planningKeys.all });
    },
  });
}

/* Grilla anual EDITABLE (CC-API F2): la forma en que un dueño ve y ajusta el presupuesto — categorías
   (cuentas) × 12 meses + estado draft/approved. Editar una celda re-abre a `draft`; aceptar la publica. */

/** `GET /api/planning/budget/{year}` — grilla anual editable (cuentas × 12 meses). `has_budget=false`
 *  si no hay presupuesto del año (proponer primero). */
export function useBudgetGrid(year: number, enabled = true) {
  return useQuery({
    queryKey: planningKeys.budgetGrid(year),
    queryFn: () => api.get<BudgetGridResponse>(`/api/planning/budget/${year}`),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** `PATCH /api/planning/budget/{year}/line` — edita el monto de una celda (cuenta × mes). Solo toca la
 *  capa `budget`; deja la versión en `draft`. Invalida planning → la grilla y el hero se recalculan. */
export function useEditBudgetLine(year: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BudgetEditRequest) =>
      api.patch<BudgetEditResponse>(`/api/planning/budget/${year}/line`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planningKeys.all });
    },
  });
}

/** `POST /api/planning/budget/{year}/accept` — acepta/ratifica el presupuesto (draft → approved). */
export function useAcceptBudget(year: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<BudgetAcceptResponse>(`/api/planning/budget/${year}/accept`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planningKeys.all });
    },
  });
}
