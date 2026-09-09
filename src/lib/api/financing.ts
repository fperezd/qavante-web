import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components, operations } from "./types";
import type {
  FinancingEvaluationContract,
  FinancingOverviewContract,
} from "@/components/financiamiento/v13/financiamiento-v13-model";

export type FinancingQuery =
  operations["treasury_working_capital_refinancing_evaluation"]["parameters"]["query"];
export type WorkingCapitalRefinancingEvaluation =
  components["schemas"]["WorkingCapitalRefinancingEvaluationResponse"];

export const financingKeys = {
  all: ["financing"] as const,
  overview: (scope: FinancingQuery | null) => [...financingKeys.all, "overview", scope] as const,
  evaluation: (scope: FinancingQuery | null) =>
    [...financingKeys.all, "evaluation", scope] as const,
};

function query(scope: FinancingQuery): string {
  return new URLSearchParams({
    legal_entity_id: scope.legal_entity_id,
    currency: scope.currency,
    as_of: scope.as_of,
  }).toString();
}

/** V13 read-only. Respuesta tipada desde el OpenAPI publicado por API #443. */
export function useFinancingOverview(scope: FinancingQuery | null) {
  return useQuery({
    queryKey: financingKeys.overview(scope),
    queryFn: () =>
      api.get<FinancingOverviewContract>(`/api/treasury/financing-overview?${query(scope!)}`),
    enabled: scope !== null,
    staleTime: 30_000,
    retry: false,
  });
}

export function useWorkingCapitalRefinancingEvaluation(scope: FinancingQuery | null) {
  return useQuery({
    queryKey: financingKeys.evaluation(scope),
    queryFn: () =>
      api.get<WorkingCapitalRefinancingEvaluation>(
        `/api/treasury/working-capital-refinancing-evaluation?${query(scope!)}`,
      ),
    enabled: scope !== null,
    staleTime: 30_000,
    retry: false,
  });
}

export function toFinancingEvaluation(
  value: WorkingCapitalRefinancingEvaluation | null | undefined,
): FinancingEvaluationContract | null {
  if (!value) return null;
  return value;
}
