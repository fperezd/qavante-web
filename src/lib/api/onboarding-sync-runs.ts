import * as React from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { invalidateCashDecisionBrief } from "./cash-decision-brief";
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
  const qc = useQueryClient();
  const query = useQuery({
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

  React.useEffect(() => {
    // El run puede haber incorporado parte de una fuente antes de fallar. Al terminar, sea
    // exitoso o fallido, se pide un envelope nuevo al servidor en vez de mezclar el Brief previo.
    if (query.data?.status === "completed" || query.data?.status === "failed") {
      invalidateDecisionBriefAfterOnboardingSync(qc);
    }
  }, [qc, query.data?.status]);

  return query;
}

/** Finalizar un run cambia la evidencia disponible. Sólo marcamos stale la clave
 * compartida: al abrir el panel se obtiene otro envelope del servidor. */
export function invalidateDecisionBriefAfterOnboardingSync(qc: QueryClient): void {
  void invalidateCashDecisionBrief(qc);
}
