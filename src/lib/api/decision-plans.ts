import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type DecisionPlan = components["schemas"]["DecisionPlanResponse"];

const decisionPlanKeys = {
  all: ["decision-plans"] as const,
  collection: () => [...decisionPlanKeys.all, "collection"] as const,
  payment: () => [...decisionPlanKeys.all, "payment"] as const,
};

/** Plan de cobranza calculado y explicado por el backend. */
export function useCollectionDecisionPlan(enabled = true) {
  return useQuery({
    queryKey: decisionPlanKeys.collection(),
    queryFn: () => api.get<DecisionPlan>("/api/treasury/decision-plans/collection"),
    staleTime: 30_000,
    retry: false,
    enabled,
  });
}

/** Plan de pagos calculado y explicado por el backend. */
export function usePaymentDecisionPlan(enabled = true) {
  return useQuery({
    queryKey: decisionPlanKeys.payment(),
    queryFn: () => api.get<DecisionPlan>("/api/treasury/decision-plans/payment"),
    staleTime: 30_000,
    retry: false,
    enabled,
  });
}
