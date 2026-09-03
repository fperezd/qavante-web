import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type OnboardingSyncRun = components["schemas"]["OnboardingSyncRunResponse"];

export const onboardingSyncRunKeys = {
  detail: (runId: string) => ["onboarding-sync-run", runId] as const,
};

/** Inicia el primer sync asíncrono. El POST responde 202 con un identificador estable. */
export function useStartOnboardingSyncRun() {
  return useMutation({
    mutationFn: () => api.post<OnboardingSyncRun>("/api/onboarding/sync-runs"),
  });
}

/** Lee sólo el run del tenant actual. Deja de sondear cuando alcanza un estado terminal. */
export function useOnboardingSyncRun(runId: string | null) {
  return useQuery({
    queryKey: onboardingSyncRunKeys.detail(runId ?? ""),
    queryFn: () =>
      api.get<OnboardingSyncRun>(`/api/onboarding/sync-runs/${encodeURIComponent(runId ?? "")}`),
    enabled: runId !== null,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 2_000 : false;
    },
  });
}
