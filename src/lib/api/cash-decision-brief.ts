import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/** La decisión de caja se publica completa desde API; el cliente sólo la lee. */
export type CashDecisionBrief = components["schemas"]["CashDecisionBriefResponse"];

export const cashDecisionBriefKey = ["treasury", "cash-decision-brief"] as const;

export function useCashDecisionBrief() {
  return useQuery({
    queryKey: cashDecisionBriefKey,
    queryFn: () => api.get<CashDecisionBrief>("/api/treasury/decision-brief"),
    staleTime: 30_000,
    retry: false,
  });
}
