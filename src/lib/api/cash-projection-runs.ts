import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { ApiError } from "./errors";
import { useMe } from "./users";
import { useDashboardSummary } from "./dashboard";
import {
  toFinancialDecisionReadScope,
  useFinancialScope,
  type FinancialDecisionReadScope,
} from "./financial-scope";
import type { components } from "./types";

/** Generated from the frozen audit integration contract. */
export const CASH_PROJECTION_CONTRACT_SHA = "49d54b8286712350b54f40d4b8dacc8e70328b00";

export type CashProjectionRun = components["schemas"]["CashProjectionRunResponse"];
export type CashProjectionScenario = components["schemas"]["CashProjectionScenarioResponse"];
export type CashProjectionScenarioId = CashProjectionScenario["scenario_id"];

const root = ["cash-projection-runs", CASH_PROJECTION_CONTRACT_SHA] as const;

export const cashProjectionRunKeys = {
  intent: (tenantId: string, horizonDays: number, scope: FinancialDecisionReadScope) =>
    [
      ...root,
      tenantId,
      "intent",
      horizonDays,
      scope.legal_entity_id,
      scope.currency,
      scope.as_of,
    ] as const,
  latest: (tenantId: string, horizonDays: number, scope: FinancialDecisionReadScope | null) =>
    [
      ...root,
      tenantId,
      "latest",
      horizonDays,
      scope?.legal_entity_id ?? null,
      scope?.currency ?? null,
      scope?.as_of ?? null,
    ] as const,
  run: (tenantId: string, runId: string) => [...root, tenantId, "run", runId] as const,
  scenario: (
    tenantId: string,
    runId: string,
    scenarioId: CashProjectionScenarioId,
    version: string,
  ) => [...root, tenantId, "run", runId, version, "scenario", scenarioId] as const,
};

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  throw new Error("secure_random_unavailable");
}

function intentKey(
  queryClient: QueryClient,
  tenantId: string,
  horizonDays: number,
  scope: FinancialDecisionReadScope,
): string {
  const key = cashProjectionRunKeys.intent(tenantId, horizonDays, scope);
  const existing = queryClient.getQueryData<string>(key);
  if (existing) return existing;
  const created = newIdempotencyKey();
  queryClient.setQueryData(key, created);
  return created;
}

export function cacheImmutableRun(
  queryClient: QueryClient,
  tenantId: string,
  run: CashProjectionRun,
) {
  queryClient.setQueryData(cashProjectionRunKeys.run(tenantId, run.projection_run_id), run);
  for (const scenario of run.scenarios) {
    queryClient.setQueryData(
      cashProjectionRunKeys.scenario(
        tenantId,
        run.projection_run_id,
        scenario.scenario_id,
        run.calculation_version,
      ),
      scenario,
    );
  }
}

export async function createCashProjectionRun(
  queryClient: QueryClient,
  tenantId: string,
  horizonDays: number,
  scope: FinancialDecisionReadScope,
): Promise<CashProjectionRun> {
  const key = cashProjectionRunKeys.intent(tenantId, horizonDays, scope);
  let run: CashProjectionRun;
  try {
    run = await api.post<CashProjectionRun>("/api/treasury/cash-projection-runs", {
      headers: { "Idempotency-Key": intentKey(queryClient, tenantId, horizonDays, scope) },
      body: {
        horizon_days: horizonDays,
        legal_entity_id: scope.legal_entity_id,
        currency: scope.currency,
        as_of: scope.as_of,
      },
    });
  } catch (error) {
    // Una respuesta HTTP conocida confirma que no se perdió un 200/201: esa intención terminó
    // y el próximo intento debe usar otra clave. Red/abort conserva la clave por si el run sí nació.
    if (error instanceof ApiError && error.status > 0) {
      queryClient.removeQueries({ queryKey: key, exact: true });
    }
    throw error;
  }
  cacheImmutableRun(queryClient, tenantId, run);
  // El retry de una respuesta perdida conserva la intención. Sólo una respuesta exitosa la
  // completa: el próximo refresh explícito crea una foto nueva con otra clave.
  queryClient.removeQueries({ queryKey: key, exact: true });
  return run;
}

export function useCashProjectionRun(
  horizonDays: number,
  enabled = true,
  legalEntityId?: string | null,
) {
  const me = useMe();
  const summary = useDashboardSummary();
  const financialScope = useFinancialScope(summary.data?.generated_at, legalEntityId);
  const scope = toFinancialDecisionReadScope(financialScope.data);
  const queryClient = useQueryClient();
  const tenantId = me.data?.user.tenant_id ?? null;
  const query = useQuery({
    queryKey: cashProjectionRunKeys.latest(tenantId ?? "session-unresolved", horizonDays, scope),
    queryFn: () => createCashProjectionRun(queryClient, tenantId!, horizonDays, scope!),
    enabled: enabled && tenantId !== null && scope !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  return {
    ...query,
    tenantId,
    tenantLoading: me.isLoading || summary.isLoading || financialScope.isLoading,
    scopeError: summary.error ?? financialScope.error,
  };
}

export function scenarioFromRun(
  run: CashProjectionRun | null | undefined,
  scenarioId: CashProjectionScenarioId,
): CashProjectionScenario | null {
  return run?.scenarios.find((scenario) => scenario.scenario_id === scenarioId) ?? null;
}

export async function getCashProjectionRun(runId: string): Promise<CashProjectionRun> {
  return api.get<CashProjectionRun>(
    `/api/treasury/cash-projection-runs/${encodeURIComponent(runId)}`,
  );
}
