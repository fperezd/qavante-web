import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type FinancialPosition = components["schemas"]["FinancialPositionResponse"];
export type FinancialDecisionList = components["schemas"]["FinancialDecisionListResponse"];
export type LiquidityEvaluation = components["schemas"]["LiquidityEvaluationResponse"];
export type DecisionSelectionRequest = components["schemas"]["DecisionSelectionRequest"];
export type DecisionSelectionResponse = components["schemas"]["DecisionSelectionResponse"];
export type OperationPlanRead = components["schemas"]["OperationPlanReadResponse"];
export type OperationApprovalRequest = components["schemas"]["OperationApprovalRequest"];
export type OperationApprovalResponse = components["schemas"]["OperationApprovalResponse"];

export const financialDecisionKeys = {
  all: ["financial-decisions"] as const,
  position: () => [...financialDecisionKeys.all, "position"] as const,
  list: () => [...financialDecisionKeys.all, "list"] as const,
  latestLiquidityEvaluation: () =>
    [...financialDecisionKeys.all, "liquidity-evaluation", "latest"] as const,
  operationPlanForDecision: (decisionId: string) =>
    [...financialDecisionKeys.all, "operation-plan", "decision", decisionId] as const,
};

/** Read-only FPDE projection. The backend remains the sole owner of diagnosis and policy. */
export function useFinancialPosition() {
  return useQuery({
    queryKey: financialDecisionKeys.position(),
    queryFn: () => api.get<FinancialPosition>("/api/treasury/financial-position"),
    staleTime: 30_000,
    retry: false,
  });
}

/** Persisted FPDE decision snapshots only; the endpoint never manufactures a recommendation. */
export function useFinancialDecisions() {
  return useQuery({
    queryKey: financialDecisionKeys.list(),
    queryFn: () => api.get<FinancialDecisionList>("/api/treasury/decisions?limit=3"),
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * Última evaluación F1 persistida para una brecha de caja.
 *
 * La lista ya viene ordenada por `generated_at DESC` desde el backend. El cliente sólo resuelve
 * el id y lee el agregado: no detecta brechas, no reordena alternativas y no completa costos.
 * `null` significa que el tenant todavía no tiene una evaluación persistida.
 *
 * `enabled` existe para la superficie que ya no publica esta decisión: la lectura
 * encadena `decisions` → `liquidity-evaluations` → `operation-plan`, así que apagarla
 * acá corta las tres. Pedirlas para descartar su salida gasta lecturas del backend
 * y deja rastro de una segunda decisión que nadie va a mostrar.
 */
export function useLatestLiquidityEvaluation(enabled = true) {
  return useQuery({
    queryKey: financialDecisionKeys.latestLiquidityEvaluation(),
    queryFn: async (): Promise<LiquidityEvaluation | null> => {
      const decisions = await api.get<FinancialDecisionList>(
        "/api/treasury/decisions?family=cash_gap&status=evaluated",
      );
      const latest = decisions.items?.[0];
      if (!latest) return null;
      return api.get<LiquidityEvaluation>(
        `/api/treasury/liquidity-evaluations/${encodeURIComponent(latest.id)}`,
      );
    },
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** Reader F2 publicado por qavante-api#306; el estado viene reducido desde operation_events. */
export function useOperationPlanForDecision(decisionId: string | null) {
  return useQuery({
    queryKey: financialDecisionKeys.operationPlanForDecision(decisionId ?? ""),
    queryFn: () =>
      api.get<OperationPlanRead>(
        `/api/treasury/decisions/${encodeURIComponent(decisionId!)}/operation-plan`,
        { skipAuthRetry: true },
      ),
    enabled: Boolean(decisionId),
    staleTime: 30_000,
    retry: false,
  });
}

/** Solicita revisión humana; no aprueba, envía ni ejecuta el OperationPlan. */
export function useRequestOperationPlanApproval(operationPlanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OperationApprovalRequest) =>
      api.post<OperationApprovalResponse>(
        `/api/treasury/operation-plans/${encodeURIComponent(operationPlanId)}/request-approval`,
        { body, skipAuthRetry: true },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financialDecisionKeys.all });
    },
  });
}

/**
 * Registra el visto bueno humano sobre una alternativa ya evaluada por el backend.
 *
 * El cliente no aprueba ni ejecuta el OperationPlan: el endpoint sólo persiste la selección y,
 * cuando corresponde, devuelve un borrador operativo. La vigencia, el rank y el rol vuelven a
 * validarse en servidor; ocultar el CTA en la UI es sólo una ayuda, nunca autorización.
 */
export function useSelectFinancialDecisionAlternative(decisionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DecisionSelectionRequest) =>
      api.post<DecisionSelectionResponse>(
        `/api/treasury/decisions/${encodeURIComponent(decisionId)}/selection`,
        /* La selección debe poder mostrar un 401 explícito dentro del diálogo. No se repite
           silenciosamente tras refresh: el idempotency key sólo gobierna reintentos humanos
           visibles del mismo intento. */
        { body, skipAuthRetry: true },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financialDecisionKeys.all });
    },
  });
}
