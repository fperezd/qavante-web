import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components, operations } from "./types";

export type DecisionReadScope = operations["treasury_fx_exposures"]["parameters"]["query"];
export type FxExposureRead = components["schemas"]["FxInvestmentSituationResponse"];
export type FxEvaluationRead = components["schemas"]["FxEvaluationResponse"];
export type InvestableSurplusRead = components["schemas"]["InvestmentSituationResponse"];
export type InvestmentEvaluationRead = components["schemas"]["InvestmentEvaluationResponse"];
export type OutcomeValueRead = components["schemas"]["OutcomeValueReadResponse"];

export const financialDecisionReaderKeys = {
  all: ["financial-decision-readers"] as const,
  fxExposures: (scope: DecisionReadScope | null) =>
    [...financialDecisionReaderKeys.all, "fx-exposures", scope] as const,
  fxEvaluations: (scope: DecisionReadScope | null) =>
    [...financialDecisionReaderKeys.all, "fx-evaluations", scope] as const,
  investableSurplus: (scope: DecisionReadScope | null) =>
    [...financialDecisionReaderKeys.all, "investable-surplus", scope] as const,
  investmentEvaluations: (scope: DecisionReadScope | null) =>
    [...financialDecisionReaderKeys.all, "investment-evaluations", scope] as const,
  outcomeValues: (scope: DecisionReadScope | null) =>
    [...financialDecisionReaderKeys.all, "outcome-values", scope] as const,
};

function decisionReaderQuery(scope: DecisionReadScope): string {
  return new URLSearchParams({
    legal_entity_id: scope.legal_entity_id,
    currency: scope.currency,
    as_of: scope.as_of,
  }).toString();
}

function useDecisionReader<T>(
  key: readonly unknown[],
  path: string,
  scope: DecisionReadScope | null,
) {
  return useQuery({
    queryKey: key,
    queryFn: () => api.get<T>(`${path}?${decisionReaderQuery(scope!)}`),
    enabled: scope !== null,
    staleTime: 30_000,
    retry: false,
  });
}

/** F6 observed exposures only; the reader never creates a quote, netting or trade. */
export function useFxExposures(scope: DecisionReadScope | null) {
  return useDecisionReader<FxExposureRead>(
    financialDecisionReaderKeys.fxExposures(scope),
    "/api/treasury/fx-exposures",
    scope,
  );
}

/** F6 server-owned evaluation snapshot; abstention remains an abstention in the UI. */
export function useFxEvaluations(scope: DecisionReadScope | null) {
  return useDecisionReader<FxEvaluationRead>(
    financialDecisionReaderKeys.fxEvaluations(scope),
    "/api/treasury/fx-evaluations",
    scope,
  );
}

/** F7 is intentionally read-only and currently can only return an explicit abstention. */
export function useInvestableSurplus(scope: DecisionReadScope | null) {
  return useDecisionReader<InvestableSurplusRead>(
    financialDecisionReaderKeys.investableSurplus(scope),
    "/api/treasury/investable-surplus",
    scope,
  );
}

export function useInvestmentEvaluations(scope: DecisionReadScope | null) {
  return useDecisionReader<InvestmentEvaluationRead>(
    financialDecisionReaderKeys.investmentEvaluations(scope),
    "/api/treasury/investment-evaluations",
    scope,
  );
}

/** F9 outcome/value reader; no client-side attribution or value calculation is performed. */
export function useOutcomeValues(scope: DecisionReadScope | null) {
  return useDecisionReader<OutcomeValueRead>(
    financialDecisionReaderKeys.outcomeValues(scope),
    "/api/treasury/outcome-values",
    scope,
  );
}
