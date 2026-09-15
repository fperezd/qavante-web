import type { DecisionPlan } from "@/lib/api/decision-plans";
import type {
  CashProjectionRun,
  CashProjectionScenario,
  CashProjectionScenarioId,
} from "@/lib/api/cash-projection-runs";

export type ProjectionPresentationState = "current" | "partial" | "stale";

export interface ProjectionSelection {
  runId: string;
  calculationVersion: string;
  scenarioId: CashProjectionScenarioId;
}

export interface CashProjectionViewModel {
  runId: string;
  calculationVersion: string;
  inputDigest: string;
  asOf: string;
  horizonDays: number;
  currency: string;
  scenario: CashProjectionScenario;
  state: ProjectionPresentationState;
}

export const DEFAULT_SCENARIO: CashProjectionScenarioId = "scheduled_expected_v1";

export const SCENARIO_LABELS: Record<CashProjectionScenarioId, string> = {
  scheduled_expected_v1: "Programado esperado",
  outflows_only_v1: "Sólo salidas",
  scheduled_with_arrears_recovery_v1: "Con recuperación vencida",
  scheduled_with_recurring_income_v1: "Con ingreso recurrente",
};

export function dateInSantiago(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function projectionState(
  scenario: CashProjectionScenario,
  now: Date | string = new Date(),
): ProjectionPresentationState {
  if (
    scenario.bridge.coverage.status === "partial" ||
    scenario.bridge.coverage.decision_support === "abstain" ||
    scenario.bridge.coverage.coverage_valid_through == null
  ) {
    return "partial";
  }
  const today = typeof now === "string" ? now : dateInSantiago(now);
  return scenario.bridge.coverage.coverage_valid_through < today ? "stale" : "current";
}

/** Race guard: una selección de un run anterior nunca se aplica al run nuevo. */
export function selectProjectionSnapshot(
  run: CashProjectionRun | null | undefined,
  selection: ProjectionSelection,
  now: Date | string = new Date(),
): CashProjectionViewModel | null {
  if (
    !run ||
    run.projection_run_id !== selection.runId ||
    run.calculation_version !== selection.calculationVersion
  ) {
    return null;
  }
  const scenario = run.scenarios.find((item) => item.scenario_id === selection.scenarioId);
  if (!scenario) return null;
  return {
    runId: run.projection_run_id,
    calculationVersion: run.calculation_version,
    inputDigest: run.input_digest,
    asOf: run.as_of,
    horizonDays: run.horizon_days,
    currency: run.currency,
    scenario,
    state: projectionState(scenario, now),
  };
}

/** Formatea el decimal contractual sin convertirlo a Number ni hacer aritmética. */
export function formatContractMoney(value: string, currency: string): string {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return `${value} ${currency}`;
  const sign = match[1] === "-" ? "−" : "";
  const integer = (match[2] ?? "0").replace(/^0+(?=\d)/, "");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimal = (match[3] ?? "").replace(/0+$/, "");
  return `${sign}${currency === "CLP" ? "$" : `${currency} `}${grouped}${decimal ? `,${decimal}` : ""}`;
}

export function paymentPlanMatchesProjection(
  plan: DecisionPlan | null | undefined,
  view: CashProjectionViewModel | null,
): boolean {
  const ref = plan?.projection_reference;
  if (
    !ref ||
    !view ||
    view.state !== "current" ||
    view.scenario.bridge.coverage.decision_support !== "eligible"
  )
    return false;
  return (
    ref.run === view.runId &&
    ref.scenario === view.scenario.scenario_id &&
    ref.calculation_version === view.calculationVersion &&
    ref.input_digest === view.inputDigest &&
    ref.as_of === view.asOf &&
    ref.horizon_days === view.horizonDays &&
    (ref.coverage_valid_through ?? null) ===
      (view.scenario.bridge.coverage.coverage_valid_through ?? null)
  );
}
