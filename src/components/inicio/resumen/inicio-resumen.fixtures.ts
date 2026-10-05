import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import type { BudgetVsActualResponse } from "@/lib/api/planning";
import type { LiquidityEvaluation } from "@/lib/api/financial-decisions";

// Illustrative values are restricted to tests/Storybook; never imported by the live container.
export const NOW = new Date("2026-09-11T12:15:00Z");
export const DEFICIT: DashboardSummaryV2 = {
  generated_at: NOW.toISOString(),
  cash_today: { total: "17900000", last_updated: NOW.toISOString(), data_state: "available" },
  cash_forecast: {
    min_14d: "-14000000",
    min_30d: "-14000000",
    days_of_cash_vencido_exigible_excluido: "0",
    last_updated: NOW.toISOString(),
  },
  cash_gap: {
    has_gap: true,
    cash_gap_amount_14d: "14000000",
    projected_cash_14d: "-10000000",
    critical_obligations_14d: "34800000",
    vencido_exigible: "0",
    vencido_exigible_n: 0,
    vencido_exigible_desde_dias: 90,
    vencido_exigible_mora_estructural: "0",
    last_updated: NOW.toISOString(),
  },
  priority_actions: [],
};
export const NO_DEFICIT: DashboardSummaryV2 = {
  ...DEFICIT,
  cash_today: { total: "43200000", last_updated: NOW.toISOString(), data_state: "available" },
  cash_forecast: {
    min_14d: "16000000",
    min_30d: "14000000",
    days_of_cash_vencido_exigible_excluido: "0",
    last_updated: NOW.toISOString(),
  },
  cash_gap: {
    ...DEFICIT.cash_gap!,
    has_gap: false,
    cash_gap_amount_14d: "0",
    projected_cash_14d: "20000000",
  },
};
export const BUDGET: BudgetVsActualResponse = {
  period: "2026-08",
  data_state: "available",
  has_budget: true,
  generated_at: NOW.toISOString(),
  missing_sources: [],
  lines: [
    {
      concept: "operating_expense",
      budget: "-14000000",
      actual: "-16000000",
      variance: "-2000000",
      variance_pct: "-14.285714",
    },
  ],
};
export const EVALUATION: LiquidityEvaluation = {
  decision_id: "10000000-0000-4000-8000-000000000001",
  status: "evaluated",
  decision_support: "eligible",
  model_version: "fpde-f1",
  recommended_alternative_id: "30000000-0000-4000-8000-000000000001",
  scope: {
    legal_entity_id: "20000000-0000-4000-8000-000000000001",
    currency: "CLP",
    as_of: NOW.toISOString(),
    horizon_days: 90,
    valid_until: "2026-09-12T12:15:00Z",
  },
  situation: {},
  event: { amount_peak: "14000000" },
  alternatives: [
    {
      id: "30000000-0000-4000-8000-000000000001",
      code: "factoring:invoice-1",
      family: "factoring",
      rank: 1,
      is_no_action: false,
      is_rejected: false,
      explanation: {},
      parameters: {},
      simulation: {},
      comparison: {},
      cost_status: "known",
      cost: {
        status: "known",
        total_financial_cost: "310000",
        contract_version: "cost.v1",
        evidence_refs: ["quote:1"],
      },
    },
  ],
};
