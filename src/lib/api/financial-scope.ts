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
  current: (asOf: string | null, legalEntityId: string | null) =>
    [...financialScopeKeys.all, "current", asOf, legalEntityId] as const,
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

  const declaredDate = new Date(`${match[1]}T00:00:00.000Z`);
  if (
    Number.isNaN(declaredDate.getTime()) ||
    declaredDate.toISOString().slice(0, 10) !== match[1]
  ) {
    return null;
  }

  if (!asOf.includes("T")) {
    return match[1];
  }

  const instant = new Date(asOf);
  if (Number.isNaN(instant.getTime())) return null;
  // `en-CA` produce YYYY-MM-DD: es el formato con el que se le habla a la API, no al usuario
  // (§5.8 lo permite; `dateInSantiago` del modelo de runs usa el mismo idioma).
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

/**
 * Resolves legal entity and functional currency only in the backend. The caller
 * supplies a server-sourced evaluation cut-off; absent or malformed cut-offs disable
 * the query rather than using tenant identity or today's browser date.
 */
export function useFinancialScope(
  serverAsOf: string | null | undefined,
  legalEntityId?: string | null,
) {
  const asOf = serverAsOfDate(serverAsOf);
  const selectedEntity = legalEntityId?.trim() || null;

  return useQuery({
    queryKey: financialScopeKeys.current(asOf, selectedEntity),
    queryFn: () => {
      const params = new URLSearchParams({ as_of: asOf! });
      if (selectedEntity) params.set("legal_entity_id", selectedEntity);
      return api.get<FinancialScope>(`/api/core/financial-scope?${params.toString()}`);
    },
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
