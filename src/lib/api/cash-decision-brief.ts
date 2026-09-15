import { type QueryClient, useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/** La decisión de caja se publica completa desde API; el cliente sólo la lee. */
export type CashDecisionBrief = components["schemas"]["CashDecisionBriefResponse"];

export const cashDecisionBriefKey = ["treasury", "cash-decision-brief"] as const;

/** Un único envelope/caché server-owned para todas las superficies operativas. */
export function cashDecisionBriefQueryOptions(enabled = true) {
  return {
    queryKey: cashDecisionBriefKey,
    queryFn: () => api.get<CashDecisionBrief>("/api/treasury/decision-brief"),
    enabled,
    staleTime: 30_000,
    retry: false,
  };
}

export function useCashDecisionBrief(enabled = true) {
  return useQuery(cashDecisionBriefQueryOptions(enabled));
}

/** Un cambio material vuelve a pedir el mismo brief activo en vez de esperar el staleTime. */
export function invalidateCashDecisionBrief(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: cashDecisionBriefKey,
    refetchType: "active",
  });
}
