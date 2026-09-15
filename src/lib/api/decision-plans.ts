import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";
import type { CashProjectionScenarioId } from "./cash-projection-runs";
import { useMe } from "./users";

export type DecisionPlan = components["schemas"]["DecisionPlanResponse"];

const decisionPlanKeys = {
  all: ["decision-plans"] as const,
  collection: () => [...decisionPlanKeys.all, "collection"] as const,
  payment: () => [...decisionPlanKeys.all, "payment"] as const,
  canonicalPayment: (tenantId: string, runId: string, scenarioId: CashProjectionScenarioId) =>
    [...decisionPlanKeys.all, tenantId, "payment", runId, scenarioId] as const,
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

/** Payment canónico: el backend exige run H=14 y escenario juntos. */
export function useCanonicalPaymentDecisionPlan(
  runId: string | null,
  scenarioId: CashProjectionScenarioId | null,
  enabled = true,
) {
  const me = useMe();
  const tenantId = me.data?.user.tenant_id ?? null;
  return useQuery({
    queryKey: decisionPlanKeys.canonicalPayment(
      tenantId ?? "session-unresolved",
      runId ?? "unresolved",
      scenarioId ?? "scheduled_expected_v1",
    ),
    queryFn: () => {
      const search = new URLSearchParams({
        projection_run_id: runId!,
        scenario_id: scenarioId!,
      });
      return api.get<DecisionPlan>(`/api/treasury/decision-plans/payment?${search.toString()}`);
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    enabled: enabled && tenantId !== null && runId !== null && scenarioId !== null,
  });
}
