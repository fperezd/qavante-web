import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type FinancialPosition = components["schemas"]["FinancialPositionResponse"];
export type FinancialDecisionList = components["schemas"]["FinancialDecisionListResponse"];
export type LiquidityEvaluation = components["schemas"]["LiquidityEvaluationResponse"];

export const financialDecisionKeys = {
  all: ["financial-decisions"] as const,
  position: () => [...financialDecisionKeys.all, "position"] as const,
  list: () => [...financialDecisionKeys.all, "list"] as const,
  latestLiquidityEvaluation: () =>
    [...financialDecisionKeys.all, "liquidity-evaluation", "latest"] as const,
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
 */
export function useLatestLiquidityEvaluation() {
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
    staleTime: 30_000,
    retry: false,
  });
}
