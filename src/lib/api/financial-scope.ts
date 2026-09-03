import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type FinancialScope = components["schemas"]["FinancialScopeResponse"];
export interface FinancialDecisionReadScope {
  legal_entity_id: string;
  currency: string;
  as_of: string;
}

export const financialScopeKeys = {
  all: ["financial-scope"] as const,
  current: (asOf: string | null) => [...financialScopeKeys.all, "current", asOf] as const,
};

/**
 * Converts only a server-owned ISO value into the date required by the scope contract.
 * It never uses the browser clock, and rejects malformed values instead of silently
 * changing the financial cut-off date.
 */
export function serverAsOfDate(asOf: string | null | undefined): string | null {
  if (typeof asOf !== "string") return null;

  const match = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(
    asOf,
  );
  if (!match) return null;

  const date = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== match[1]
    ? null
    : match[1];
}

/**
 * Resolves legal entity and functional currency only in the backend. The caller
 * supplies a server-sourced evaluation cut-off; absent or malformed cut-offs disable
 * the query rather than using tenant identity or today's browser date.
 */
export function useFinancialScope(serverAsOf: string | null | undefined) {
  const asOf = serverAsOfDate(serverAsOf);

  return useQuery({
    queryKey: financialScopeKeys.current(asOf),
    queryFn: () =>
      api.get<FinancialScope>(
        `/api/core/financial-scope?${new URLSearchParams({ as_of: asOf! }).toString()}`,
      ),
    enabled: asOf !== null,
    staleTime: 30_000,
    retry: false,
  });
}

/** The backend's functional currency is the only currency propagated to F6/F7/F9 readers. */
export function toFinancialDecisionReadScope(
  scope: FinancialScope | null | undefined,
): FinancialDecisionReadScope | null {
  if (!scope) return null;
  return {
    legal_entity_id: scope.legal_entity_id,
    currency: scope.functional_currency_code,
    as_of: scope.as_of,
  };
}
