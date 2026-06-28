import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — Obligaciones / Préstamos (Tesorería). El tenant registra
   préstamos (alta con amortización francesa derivada por el backend) y el sistema
   concilia las cuotas pendientes contra los débitos bancarios (1:1). Vive bajo
   Pagar. Endpoints (aceptan cookie de sesión, verificado 2026-06-25):
   - GET  /api/treasury/obligations            → lista + resumen de cuotas
   - POST /api/treasury/obligations            → alta de préstamo → calendario
   - GET  /api/treasury/obligations/{id}       → detalle (cabecera + calendario)
   - POST /api/treasury/obligations/reconcile  → concilia cuotas vs débitos
   Tipos GENERADOS (regla 3). Gated por `obligations`. Montos string-decimal. */

export type ObligationsListResponse = components["schemas"]["ObligationsListResponse"];
export type ObligationListItem = components["schemas"]["ObligationListItem"];
export type ObligationDetailResponse = components["schemas"]["ObligationDetailResponse"];
export type ObligationInstallmentDetail = components["schemas"]["ObligationInstallmentDetail"];
export type CreateLoanBody = components["schemas"]["CreateLoanRequest"];
export type LoanResponse = components["schemas"]["LoanResponse"];
export type ObligationReconcileResponse = components["schemas"]["ObligationReconcileResponse"];

export const obligationKeys = {
  all: ["obligations"] as const,
  list: () => [...obligationKeys.all, "list"] as const,
  detail: (id: string) => [...obligationKeys.all, "detail", id] as const,
};

/** `GET /api/treasury/obligations` — obligaciones del tenant + resumen de cuotas. */
export function useObligations(enabled = true) {
  return useQuery({
    queryKey: obligationKeys.list(),
    queryFn: () => api.get<ObligationsListResponse>("/api/treasury/obligations"),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** `GET /api/treasury/obligations/{id}` — detalle: cabecera + calendario completo. */
export function useObligationDetail(id: string | null) {
  return useQuery({
    queryKey: obligationKeys.detail(id ?? ""),
    queryFn: () => api.get<ObligationDetailResponse>(`/api/treasury/obligations/${id}`),
    enabled: Boolean(id),
    staleTime: 30_000,
    retry: false,
  });
}

/** `POST /api/treasury/obligations` — alta de préstamo; el backend deriva la
    amortización (sistema francés) y devuelve la cabecera + calendario. NO retry. */
export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLoanBody) =>
      api.post<LoanResponse>("/api/treasury/obligations", { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: obligationKeys.all }),
  });
}

/** `POST /api/treasury/obligations/reconcile` — concilia cuotas pendientes contra
    débitos bancarios (1:1). Devuelve cuántas quedaron auto-conciliadas. NO retry. */
export function useReconcileObligations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ObligationReconcileResponse>("/api/treasury/obligations/reconcile"),
    onSuccess: () => qc.invalidateQueries({ queryKey: obligationKeys.all }),
  });
}
