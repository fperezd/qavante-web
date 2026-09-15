import { http, HttpResponse } from "msw";
import type {
  CashProjectionRun,
  CashProjectionScenario,
  CashProjectionScenarioId,
} from "@/lib/api/cash-projection-runs";

type BridgeComponent = CashProjectionScenario["bridge"]["components"][number];
type Exclusion = CashProjectionScenario["exclusions"][number];

const IDS: CashProjectionScenarioId[] = [
  "scheduled_expected_v1",
  "outflows_only_v1",
  "scheduled_with_arrears_recovery_v1",
  "scheduled_with_recurring_income_v1",
];

function component(
  componentKey: string,
  direction: "inflow" | "outflow",
  amount: string,
  impactDate: string,
): BridgeComponent {
  return {
    component_key: componentKey,
    currency: "CLP",
    direction,
    functional_amount: amount,
    impact_date: impactDate,
    source_ref: `${direction === "inflow" ? "receivable" : "payable"}:${componentKey}`,
    evidence_ref: `evidence:${componentKey}`,
  };
}

function recurringExclusion(index: number): Exclusion {
  return {
    source_ref: `recurrence:unavailable-${index}`,
    reason: "recurring_income_not_durable",
    cash_relevant: true,
    scenario_ids: ["scheduled_with_recurring_income_v1"],
  };
}

function scenario(id: CashProjectionScenarioId, horizonDays: number): CashProjectionScenario {
  const recurring = id === "scheduled_with_recurring_income_v1";
  const outflowsOnly = id === "outflows_only_v1";
  const arrears = id === "scheduled_with_arrears_recovery_v1";
  const finalDate = horizonDays === 14 ? "2026-09-22" : "2026-12-07";
  const inflows = outflowsOnly ? "0" : arrears ? "6000000" : "5000000";
  const ending = outflowsOnly ? "-2000000" : arrears ? "4000000" : "3000000";
  const minimum = outflowsOnly ? "-2000000" : "-1000000";
  const minimumDate = outflowsOnly ? finalDate : "2026-09-12";
  const gap = outflowsOnly ? "2000000" : "1000000";
  const components = [
    ...(outflowsOnly ? [] : [component("ar:invoice-clp", "inflow", "5000000", finalDate)]),
    ...(arrears ? [component("ar:arrears-recovery", "inflow", "1000000", finalDate)] : []),
    component("ap:invoice-usd", "outflow", "11000000", "2026-09-12"),
    component("ap:rent-clp", "outflow", "1000000", finalDate),
  ];
  const dailySeries = Array.from({ length: horizonDays }, (_, index) => {
    const date = new Date(Date.UTC(2026, 8, 9 + index)).toISOString().slice(0, 10);
    const isMinimumDay = date === "2026-09-12";
    const isFinalDay = index === horizonDays - 1;
    const beforeMinimum = date < "2026-09-12";
    return {
      date,
      inflows: isFinalDay ? inflows : "0",
      outflows: isMinimumDay ? "11000000" : isFinalDay ? "1000000" : "0",
      closing_cash: beforeMinimum ? "10000000" : isFinalDay ? ending : "-1000000",
    };
  });
  return {
    scenario_id: id,
    scenario_name: id,
    opening_cash: "10000000",
    inflows_total: inflows,
    outflows_total: "12000000",
    ending_cash: ending,
    minimum_cash: minimum,
    minimum_cash_date: minimumDate,
    gap_against_zero: gap,
    assumptions: {
      cash_balance_timing: "closing_balance_daily_v1",
      minimum_definition: "minimum_daily_closing_cash_v1",
      gap_definition: "server_owned_against_zero_v1",
      overdue_payables: "included_once_v1",
      arrears_recovery: "observed_only_v1",
      recurring_income: recurring ? "unavailable_no_durable_evidence" : "not_applied",
    },
    exclusions: recurring
      ? Array.from({ length: 6 }, (_, index) => recurringExclusion(index + 1))
      : [],
    source_coverage: [
      {
        required_source_ref: "accounts_payable",
        state: recurring ? "partial" : "current",
        reason_codes: recurring ? ["recurring_income_not_durable"] : [],
        catalog_version: "d10-v1",
        evaluated_at: "2026-09-08T12:00:00Z",
        valid_through: recurring ? null : "2026-09-08",
        observed_count: 2,
      },
    ],
    series: dailySeries,
    bridge: {
      coverage: {
        status: recurring ? "partial" : "current",
        decision_support: recurring ? "abstain" : "eligible",
        coverage_valid_through: recurring ? null : "2026-09-22",
      },
      components,
      component_count: components.length,
    },
    scenario_digest: recurring ? "d".repeat(64) : "c".repeat(64),
  };
}

