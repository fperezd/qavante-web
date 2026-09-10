import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { FinancialDecisionReadScope } from "./financial-scope";
import type { components, operations } from "./types";

export type CollectionSituation = components["schemas"]["CollectionSituationResponse"];
export type CollectionEvaluation = components["schemas"]["CollectionEvaluationResponse"];
/** Exact query contract published for both F3 readers. */
export type CollectionReadQuery =
  operations["treasury_collection_situation"]["parameters"]["query"];

export const collectionDecisionKeys = {
  all: ["collection-decisions"] as const,
  situation: (scope: CollectionReadQuery | null) =>
    [...collectionDecisionKeys.all, "situation", scope] as const,
  evaluation: (scope: CollectionReadQuery | null) =>
    [...collectionDecisionKeys.all, "evaluation", scope] as const,
};

/**
 * F3 and the canonical financial-scope reader share this exact three-field scope.
 * Keeping the adaptation explicit prevents callers from falling back to tenant identity,
 * a browser currency or the browser clock when a financial scope cannot be demonstrated.
 */
export function collectionReadScopeFromFinancialScope(
  scope: FinancialDecisionReadScope | null,
): CollectionReadQuery | null {
  if (!scope) return null;

  return {
    legal_entity_id: scope.legal_entity_id,
    currency: scope.currency,
    as_of: scope.as_of,
  };
}

function collectionQuery(scope: CollectionReadQuery): string {
  return new URLSearchParams({
    legal_entity_id: scope.legal_entity_id,
    currency: scope.currency,
    as_of: scope.as_of,
  }).toString();
}

/**
 * F3 situation reader. It intentionally does not guess the legal entity: callers must provide
 * the complete, OpenAPI-defined scope before TanStack Query is enabled.
 */
export function useCollectionSituation(scope: CollectionReadQuery | null) {
  return useQuery({
    queryKey: collectionDecisionKeys.situation(scope),
    queryFn: () =>
      api.get<CollectionSituation>(`/api/treasury/collection-situation?${collectionQuery(scope!)}`),
    enabled: scope !== null,
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * F3 evaluation reader. The response is a server-owned snapshot: this hook never derives an
 * alternative or turns an abstention into a recommendation.
 */
export function useCollectionEvaluation(scope: CollectionReadQuery | null) {
  return useQuery({
    queryKey: collectionDecisionKeys.evaluation(scope),
    queryFn: () =>
      api.get<CollectionEvaluation>(
        `/api/treasury/collection-evaluation?${collectionQuery(scope!)}`,
      ),
    enabled: scope !== null,
    staleTime: 30_000,
    retry: false,
  });
}
