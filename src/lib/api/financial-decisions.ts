import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type FinancialPosition = components["schemas"]["FinancialPositionResponse"];
export type FinancialDecisionList = components["schemas"]["FinancialDecisionListResponse"];

export const financialDecisionKeys = {
  all: ["financial-decisions"] as const,
  position: () => [...financialDecisionKeys.all, "position"] as const,
  list: () => [...financialDecisionKeys.all, "list"] as const,
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