export function cashProjectionRunFixture(horizonDays: number): CashProjectionRun {
  return {
    projection_run_id:
      horizonDays === 14
        ? "11111111-1111-4111-8111-111111111114"
        : "11111111-1111-4111-8111-111111111190",
    input_digest: "a".repeat(64),
    legal_entity_id: "11111111-1111-4111-8111-111111111111",
    v14_generation_id: "22222222-2222-4222-8222-222222222222",
    v14_projection_snapshot_id: "33333333-3333-4333-8333-333333333333",
    cutoff_at: "2026-09-08T12:00:00Z",
    as_of: "2026-09-08",
    horizon_days: horizonDays,
    currency: "CLP",
    calculation_version: "cash-projection-run-v1",
    scenarios: IDS.map((id) => scenario(id, horizonDays)),
  };
}

const byIntent = new Map<string, { requestFingerprint: string; run: CashProjectionRun }>();

export const cashProjectionRunHandlers = [
  http.post("*/api/treasury/cash-projection-runs", async ({ request }) => {
    const key = request.headers.get("Idempotency-Key");
    if (!key)
      return HttpResponse.json({ detail: { code: "invalid_idempotency_key" } }, { status: 422 });
    const body = (await request.json()) as {
      horizon_days?: number;
      legal_entity_id?: string;
      currency?: string;
      as_of?: string;
    };
    if (!body.legal_entity_id || !body.currency || !body.as_of) {
      return HttpResponse.json({ detail: { code: "projection_scope_required" } }, { status: 422 });
    }
    const horizon = body.horizon_days ?? 90;
    const requestFingerprint = [
      body.legal_entity_id,
      body.currency,
      body.as_of,
      String(horizon),
    ].join("|");
    const replay = byIntent.get(key);
    if (replay && replay.requestFingerprint !== requestFingerprint) {
      return HttpResponse.json({ detail: { code: "idempotency_key_reused" } }, { status: 409 });
    }
    if (replay) return HttpResponse.json(replay.run, { status: 200 });
    const run = cashProjectionRunFixture(horizon);
    byIntent.set(key, { requestFingerprint, run });
    return HttpResponse.json(run, { status: 201 });
  }),
  http.get("*/api/treasury/cash-projection-runs/:runId", ({ params }) =>
    params.runId === "11111111-1111-4111-8111-111111111114"
      ? HttpResponse.json(cashProjectionRunFixture(14))
      : params.runId === "11111111-1111-4111-8111-111111111190"
        ? HttpResponse.json(cashProjectionRunFixture(90))
        : HttpResponse.json({ detail: { code: "cash_projection_run_not_found" } }, { status: 404 }),
  ),
  http.get("*/api/treasury/decision-plans/payment", ({ request }) => {
    const url = new URL(request.url);
    const runId = url.searchParams.get("projection_run_id");
    const scenarioId = url.searchParams.get("scenario_id") as CashProjectionScenarioId | null;
    if (!runId && !scenarioId) return undefined;
    if (!runId || !scenarioId) {
      return HttpResponse.json(
        { detail: { code: "projection_run_and_scenario_are_required_together" } },
        { status: 422 },
      );
    }
    const run = cashProjectionRunFixture(14);
    const selected = run.scenarios.find((item) => item.scenario_id === scenarioId);
    if (runId !== run.projection_run_id || !selected) {
      return HttpResponse.json(
        { detail: { code: "cash_projection_run_not_found" } },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      kind: "payment_plan",
      state: selected.bridge.coverage.decision_support === "eligible" ? "ready" : "abstain",
      summary: "Plan de pagos ligado a una foto inmutable.",
      confidence: "high",
      reasons: [],
      evidence: [],
      alternatives: [],
      generated_at: "2026-09-08T12:00:00Z",
      projection_reference: {
        run: run.projection_run_id,
        scenario: scenarioId,
        calculation_version: run.calculation_version,
        input_digest: run.input_digest,
        as_of: run.as_of,
        horizon_days: 14,
        coverage_valid_through: selected.bridge.coverage.coverage_valid_through,
      },
    });
  }),
];
